/**
 * GMC 3D Viewer - Exploded View Plugin
 * Smooth radial outward explosion of assembly components
 */
(function () {
    let explodedActive = false;
    let currentFactor = 0; // 0 to 1
    let hudElement = null;
    let sliderEl = null;
    let valueDisplayEl = null;
    let activeViewer = null;
    let meshOriginalData = new Map(); // mesh -> { origPos, dir, maxOffset }
    let presetButtons = {};

    function getViewerInstance() {
        if (activeViewer) return activeViewer;
        if (window.gmcViewer) return window.gmcViewer;
        return null;
    }

    function initMeshData() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.mainModel || !viewer.mainModel.scene) return false;

        meshOriginalData.clear();

        // 1. Compute overall bounding box of the assembly
        const box = viewer.GetBoundingBox(mesh => true);
        if (!box || !box.min || !box.max) return false;

        const center = {
            x: (box.min.x + box.max.x) / 2,
            y: (box.min.y + box.max.y) / 2,
            z: (box.min.z + box.max.z) / 2
        };

        const sizeX = box.max.x - box.min.x;
        const sizeY = box.max.y - box.min.y;
        const sizeZ = box.max.z - box.min.z;
        const diagonal = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ);
        const maxExplodeDistance = Math.max(diagonal * 0.85, 30);

        // 2. Collect meshes
        const meshes = [];
        viewer.mainModel.scene.traverse((obj) => {
            if (obj.isMesh && obj.geometry) {
                meshes.push(obj);
            }
        });

        if (meshes.length === 0) return false;

        meshes.forEach((mesh, index) => {
            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox();
            }
            const meshBox = mesh.geometry.boundingBox;
            const meshLocalCenter = {
                x: (meshBox.min.x + meshBox.max.x) / 2,
                y: (meshBox.min.y + meshBox.max.y) / 2,
                z: (meshBox.min.z + meshBox.max.z) / 2
            };

            const origPos = {
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z
            };

            // Estimated world center of this component
            const worldCenterX = origPos.x + meshLocalCenter.x;
            const worldCenterY = origPos.y + meshLocalCenter.y;
            const worldCenterZ = origPos.z + meshLocalCenter.z;

            let dx = worldCenterX - center.x;
            let dy = worldCenterY - center.y;
            let dz = worldCenterZ - center.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // If centered/concentric part, disperse by angular index
            if (dist < 0.01) {
                const angle = (index / Math.max(meshes.length, 1)) * Math.PI * 2;
                dx = Math.cos(angle);
                dy = (index % 2 === 0 ? 0.6 : -0.6);
                dz = Math.sin(angle);
                dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }

            const dir = {
                x: dx / dist,
                y: dy / dist,
                z: dz / dist
            };

            meshOriginalData.set(mesh, {
                origX: origPos.x,
                origY: origPos.y,
                origZ: origPos.z,
                dir: dir,
                maxOffset: maxExplodeDistance
            });
        });

        return true;
    }

    function applyExplode(factor) {
        currentFactor = factor;
        const viewer = getViewerInstance();
        if (!viewer) return;

        if (meshOriginalData.size === 0 && factor > 0) {
            initMeshData();
        }

        meshOriginalData.forEach((data, mesh) => {
            mesh.position.x = data.origX + data.dir.x * data.maxOffset * factor;
            mesh.position.y = data.origY + data.dir.y * data.maxOffset * factor;
            mesh.position.z = data.origZ + data.dir.z * data.maxOffset * factor;
            if (mesh.matrixWorldNeedsUpdate !== undefined) {
                mesh.matrixWorldNeedsUpdate = true;
            }
        });

        viewer.Render();

        if (sliderEl) sliderEl.value = Math.round(factor * 100);
        if (valueDisplayEl) valueDisplayEl.textContent = `${Math.round(factor * 100)}%`;

        Object.keys(presetButtons).forEach(pct => {
            const btn = presetButtons[pct];
            if (btn) {
                btn.classList.toggle('active', Math.round(factor * 100) === parseInt(pct, 10));
            }
        });
    }

    function resetMeshes() {
        meshOriginalData.forEach((data, mesh) => {
            mesh.position.x = data.origX;
            mesh.position.y = data.origY;
            mesh.position.z = data.origZ;
            if (mesh.matrixWorldNeedsUpdate !== undefined) {
                mesh.matrixWorldNeedsUpdate = true;
            }
        });
        meshOriginalData.clear();
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

        const pBtns = hudElement.querySelectorAll('.gmc_preset_btn');
        pBtns.forEach(btn => {
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
            hudElement.style.display = 'block';
            initMeshData();
            if (currentFactor > 0) {
                applyExplode(currentFactor);
            }
        } else {
            hudElement.style.display = 'none';
            resetMeshes();
            if (sliderEl) sliderEl.value = 0;
            if (valueDisplayEl) valueDisplayEl.textContent = '0%';
            Object.keys(presetButtons).forEach(pct => {
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
