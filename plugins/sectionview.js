/**
 * GMC 3D Viewer - Section View Plugin
 * Interactive Cross-Sectioning / Clipping Plane Tool
 */
(function () {
    let sectionActive = false;
    let currentAxis = 'y'; // 'x', 'y', 'z'
    let currentOffset = 0;
    let inverted = false;
    let hudElement = null;
    let sliderEl = null;
    let valueDisplayEl = null;
    let axisButtons = {};
    let activeViewer = null;
    let currentModel = null;
    let planeHelper = null;

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

    function applyClipping() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.renderer) return;

        if (!sectionActive) {
            viewer.renderer.clippingPlanes = [];
            viewer.renderer.localClippingEnabled = false;
            if (planeHelper && viewer.scene) {
                viewer.scene.remove(planeHelper);
                planeHelper = null;
            }
            viewer.Render();
            return;
        }

        viewer.renderer.localClippingEnabled = true;

        const sign = inverted ? 1 : -1;
        let nx = 0, ny = 0, nz = 0;
        if (currentAxis === 'x') nx = sign;
        else if (currentAxis === 'y') ny = sign;
        else if (currentAxis === 'z') nz = sign;

        // Plane equation in Three.js: dot(v, normal) + constant >= 0 are kept
        // If sign is -1 (cutting from top down to offset):
        // dot(v, -axis) + offset >= 0  => -v_axis + offset >= 0  => v_axis <= offset
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
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.needsUpdate = true);
                    } else {
                        obj.material.needsUpdate = true;
                    }
                }
            });
        }

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

        sliderEl.addEventListener('input', (e) => {
            currentOffset = parseFloat(e.target.value);
            valueDisplayEl.textContent = `${currentAxis.toUpperCase()}: ${currentOffset.toFixed(2)}`;
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
})();
