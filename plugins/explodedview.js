/**
 * GMC 3D Viewer - Exploded View Plugin
 * Smooth directional (X, Y, Z) and radial outward explosion of assembly components
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
    let assemblyContext = null; // { center, sizeX, sizeY, sizeZ, diagonal, maxExplodeDistance }

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
        const maxExplodeDistance = Math.max(diagonal * 0.9, 30);

        assemblyContext = { center, sizeX, sizeY, sizeZ, diagonal, maxExplodeDistance };

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
                    currentDisplacement: { x: 0, y: 0, z: 0 }
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

    function computeAllDisplacements(axis, factor, ctx) {
        const groups = Array.from(componentGroups.values());
        const count = groups.length;
        if (count === 0) return;

        if (factor === 0) {
            groups.forEach((grp) => {
                grp.currentDisplacement = { x: 0, y: 0, z: 0 };
            });
            return;
        }

        if (axis === 'radial') {
            // Outward 3D radial explosion with equal radial distance step
            const diag = ctx.diagonal || 1;
            const radialStep = (diag * 0.8) / Math.max(count, 1);
            const baseDist = Math.max(diag * 0.25, 20);

            // Sort groups by distance from center for stable concentric ordering
            const sortedRadial = [...groups].sort((a, b) => {
                const da = Math.hypot(a.worldCenter.x - ctx.center.x, a.worldCenter.y - ctx.center.y, a.worldCenter.z - ctx.center.z);
                const db = Math.hypot(b.worldCenter.x - ctx.center.x, b.worldCenter.y - ctx.center.y, b.worldCenter.z - ctx.center.z);
                return da - db;
            });

            sortedRadial.forEach((grp, idx) => {
                const dx = grp.worldCenter.x - ctx.center.x;
                const dy = grp.worldCenter.y - ctx.center.y;
                const dz = grp.worldCenter.z - ctx.center.z;
                let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                let dirX, dirY, dirZ;

                if (dist < 0.001) {
                    const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
                    const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
                    dirX = Math.sin(phi) * Math.cos(theta);
                    dirY = Math.sin(phi) * Math.sin(theta);
                    dirZ = Math.cos(phi);
                } else {
                    dirX = dx / dist;
                    dirY = dy / dist;
                    dirZ = dz / dist;
                }

                // Equal radial distance step from center
                const mag = (baseDist + idx * radialStep) * factor;

                grp.currentDisplacement = {
                    x: dirX * mag,
                    y: dirY * mag,
                    z: dirZ * mag
                };
            });
        } else {
            // Directional Axial Explosion (X, Y, Z) with strictly equal distance from mesh to mesh
            const coordKey = axis; // 'x', 'y', or 'z'
            const spanKey = (axis === 'x' ? 'sizeX' : (axis === 'y' ? 'sizeY' : 'sizeZ'));
            const axisSpan = ctx[spanKey] || 1;
            const diag = ctx.diagonal || 1;
            const centerCoord = ctx.center[coordKey];

            // Equal step distance between adjacent meshes along chosen axis
            const step = Math.max(
                (diag * 1.5) / Math.max(count - 1, 1),
                (axisSpan * 2.0) / Math.max(count - 1, 1),
                50
            );

            // Deterministic stable sort along chosen axis
            const sorted = [...groups].sort((a, b) => {
                const diff = a.worldCenter[coordKey] - b.worldCenter[coordKey];
                if (Math.abs(diff) > 0.001) return diff;
                const sec1 = coordKey === 'x' ? 'y' : 'x';
                const diff1 = a.worldCenter[sec1] - b.worldCenter[sec1];
                if (Math.abs(diff1) > 0.001) return diff1;
                const sec2 = coordKey === 'z' ? 'y' : 'z';
                return a.worldCenter[sec2] - b.worldCenter[sec2];
            });

            sorted.forEach((grp, rank) => {
                // Symmetrically centered equal spacing for every mesh
                const rankOffset = count > 1 ? rank - (count - 1) / 2 : 0;
                const targetCoord = centerCoord + rankOffset * step * factor;
                const dispVal = targetCoord - grp.worldCenter[coordKey];

                grp.currentDisplacement = {
                    x: axis === 'x' ? dispVal : 0,
                    y: axis === 'y' ? dispVal : 0,
                    z: axis === 'z' ? dispVal : 0
                };
            });
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
        computeAllDisplacements(currentAxis, factor, ctx);

        componentGroups.forEach((grp) => {
            const disp = grp.currentDisplacement || { x: 0, y: 0, z: 0 };

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
            <div class="gmc_hud_title">
                <span>Exploded View</span>
                <button class="gmc_hud_close" title="Close Exploded View">&times;</button>
            </div>
            <div class="gmc_hud_body">
                <div class="gmc_axis_row">
                    <span class="gmc_label">Axis:</span>
                    <button class="gmc_axis_btn gmc_explode_axis_btn active" data-axis="radial">Radial</button>
                    <button class="gmc_axis_btn gmc_explode_axis_btn" data-axis="x">X</button>
                    <button class="gmc_axis_btn gmc_explode_axis_btn" data-axis="y">Y</button>
                    <button class="gmc_axis_btn gmc_explode_axis_btn" data-axis="z">Z</button>
                </div>
                <div class="gmc_axis_row">
                    <span class="gmc_label">Presets:</span>
                    <button class="gmc_preset_btn active" data-pct="0">0%</button>
                    <button class="gmc_preset_btn" data-pct="25">25%</button>
                    <button class="gmc_preset_btn" data-pct="50">50%</button>
                    <button class="gmc_preset_btn" data-pct="75">75%</button>
                    <button class="gmc_preset_btn" data-pct="100">100%</button>
                </div>
                <div class="gmc_slider_row">
                    <input type="range" class="gmc_explode_slider" min="0" max="100" value="0" step="1">
                    <span class="gmc_explode_val">0%</span>
                </div>
            </div>
        `;

        document.body.appendChild(hudElement);

        // Close button
        const closeBtn = hudElement.querySelector('.gmc_hud_close');
        closeBtn.addEventListener('click', () => {
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
                    ['only_on_model'],
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
    window.gmcSelectExplodedAxis = selectAxis;
    window.gmcApplyExplode = applyExplode;
    window.gmcGetExplodedAxis = () => currentAxis;
    window.gmcGetExplodedFactor = () => currentFactor;
    window.gmcGetComponentGroups = () => componentGroups;
})();
