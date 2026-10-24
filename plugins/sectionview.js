/**
 * GMC 3D Viewer - Section View Plugin
 * Interactive Cross-Sectioning / Clipping Plane Tool with Solid CAD Capping
 * Uses WebGL Stencil Buffer for true SolidWorks / CAD-grade cross-section rendering
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
    let activeStencilGroup = null;
    let activePlane = null;

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

    function applyMaterialClipping(mat, planes) {
        if (!mat) return;
        if (Array.isArray(mat)) {
            mat.forEach(m => applyMaterialClipping(m, planes));
        } else {
            mat.clippingPlanes = planes;
            mat.clipShadows = true;
            mat.needsUpdate = true;
        }
    }

    function setModelClipping(planes) {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.mainModel) return;

        viewer.mainModel.EnumerateMeshes((mesh) => {
            if (mesh === activeCapMesh) return;
            if (mesh.material) {
                applyMaterialClipping(mesh.material, planes);
            }
            if (mesh.userData && mesh.userData.threeMaterials) {
                applyMaterialClipping(mesh.userData.threeMaterials, planes);
            }
        });

        if (viewer.scene) {
            viewer.scene.traverse((obj) => {
                if ((obj.isLineSegments || obj.isLine) && obj.material && obj !== activeCapMesh) {
                    applyMaterialClipping(obj.material, planes);
                }
            });
        }
    }

    function clearStencilGroup() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.scene) return;
        if (activeStencilGroup) {
            viewer.scene.remove(activeStencilGroup);
            activeStencilGroup.traverse((child) => {
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            activeStencilGroup = null;
        }
    }

    function clearCapMesh() {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.scene) return;
        if (activeCapMesh) {
            viewer.scene.remove(activeCapMesh);
            if (activeCapMesh.geometry) activeCapMesh.geometry.dispose();
            if (activeCapMesh.material) activeCapMesh.material.dispose();
            activeCapMesh = null;
        }
    }

    function ensureHighlightHook() {
        const viewer = getViewerInstance();
        if (viewer && !viewer._gmcSectionHighlightHooked && viewer.SetMeshesHighlight) {
            viewer._gmcSectionHighlightHooked = true;
            const origSetMeshesHighlight = viewer.SetMeshesHighlight;
            viewer.SetMeshesHighlight = function () {
                origSetMeshesHighlight.apply(this, arguments);
                if (sectionActive && activePlane) {
                    setModelClipping([activePlane]);
                }
            };
        }
    }

    function buildStencilGroup(plane) {
        clearStencilGroup();
        const viewer = getViewerInstance();
        if (!viewer || !viewer.scene || !sectionActive || !solidCapEnabled || !window.THREE) return;

        const THREE = window.THREE;
        if (!THREE.Group || !THREE.MeshBasicMaterial || !THREE.Mesh) return;

        // Ensure world matrices of main model are fresh
        if (viewer.mainModel && viewer.mainModel.UpdateWorldMatrix) {
            viewer.mainModel.UpdateWorldMatrix();
        }

        const stencilGroup = new THREE.Group();
        stencilGroup.name = 'gmc_section_stencil_group';

        const baseMat = new THREE.MeshBasicMaterial();
        baseMat.depthWrite = false;
        baseMat.depthTest = false;
        baseMat.colorWrite = false;
        baseMat.stencilWrite = true;
        baseMat.stencilFunc = THREE.AlwaysStencilFunc || 519;

        // Back faces: increment stencil buffer
        const matBack = baseMat.clone();
        matBack.side = THREE.BackSide !== undefined ? THREE.BackSide : 1;
        matBack.clippingPlanes = [plane];
        matBack.stencilFail = THREE.IncrementWrapStencilOp || 34055;
        matBack.stencilZFail = THREE.IncrementWrapStencilOp || 34055;
        matBack.stencilZPass = THREE.IncrementWrapStencilOp || 34055;

        // Front faces: decrement stencil buffer
        const matFront = baseMat.clone();
        matFront.side = THREE.FrontSide !== undefined ? THREE.FrontSide : 0;
        matFront.clippingPlanes = [plane];
        matFront.stencilFail = THREE.DecrementWrapStencilOp || 34056;
        matFront.stencilZFail = THREE.DecrementWrapStencilOp || 34056;
        matFront.stencilZPass = THREE.DecrementWrapStencilOp || 34056;

        viewer.mainModel.EnumerateMeshes((mesh) => {
            if (!mesh.geometry || mesh === activeCapMesh) return;

            const bMesh = new THREE.Mesh(mesh.geometry, matBack);
            bMesh.matrix.copy(mesh.matrixWorld);
            bMesh.matrixAutoUpdate = false;
            bMesh.renderOrder = 1;
            stencilGroup.add(bMesh);

            const fMesh = new THREE.Mesh(mesh.geometry, matFront);
            fMesh.matrix.copy(mesh.matrixWorld);
            fMesh.matrixAutoUpdate = false;
            fMesh.renderOrder = 1;
            stencilGroup.add(fMesh);
        });

        viewer.scene.add(stencilGroup);
        activeStencilGroup = stencilGroup;
    }

    function updateCapMesh(plane) {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.scene || !window.THREE) return;

        if (!sectionActive || !solidCapEnabled) {
            clearCapMesh();
            return;
        }

        const THREE = window.THREE;
        const bounds = getModelBounds();
        const sizeX = Math.max(bounds.max.x - bounds.min.x, 2);
        const sizeY = Math.max(bounds.max.y - bounds.min.y, 2);
        const sizeZ = Math.max(bounds.max.z - bounds.min.z, 2);
        const maxDim = Math.max(sizeX, sizeY, sizeZ, 10) * 4;

        if (!activeCapMesh) {
            const geom = new THREE.PlaneGeometry(maxDim, maxDim);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x475569, // Clean SolidWorks/CAD slate gray
                roughness: 0.65,
                metalness: 0.15,
                stencilWrite: true,
                stencilRef: 0,
                stencilFunc: THREE.NotEqualStencilFunc || 517,
                stencilFail: THREE.ReplaceStencilOp || 7681,
                stencilZFail: THREE.ReplaceStencilOp || 7681,
                stencilZPass: THREE.ReplaceStencilOp || 7681,
                side: THREE.DoubleSide !== undefined ? THREE.DoubleSide : 2
            });
            activeCapMesh = new THREE.Mesh(geom, mat);
            activeCapMesh.renderOrder = 2;
            activeCapMesh.onAfterRender = function (renderer) {
                if (renderer && renderer.clearStencil) {
                    renderer.clearStencil();
                }
            };
            viewer.scene.add(activeCapMesh);
        }

        if (activeCapMesh && plane) {
            plane.coplanarPoint(activeCapMesh.position);
            activeCapMesh.lookAt(
                activeCapMesh.position.x - plane.normal.x,
                activeCapMesh.position.y - plane.normal.y,
                activeCapMesh.position.z - plane.normal.z
            );
            activeCapMesh.updateMatrix();
            activeCapMesh.updateMatrixWorld();
        }
    }

    function applyClipping(rebuildStencil = false) {
        const viewer = getViewerInstance();
        if (!viewer || !viewer.renderer) return;

        ensureHighlightHook();

        if (!sectionActive) {
            viewer.renderer.localClippingEnabled = false;
            viewer.renderer.clippingPlanes = [];
            setModelClipping(null);
            clearStencilGroup();
            clearCapMesh();
            activePlane = null;
            viewer.Render();
            return;
        }

        viewer.renderer.localClippingEnabled = true;
        viewer.renderer.clippingPlanes = [];

        const sign = inverted ? 1 : -1;
        let nx = 0, ny = 0, nz = 0;
        if (currentAxis === 'x') nx = sign;
        else if (currentAxis === 'y') ny = sign;
        else if (currentAxis === 'z') nz = sign;

        const constant = inverted ? -currentOffset : currentOffset;

        if (!activePlane) {
            if (window.THREE && window.THREE.Plane && window.THREE.Vector3) {
                activePlane = new window.THREE.Plane(new window.THREE.Vector3(nx, ny, nz), constant);
            }
        } else {
            activePlane.normal.set(nx, ny, nz);
            activePlane.constant = constant;
        }

        setModelClipping([activePlane]);

        if (solidCapEnabled) {
            if (rebuildStencil || !activeStencilGroup) {
                buildStencilGroup(activePlane);
            }
            updateCapMesh(activePlane);
        } else {
            clearStencilGroup();
            clearCapMesh();
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
        applyClipping(true); // Rebuild stencil on axis change
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
            applyClipping(true);
        });

        sliderEl = hudElement.querySelector('.gmc_section_slider');
        valueDisplayEl = hudElement.querySelector('.gmc_offset_value');
        capCheckboxEl = hudElement.querySelector('.gmc_cap_chk');

        sliderEl.addEventListener('input', (e) => {
            currentOffset = parseFloat(e.target.value);
            valueDisplayEl.textContent = `${currentAxis.toUpperCase()}: ${currentOffset.toFixed(2)}`;
            applyClipping(false); // Fast update on drag without rebuilding stencil group
        });

        capCheckboxEl.addEventListener('change', (e) => {
            solidCapEnabled = e.target.checked;
            applyClipping(true);
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
