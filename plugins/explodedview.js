/**
 * GMC 3D Viewer - Exploded View Plugin
 * Smooth directional and radial outward explosion of assembly components
 * Full 1:1 synchronization of solid meshes, CAD wireframe edges, and lines
 */
(function () {
    let explodedActive = false;
    let currentFactor = 0; // 0 to 1
    let currentAxis = 'radial'; // 'radial', 'x', 'y', 'z'
    let hudElement = null;
    let sliderEl = null;
    let valueDisplayEl = null;
    let activeViewer = null;
    let axisButtons = {};
    let presetButtons = {};
    let componentGroups = new Map(); // key -> ComponentGroup
    let objectBaselines = new Map(); // Object3D -> { origX, origY, origZ }
    let assemblyContext = null; // { center, sizeX, sizeY, sizeZ, maxExplodeDistance }

    function getViewerInstance() {
        if (activeViewer) return activeViewer;
        if (window.gmcViewer) return window.gmcViewer;
        if (window.gmcWebsite && window.gmcWebsite.viewer) return window.gmcWebsite.viewer;
        return null;
    }

    function hookEdgeDisplay() {
        const ws = window.gmcWebsite;
        if (ws && !ws._explodedHooked && typeof ws.UpdateEdgeDisplay === 'function') {
            ws._explodedHooked = true;
            const origUpdateEdgeDisplay = ws.UpdateEdgeDisplay.bind(ws);
            ws.UpdateEdgeDisplay = function () {
                origUpdateEdgeDisplay();
                if (explodedActive && currentFactor > 0) {
                    applyExplode(currentFactor);
                }
            };
        }
    }

    function initComponentData() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.mainModel) return false;

        componentGroups.clear();
        objectBaselines.clear();

        // 1. Overall bounding box of assembly
        const box = viewer.GetBoundingBox(mesh => true);
        if (!box || !box.min || !box.max) return false;

        const center = {
            x: (box.min.x + box.max.x) / 2,
            y: (box.min.y + box.max.y) / 2,
            z: (box.min.z + box.max.z) / 2
        };

        const sizeX = Math.max(box.max.x - box.min.x, 1);
        const sizeY = Math.max(box.max.y - box.min.y, 1);
        const sizeZ = Math.max(box.max.z - box.min.z, 1);
        const diagonal = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ);
        const maxExplodeDistance = Math.max(diagonal * 0.85, 30);

        assemblyContext = { center, sizeX, sizeY, sizeZ, maxExplodeDistance };

        function getGroup(key, fallbackName) {
            if (!componentGroups.has(key)) {
                componentGroups.set(key, {
                    key: key,
                    name: fallbackName,
                    meshes: [],
                    edges: [],
                    lines: [],
                    worldCenter: { x: 0, y: 0, z: 0 },
                    meshCount: 0,
                    lastDisplacement: { x: 0, y: 0, z: 0 }
                });
            }
            return componentGroups.get(key);
        }

        // 2. Collect all solid meshes from mainModel
        let meshIndex = 0;
        viewer.mainModel.EnumerateMeshes((mesh) => {
            if (!mesh.geometry) return;
            const key = mesh.userData?.originalMeshInstance?.id?.GetKey ?
                mesh.userData.originalMeshInstance.id.GetKey() :
                `mesh_${meshIndex++}`;

            const grp = getGroup(key, mesh.name || key);
            grp.meshes.push(mesh);

            if (!objectBaselines.has(mesh)) {
                objectBaselines.set(mesh, {
                    origX: mesh.position.x,
                    origY: mesh.position.y,
                    origZ: mesh.position.z
                });
            }

            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox();
            }
            const mb = mesh.geometry.boundingBox;
            const localCenter = {
                x: (mb.min.x + mb.max.x) / 2,
                y: (mb.min.y + mb.max.y) / 2,
                z: (mb.min.z + mb.max.z) / 2
            };

            grp.worldCenter.x += mesh.position.x + localCenter.x;
            grp.worldCenter.y += mesh.position.y + localCenter.y;
            grp.worldCenter.z += mesh.position.z + localCenter.z;
            grp.meshCount++;
        });

        if (componentGroups.size === 0) return false;

        // Average world center for each component group
        componentGroups.forEach((grp) => {
            if (grp.meshCount > 0) {
                grp.worldCenter.x /= grp.meshCount;
                grp.worldCenter.y /= grp.meshCount;
                grp.worldCenter.z /= grp.meshCount;
            }
        });

        // 3. Collect CAD edge lines from edgeModel (synchronized with meshes)
        viewer.mainModel.EnumerateEdges((edge) => {
            const key = edge.userData?.originalMeshInstance?.id?.GetKey ?
                edge.userData.originalMeshInstance.id.GetKey() : null;
            if (key && componentGroups.has(key)) {
                const grp = componentGroups.get(key);
                grp.edges.push(edge);
                if (!objectBaselines.has(edge)) {
                    const mesh = grp.meshes[0];
                    const meshBase = mesh ? objectBaselines.get(mesh) : null;
                    objectBaselines.set(edge, {
                        origX: meshBase ? meshBase.origX : edge.position.x,
                        origY: meshBase ? meshBase.origY : edge.position.y,
                        origZ: meshBase ? meshBase.origZ : edge.position.z
                    });
                }
            }
        });

        // 4. Collect native line segments from mainModel
        viewer.mainModel.EnumerateLines((line) => {
            const key = line.userData?.originalMeshInstance?.id?.GetKey ?
                line.userData.originalMeshInstance.id.GetKey() : null;
            if (key && componentGroups.has(key)) {
                const grp = componentGroups.get(key);
                grp.lines.push(line);
                if (!objectBaselines.has(line)) {
                    const mesh = grp.meshes[0];
                    const meshBase = mesh ? objectBaselines.get(mesh) : null;
                    objectBaselines.set(line, {
                        origX: meshBase ? meshBase.origX : line.position.x,
                        origY: meshBase ? meshBase.origY : line.position.y,
                        origZ: meshBase ? meshBase.origZ : line.position.z
                    });
                }
            }
        });

        return true;
    }

    function getComponentDisplacement(grp, axis, factor, ctx) {
        const { center, sizeX, sizeY, sizeZ, maxExplodeDistance } = ctx;
        const wc = grp.worldCenter;
        const dx = wc.x - center.x;
        const dy = wc.y - center.y;
        const dz = wc.z - center.z;

        if (axis === 'x') {
            const halfSpan = sizeX / 2 || 1;
            const normDist = Math.abs(dx) / halfSpan;
            const sign = Math.abs(dx) > 0.001 ? Math.sign(dx) : (grp.index % 2 === 0 ? 1 : -1);
            const weight = 0.25 + 0.75 * Math.min(Math.max(normDist, 0.1), 2.0);
            return {
                x: sign * maxExplodeDistance * weight * factor,
                y: 0,
                z: 0
            };
        } else if (axis === 'y') {
            const halfSpan = sizeY / 2 || 1;
            const normDist = Math.abs(dy) / halfSpan;
            const sign = Math.abs(dy) > 0.001 ? Math.sign(dy) : (grp.index % 2 === 0 ? 1 : -1);
            const weight = 0.25 + 0.75 * Math.min(Math.max(normDist, 0.1), 2.0);
            return {
                x: 0,
                y: sign * maxExplodeDistance * weight * factor,
                z: 0
            };
        } else if (axis === 'z') {
            const halfSpan = sizeZ / 2 || 1;
            const normDist = Math.abs(dz) / halfSpan;
            const sign = Math.abs(dz) > 0.001 ? Math.sign(dz) : (grp.index % 2 === 0 ? 1 : -1);
            const weight = 0.25 + 0.75 * Math.min(Math.max(normDist, 0.1), 2.0);
            return {
                x: 0,
                y: 0,
                z: sign * maxExplodeDistance * weight * factor
            };
        } else {
            // Radial (Free-form 3D outward explosion)
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            let dirX, dirY, dirZ;
            if (dist < 0.001) {
                const angle = (grp.index / Math.max(componentGroups.size, 1)) * Math.PI * 2;
                dirX = Math.cos(angle);
                dirY = (grp.index % 2 === 0 ? 0.6 : -0.6);
                dirZ = Math.sin(angle);
                const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
                dirX /= len;
                dirY /= len;
                dirZ /= len;
            } else {
                dirX = dx / dist;
                dirY = dy / dist;
                dirZ = dz / dist;
            }
            const maxDist = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) / 2 || 1;
            const weight = 0.35 + 0.65 * Math.min(Math.max(dist / maxDist, 0.1), 2.0);
            return {
                x: dirX * maxExplodeDistance * weight * factor,
                y: dirY * maxExplodeDistance * weight * factor,
                z: dirZ * maxExplodeDistance * weight * factor
            };
        }
    }

    function applyExplode(factor) {
        currentFactor = factor;
        const viewer = getViewerInstance();
        if (!viewer || !viewer.mainModel) return;

        if (componentGroups.size === 0 && factor > 0) {
            initComponentData();
        }
        if (componentGroups.size === 0 || !assemblyContext) return;

        // Dynamically capture any new edges (e.g. if edges were toggled or regenerated)
        viewer.mainModel.EnumerateEdges((edge) => {
            if (!objectBaselines.has(edge)) {
                const key = edge.userData?.originalMeshInstance?.id?.GetKey ?
                    edge.userData.originalMeshInstance.id.GetKey() : null;
                if (key && componentGroups.has(key)) {
                    const grp = componentGroups.get(key);
                    if (!grp.edges.includes(edge)) grp.edges.push(edge);
                    const mesh = grp.meshes[0];
                    const meshBase = mesh ? objectBaselines.get(mesh) : null;
                    objectBaselines.set(edge, {
                        origX: meshBase ? meshBase.origX : 0,
                        origY: meshBase ? meshBase.origY : 0,
                        origZ: meshBase ? meshBase.origZ : 0
                    });
                }
            }
        });

        // Dynamically capture any new lines
        viewer.mainModel.EnumerateLines((line) => {
            if (!objectBaselines.has(line)) {
                const key = line.userData?.originalMeshInstance?.id?.GetKey ?
                    line.userData.originalMeshInstance.id.GetKey() : null;
                if (key && componentGroups.has(key)) {
                    const grp = componentGroups.get(key);
                    if (!grp.lines.includes(line)) grp.lines.push(line);
                    const mesh = grp.meshes[0];
                    const meshBase = mesh ? objectBaselines.get(mesh) : null;
                    objectBaselines.set(line, {
                        origX: meshBase ? meshBase.origX : 0,
                        origY: meshBase ? meshBase.origY : 0,
                        origZ: meshBase ? meshBase.origZ : 0
                    });
                }
            }
        });

        const ctx = assemblyContext;
        let idx = 0;

        componentGroups.forEach((grp) => {
            grp.index = idx++;
            const disp = getComponentDisplacement(grp, currentAxis, factor, ctx);
            grp.lastDisplacement = disp;

            // 1. Displace meshes
            grp.meshes.forEach((mesh) => {
                const base = objectBaselines.get(mesh);
                if (base) {
                    mesh.position.x = base.origX + disp.x;
                    mesh.position.y = base.origY + disp.y;
                    mesh.position.z = base.origZ + disp.z;
                    mesh.matrixWorldNeedsUpdate = true;
                }
            });

            // 2. Displace edge lines in 1:1 synchronization
            grp.edges.forEach((edge) => {
                const base = objectBaselines.get(edge);
                if (base) {
                    edge.position.x = base.origX + disp.x;
                    edge.position.y = base.origY + disp.y;
                    edge.position.z = base.origZ + disp.z;
                    edge.matrixWorldNeedsUpdate = true;
                }
            });

            // 3. Displace native model lines
            grp.lines.forEach((line) => {
                const base = objectBaselines.get(line);
                if (base) {
                    line.position.x = base.origX + disp.x;
                    line.position.y = base.origY + disp.y;
                    line.position.z = base.origZ + disp.z;
                    line.matrixWorldNeedsUpdate = true;
                }
            });
        });

        viewer.Render();

        if (sliderEl) sliderEl.value = Math.round(factor * 100);
        if (valueDisplayEl) valueDisplayEl.textContent = `${Math.round(factor * 100)}%`;

        Object.keys(presetButtons).forEach((pct) => {
            const btn = presetButtons[pct];
            if (btn) {
                btn.classList.toggle('active', Math.round(factor * 100) === parseInt(pct, 10));
            }
        });
    }

    function selectAxis(axis) {
        currentAxis = axis;
        Object.keys(axisButtons).forEach((k) => {
            if (axisButtons[k]) {
                axisButtons[k].classList.toggle('active', k === axis);
            }
        });
        if (currentFactor > 0) {
            applyExplode(currentFactor);
        }
    }

    function resetMeshes() {
        objectBaselines.forEach((base, obj) => {
            obj.position.x = base.origX;
            obj.position.y = base.origY;
            obj.position.z = base.origZ;
            obj.matrixWorldNeedsUpdate = true;
        });
        objectBaselines.clear();
        componentGroups.clear();
        assemblyContext = null;
        currentFactor = 0;
        const viewer = getViewerInstance();
        if (viewer) viewer.Render();
    }

    function createHUD() {
        if (hudElement) return;

        hudElement = document.createElement('div');
        hudElement.className = 'gmc_exploded_hud';
        hudElement.innerHTML = `
            <div class="gmc_hud_header">
                <span class="gmc_hud_title">
                    <span class="gmc_hud_icon"></span>
                    Exploded View
                </span>
                <button class="gmc_hud_close" title="Close Exploded View">&times;</button>
            </div>
            <div class="gmc_hud_body">
                <div class="gmc_axis_row">
                    <span class="gmc_label">Axis:</span>
                    <button class="gmc_axis_btn active" data-axis="radial">Radial</button>
                    <button class="gmc_axis_btn" data-axis="x">X</button>
                    <button class="gmc_axis_btn" data-axis="y">Y</button>
                    <button class="gmc_axis_btn" data-axis="z">Z</button>
                </div>
                <div class="gmc_axis_row">
                    <span class="gmc_label">Presets:</span>
                    <button class="gmc_preset_btn active" data-pct="0">0%</button>
                    <button class="gmc_preset_btn" data-pct="25">25%</button>
                    <button class="gmc_preset_btn" data-pct="50">50%</button>
                    <button class="gmc_preset_btn" data-pct="100">100%</button>
                </div>
                <div class="gmc_slider_row">
                    <input type="range" class="gmc_section_slider gmc_explode_slider" min="0" max="100" step="1" value="0">
                    <span class="gmc_offset_value gmc_explode_val">0%</span>
                </div>
            </div>
        `;

        document.body.appendChild(hudElement);

        hudElement.querySelector('.gmc_hud_close').addEventListener('click', () => {
            setExplodedActive(false);
        });

        // Bind axis buttons
        const aBtns = hudElement.querySelectorAll('.gmc_axis_btn');
        aBtns.forEach((btn) => {
            const ax = btn.getAttribute('data-axis');
            axisButtons[ax] = btn;
            btn.addEventListener('click', () => selectAxis(ax));
        });

        // Bind preset buttons
        const pBtns = hudElement.querySelectorAll('.gmc_preset_btn');
        pBtns.forEach((btn) => {
            const pct = btn.getAttribute('data-pct');
            presetButtons[pct] = btn;
            btn.addEventListener('click', () => {
                applyExplode(parseInt(pct, 10) / 100);
            });
        });

        sliderEl = hudElement.querySelector('.gmc_explode_slider');
        valueDisplayEl = hudElement.querySelector('.gmc_explode_val');

        sliderEl.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) / 100;
            applyExplode(val);
        });
    }

    function setExplodedActive(active) {
        if (active && window.gmcSetSectionActive) {
            window.gmcSetSectionActive(false);
        }

        explodedActive = active;
        if (!hudElement) createHUD();

        const toolbarBtn = document.querySelector('.ov_toolbar_button[alt="Exploded View"], .ov_toolbar_button[title="Exploded View"], .ov_toolbar_button[title="Exploded view"]');
        if (toolbarBtn) {
            toolbarBtn.classList.toggle('selected', explodedActive);
        }

        if (explodedActive) {
            hookEdgeDisplay();
            hudElement.style.display = 'block';
            initComponentData();
            if (currentFactor > 0) {
                applyExplode(currentFactor);
            }
        } else {
            hudElement.style.display = 'none';
            resetMeshes();
            if (sliderEl) sliderEl.value = 0;
            if (valueDisplayEl) valueDisplayEl.textContent = '0%';
            Object.keys(presetButtons).forEach((pct) => {
                const btn = presetButtons[pct];
                if (btn) {
                    btn.classList.toggle('active', pct === '0');
                }
            });
        }
    }

    // Auto-hide when leaving model view (Hash change, back navigation, or Intro state)
    function checkModelActiveState() {
        const hash = window.location.hash || '';
        const hasModelInHash = hash.includes('model=');
        const introVisible = document.querySelector('#intro')?.style?.display !== 'none';

        if (!hasModelInHash || introVisible) {
            if (explodedActive) {
                setExplodedActive(false);
            }
        }
    }

    window.addEventListener('hashchange', checkModelActiveState);
    window.addEventListener('popstate', checkModelActiveState);
    window.addEventListener('gmc_ui_state_changed', (e) => {
        if (e.detail && e.detail.state !== 2) { // 2 = ss.Model
            setExplodedActive(false);
        }
    });

    // Observer on #intro to detect display changes
    const introEl = document.getElementById('intro');
    if (introEl) {
        const obs = new MutationObserver(() => {
            checkModelActiveState();
        });
        obs.observe(introEl, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // Register with OV Toolbar Plugin system
    if (typeof OV !== 'undefined' && OV.RegisterToolbarPlugin) {
        OV.RegisterToolbarPlugin({
            registerButtons: (pluginInterface) => {
                if (pluginInterface.getViewer) {
                    activeViewer = pluginInterface.getViewer();
                }
                pluginInterface.createButton(
                    'exploded',
                    'Exploded View',
                    ['only_full_width', 'only_on_model'],
                    () => {
                        if (pluginInterface.getViewer) {
                            activeViewer = pluginInterface.getViewer();
                        }
                        setExplodedActive(!explodedActive);
                    }
                );
            }
        });
    }

    window.gmcSetExplodedActive = setExplodedActive;
})();
