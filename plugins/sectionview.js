/**
 * GMC 3D Viewer - Section View Plugin
 * Interactive Cross-Sectioning / Clipping Plane Tool with Solid CAD Capping
 */
(function () {
    let sectionActive = false;
    let currentAxis = 'y'; // 'x', 'y', 'z'
    let currentOffset = 0;
    let inverted = false;
    let solidCapEnabled = true;
    let hudElement = null;
    let sliderEl = null;
    let valueDisplayEl = null;
    let capCheckboxEl = null;
    let axisButtons = {};
    let activeViewer = null;
    let activeCapMesh = null;

    // Custom Plane class that matches Three.js Plane interface
    class ClippingPlane {
        constructor(normal, constant) {
            this.isPlane = true;
            this.normal = normal;
            this.constant = constant;
        }
        set(normal, constant) {
            this.normal = normal;
            this.constant = constant;
            return this;
        }
        clone() {
            return new ClippingPlane(
                { x: this.normal.x, y: this.normal.y, z: this.normal.z },
                this.constant
            );
        }
        applyMatrix4() {
            return this;
        }
    }

    function getViewerInstance() {
        if (activeViewer) return activeViewer;
        if (window.gmcViewer) return window.gmcViewer;
        return null;
    }

    function getModelBounds() {
        const viewer = getViewerInstance();
        if (!viewer) return { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } };
        const box = viewer.GetBoundingBox(mesh => true);
        if (box && box.min && box.max) {
            return box;
        }
        return { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } };
    }

    function updateCapMesh(bounds, normalVec, sign) {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.scene) return;

        if (!sectionActive || !solidCapEnabled) {
            if (activeCapMesh) {
                viewer.scene.remove(activeCapMesh);
                if (activeCapMesh.geometry) activeCapMesh.geometry.dispose();
                if (activeCapMesh.material) activeCapMesh.material.dispose();
                activeCapMesh = null;
            }
            return;
        }

        const sizeX = Math.max(bounds.max.x - bounds.min.x, 2);
        const sizeY = Math.max(bounds.max.y - bounds.min.y, 2);
        const sizeZ = Math.max(bounds.max.z - bounds.min.z, 2);
        const centerX = (bounds.min.x + bounds.max.x) / 2;
        const centerY = (bounds.min.y + bounds.max.y) / 2;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;

        let w = 10, h = 10;
        if (currentAxis === 'x') { w = sizeZ * 1.05; h = sizeY * 1.05; }
        else if (currentAxis === 'y') { w = sizeX * 1.05; h = sizeZ * 1.05; }
        else if (currentAxis === 'z') { w = sizeX * 1.05; h = sizeY * 1.05; }

        if (!activeCapMesh) {
            if (window.THREE && window.THREE.PlaneGeometry && window.THREE.Mesh && window.THREE.MeshStandardMaterial) {
                const geom = new window.THREE.PlaneGeometry(w, h);
                const mat = new window.THREE.MeshStandardMaterial({
                    color: 0x334155, // SolidWorks / CAD slate section color
                    roughness: 0.65,
                    metalness: 0.2,
                    side: window.THREE.DoubleSide || 2
                });
                activeCapMesh = new window.THREE.Mesh(geom, mat);
                viewer.scene.add(activeCapMesh);
            }
        } else {
            if (activeCapMesh.geometry) {
                activeCapMesh.geometry.dispose();
                if (window.THREE && window.THREE.PlaneGeometry) {
                    activeCapMesh.geometry = new window.THREE.PlaneGeometry(w, h);
                }
            }
        }

        if (activeCapMesh) {
            if (currentAxis === 'x') {
                activeCapMesh.position.set(currentOffset, centerY, centerZ);
                activeCapMesh.rotation.set(0, Math.PI / 2, 0);
            } else if (currentAxis === 'y') {
                activeCapMesh.position.set(centerX, currentOffset, centerZ);
                activeCapMesh.rotation.set(Math.PI / 2, 0, 0);
            } else if (currentAxis === 'z') {
                activeCapMesh.position.set(centerX, centerY, currentOffset);
                activeCapMesh.rotation.set(0, 0, 0);
            }
            if (activeCapMesh.matrixWorldNeedsUpdate !== undefined) {
                activeCapMesh.matrixWorldNeedsUpdate = true;
            }
        }
    }

    function applyClipping() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.renderer) return;

        if (!sectionActive) {
            viewer.renderer.clippingPlanes = [];
            viewer.renderer.localClippingEnabled = false;
            updateCapMesh(null, null, 0);
            viewer.Render();
            return;
        }

        viewer.renderer.localClippingEnabled = true;

        const sign = inverted ? 1 : -1;
        let nx = 0, ny = 0, nz = 0;
        if (currentAxis === 'x') nx = sign;
        else if (currentAxis === 'y') ny = sign;
        else if (currentAxis === 'z') nz = sign;

        const constant = inverted ? -currentOffset : currentOffset;
        let plane;
        if (window.THREE && window.THREE.Plane && window.THREE.Vector3) {
            plane = new window.THREE.Plane(new window.THREE.Vector3(nx, ny, nz), constant);
        } else {
            plane = new ClippingPlane({ x: nx, y: ny, z: nz }, constant);
        }
        viewer.renderer.clippingPlanes = [plane];

        // Ensure materials compile with clipping enabled
        if (viewer.mainModel && viewer.mainModel.scene) {
            viewer.mainModel.scene.traverse((obj) => {
                if (obj.material && obj !== activeCapMesh) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.needsUpdate = true);
                    } else {
                        obj.material.needsUpdate = true;
                    }
                }
            });
        }

        const bounds = getModelBounds();
        updateCapMesh(bounds, { x: nx, y: ny, z: nz }, sign);

        viewer.Render();
    }

    function updateSliderRange() {
        const bounds = getModelBounds();
        const minVal = bounds.min[currentAxis];
        const maxVal = bounds.max[currentAxis];
        const span = maxVal - minVal;

        if (sliderEl) {
            sliderEl.min = (minVal - span * 0.05).toFixed(2);
            sliderEl.max = (maxVal + span * 0.05).toFixed(2);
            sliderEl.step = (span / 200).toFixed(3);
            sliderEl.value = currentOffset.toFixed(2);
        }

        if (valueDisplayEl) {
            valueDisplayEl.textContent = `${currentAxis.toUpperCase()}: ${currentOffset.toFixed(2)}`;
        }
    }

    function selectAxis(axis) {
        currentAxis = axis;
        const bounds = getModelBounds();
        currentOffset = (bounds.min[axis] + bounds.max[axis]) / 2;

        Object.keys(axisButtons).forEach(k => {
            if (axisButtons[k]) {
                if (k === axis) {
                    axisButtons[k].classList.add('active');
                } else {
                    axisButtons[k].classList.remove('active');
                }
            }
        });

        updateSliderRange();
        applyClipping();
    }

    function createHUD() {
        if (hudElement) return;

        hudElement = document.createElement('div');
        hudElement.className = 'gmc_section_hud';
        hudElement.innerHTML = `
            <div class="gmc_hud_header">
                <span class="gmc_hud_title">
                    <span class="gmc_hud_icon"></span>
                    Section View
                </span>
                <button class="gmc_hud_close" title="Close Section View">&times;</button>
            </div>
            <div class="gmc_hud_body">
                <div class="gmc_axis_row">
                    <span class="gmc_label">Axis:</span>
                    <button class="gmc_axis_btn" data-axis="x">X</button>
                    <button class="gmc_axis_btn active" data-axis="y">Y</button>
                    <button class="gmc_axis_btn" data-axis="z">Z</button>
                    <button class="gmc_flip_btn" title="Flip Cutting Direction">⇄ Flip</button>
                </div>
                <div class="gmc_slider_row">
                    <input type="range" class="gmc_section_slider" min="-10" max="10" step="0.1" value="0">
                    <span class="gmc_offset_value">Y: 0.00</span>
                </div>
                <div class="gmc_cap_row">
                    <label class="gmc_cap_toggle">
                        <input type="checkbox" class="gmc_cap_chk" checked>
                        <span class="gmc_cap_label">Solid Part (CAD Cap)</span>
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(hudElement);

        // Bind events
        hudElement.querySelector('.gmc_hud_close').addEventListener('click', () => {
            setSectionActive(false);
        });

        const btns = hudElement.querySelectorAll('.gmc_axis_btn');
        btns.forEach(btn => {
            const ax = btn.getAttribute('data-axis');
            axisButtons[ax] = btn;
            btn.addEventListener('click', () => selectAxis(ax));
        });

        const flipBtn = hudElement.querySelector('.gmc_flip_btn');
        flipBtn.addEventListener('click', () => {
            inverted = !inverted;
            flipBtn.classList.toggle('active', inverted);
            applyClipping();
        });

        sliderEl = hudElement.querySelector('.gmc_section_slider');
        valueDisplayEl = hudElement.querySelector('.gmc_offset_value');
        capCheckboxEl = hudElement.querySelector('.gmc_cap_chk');

        sliderEl.addEventListener('input', (e) => {
            currentOffset = parseFloat(e.target.value);
            valueDisplayEl.textContent = `${currentAxis.toUpperCase()}: ${currentOffset.toFixed(2)}`;
            applyClipping();
        });

        capCheckboxEl.addEventListener('change', (e) => {
            solidCapEnabled = e.target.checked;
            applyClipping();
        });
    }

    function setSectionActive(active) {
        sectionActive = active;
        if (!hudElement) createHUD();

        const toolbarBtn = document.querySelector('.ov_toolbar_button[title="Section View"], .ov_toolbar_button[title="Section view"]');
        if (toolbarBtn) {
            toolbarBtn.classList.toggle('selected', sectionActive);
        }

        if (sectionActive) {
            hudElement.style.display = 'block';
            selectAxis(currentAxis);
        } else {
            hudElement.style.display = 'none';
            applyClipping();
        }
    }

    // Auto-hide when leaving model view (Hash change, back navigation, or Intro state)
    function checkModelActiveState() {
        const hash = window.location.hash || '';
        const hasModelInHash = hash.includes('model=');
        const introVisible = document.querySelector('#intro')?.style?.display !== 'none';
        
        if (!hasModelInHash || introVisible) {
            if (sectionActive) {
                setSectionActive(false);
            }
        }
    }

    window.addEventListener('hashchange', checkModelActiveState);
    window.addEventListener('popstate', checkModelActiveState);
    window.addEventListener('gmc_ui_state_changed', (e) => {
        if (e.detail && e.detail.state !== 2) { // 2 = ss.Model
            setSectionActive(false);
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
                    'section',
                    'Section View',
                    ['only_full_width', 'only_on_model'],
                    () => {
                        if (pluginInterface.getViewer) {
                            activeViewer = pluginInterface.getViewer();
                        }
                        setSectionActive(!sectionActive);
                    }
                );
            }
        });
    }

    window.gmcSetSectionActive = setSectionActive;
})();
