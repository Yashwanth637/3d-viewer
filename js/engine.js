/**
 * ViewerEngine — A complete 3D model viewer engine built on Three.js.
 * Replicates core functionality of https://3dviewer.net
 *
 * Features:
 *   - Multi-format model loading (GLTF, OBJ, STL, FBX, PLY, 3DM, DAE, 3MF)
 *   - OrbitControls with smooth camera transitions
 *   - Raycasting mesh selection with highlight
 *   - Grid, axes, wireframe, edge rendering toggles
 *   - Perspective / orthographic camera switching
 *   - Pre-defined camera views with animation
 *   - Screenshot export and model statistics
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/* ------------------------------------------------------------------ */
/*  ViewerEngine                                                       */
/* ------------------------------------------------------------------ */
class ViewerEngine {

    /* ============================================================== */
    /*  Construction & Initialisation                                  */
    /* ============================================================== */

    /**
     * @param {HTMLElement} container  — DOM element that will hold the canvas.
     * @param {object}      [opts]    — Optional overrides.
     */
    constructor(container, opts = {}) {
        if (!container) throw new Error('ViewerEngine: a container element is required.');
        this.container = container;

        /* ----- settings (public, mutable) ----- */
        this.settings = {
            backgroundColor:   opts.backgroundColor   ?? '#3c3c3c',
            backgroundGradient: opts.backgroundGradient ?? true,
            defaultMaterialColor: opts.defaultMaterialColor ?? '#cccccc',
            showGrid:           opts.showGrid           ?? true,
            showAxes:           opts.showAxes           ?? false,
            showEdges:          opts.showEdges          ?? false,
            wireframe:          opts.wireframe          ?? false,
            upVector:           opts.upVector           ?? 'Y',   // 'Y' | 'Z'
            gridSize:           opts.gridSize           ?? 10,
            gridDivisions:      opts.gridDivisions      ?? 20,
        };

        /* ----- internal state ----- */
        this._clock          = new THREE.Clock();
        this._mixer          = null;          // AnimationMixer
        this._animations     = [];            // AnimationClips
        this._model          = null;          // currently loaded root Object3D
        this._edgeGroup      = null;          // edge‐wireframe line group
        this._selectedMesh   = null;
        this._prevMaterials  = new Map();     // for highlight restore
        this._cameraAnim     = null;          // ongoing camera transition
        this._animFrameId    = null;
        this._isOrtho        = false;
        this._disposed       = false;

        /* ----- build scene graph ----- */
        this._initRenderer();
        this._initScene();
        this._initCamera();
        this._initControls();
        this._initLights();
        this._initHelpers();
        this._initRaycaster();

        /* ----- start the loop ----- */
        this._onResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._onResize);
        this._animate();
    }

    /* ============================================================== */
    /*  Renderer                                                       */
    /* ============================================================== */

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
    }

    /* ============================================================== */
    /*  Scene                                                          */
    /* ============================================================== */

    _initScene() {
        this.scene = new THREE.Scene();
        this._applyBackground();
    }

    /** Generate a vertical gradient canvas and apply as scene background. */
    _applyBackground() {
        if (this.settings.backgroundGradient) {
            const canvas  = document.createElement('canvas');
            canvas.width  = 2;
            canvas.height = 512;
            const ctx     = canvas.getContext('2d');
            const grad    = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, '#5a5a6e');   // top   — slightly blue‑gray
            grad.addColorStop(1, '#2a2a2e');   // bottom — dark charcoal
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 2, 512);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = tex;
        } else {
            this.scene.background = new THREE.Color(this.settings.backgroundColor);
        }
    }

    /* ============================================================== */
    /*  Camera                                                         */
    /* ============================================================== */

    _initCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10000);
        this.perspCamera.position.set(5, 5, 5);

        const frustum = 5;
        this.orthoCamera = new THREE.OrthographicCamera(
            -frustum * aspect, frustum * aspect,
            frustum, -frustum,
            0.01, 10000
        );
        this.orthoCamera.position.copy(this.perspCamera.position);

        this.camera = this.perspCamera;
    }

    /* ============================================================== */
    /*  Controls                                                       */
    /* ============================================================== */

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping  = true;
        this.controls.dampingFactor  = 0.08;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance    = 0.1;
        this.controls.maxDistance    = 5000;
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /* ============================================================== */
    /*  Lights                                                         */
    /* ============================================================== */

    _initLights() {
        // Ambient
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);

        // Hemisphere (natural sky/ground fill)
        this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.6);
        this.scene.add(this.hemiLight);

        // Key directional
        this.keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.keyLight.position.set(5, 10, 7);
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.width  = 2048;
        this.keyLight.shadow.mapSize.height = 2048;
        this.scene.add(this.keyLight);

        // Fill directional
        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        this.fillLight.position.set(-5, 3, -5);
        this.scene.add(this.fillLight);
    }

    /* ============================================================== */
    /*  Helpers (grid + axes)                                          */
    /* ============================================================== */

    _initHelpers() {
        // Grid
        this.gridHelper = new THREE.GridHelper(
            this.settings.gridSize,
            this.settings.gridDivisions,
            0x888888,
            0x444444
        );
        this.gridHelper.material.opacity = 0.25;
        this.gridHelper.material.transparent = true;
        this.gridHelper.visible = this.settings.showGrid;
        this.scene.add(this.gridHelper);

        // Axes
        this.axesHelper = new THREE.AxesHelper(this.settings.gridSize * 0.5);
        this.axesHelper.visible = this.settings.showAxes;
        this.scene.add(this.axesHelper);
    }

    /* ============================================================== */
    /*  Raycaster                                                      */
    /* ============================================================== */

    _initRaycaster() {
        this._raycaster = new THREE.Raycaster();
        this._pointer   = new THREE.Vector2();
        this._onPointerDown = this._handlePointerDown.bind(this);
        this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    }

    /* ============================================================== */
    /*  Model Loading                                                  */
    /* ============================================================== */

    /**
     * Load a 3D model.
     *
     * @param {string|File} source        — URL string **or** a File object.
     * @param {object}      [opts]
     * @param {Function}    [opts.onProgress] — (event) => void
     * @param {string}      [opts.fileName]   — override filename for format detection
     * @param {string}      [opts.mtlSource]  — URL or File for companion .mtl (OBJ)
     * @returns {Promise<THREE.Object3D>}
     */
    async loadModel(source, opts = {}) {
        const fileName = opts.fileName
            || (source instanceof File ? source.name : source.split('?')[0].split('/').pop());
        const ext = fileName.split('.').pop().toLowerCase();

        /* If source is a File, create an Object URL */
        let url;
        let revokeUrl = false;
        if (source instanceof File) {
            url = URL.createObjectURL(source);
            revokeUrl = true;
        } else {
            url = source;
        }

        const onProgress = opts.onProgress || (() => {});

        let object;

        try {
            switch (ext) {
                case 'gltf':
                case 'glb':
                    object = await this._loadGLTF(url, onProgress);
                    break;
                case 'obj':
                    object = await this._loadOBJ(url, opts.mtlSource, onProgress);
                    break;
                case 'stl':
                    object = await this._loadSTL(url, onProgress);
                    break;
                case 'fbx':
                    object = await this._loadFBX(url, onProgress);
                    break;
                case 'ply':
                    object = await this._loadPLY(url, onProgress);
                    break;
                case '3dm':
                    object = await this._load3DM(url, onProgress);
                    break;
                case 'dae':
                    object = await this._loadDAE(url, onProgress);
                    break;
                case '3mf':
                    object = await this._load3MF(url, onProgress);
                    break;
                default:
                    throw new Error(`Unsupported format: .${ext}`);
            }
        } finally {
            if (revokeUrl) URL.revokeObjectURL(url);
        }

        /* Remove previous model */
        this.removeModel();

        /* Adjust for Z‑up models */
        if (this.settings.upVector === 'Z') {
            object.rotation.x = -Math.PI / 2;
            object.updateMatrixWorld(true);
        }

        /* Add to scene */
        this._model = object;
        this._model.name = this._model.name || fileName;
        this.scene.add(this._model);

        /* Apply default wireframe setting */
        if (this.settings.wireframe) this._applyWireframe(true);
        if (this.settings.showEdges) this._applyEdges(true);

        /* Ensure every mesh has a material */
        this._ensureMaterials(this._model);

        /* Auto‑fit camera */
        this.fitToView();

        /* Auto‑scale grid to model size */
        this._autoScaleGrid();

        return this._model;
    }

    /* ---- Individual loaders ---- */

    _loadGLTF(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();

            // Draco decoder
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
            dracoLoader.setDecoderConfig({ type: 'js' });
            loader.setDRACOLoader(dracoLoader);

            // KTX2 texture support
            try {
                const ktx2Loader = new KTX2Loader();
                ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/libs/basis/');
                ktx2Loader.detectSupport(this.renderer);
                loader.setKTX2Loader(ktx2Loader);
            } catch (_) { /* KTX2 optional */ }

            // Meshopt decoder
            try {
                loader.setMeshoptDecoder(MeshoptDecoder);
            } catch (_) { /* meshopt optional */ }

            loader.load(url, (gltf) => {
                if (gltf.animations && gltf.animations.length > 0) {
                    this._animations = gltf.animations;
                    this._mixer = new THREE.AnimationMixer(gltf.scene);
                    this._animations.forEach(clip => {
                        this._mixer.clipAction(clip).play();
                    });
                }
                resolve(gltf.scene);
            }, onProgress, reject);
        });
    }

    _loadOBJ(url, mtlSource, onProgress) {
        return new Promise(async (resolve, reject) => {
            try {
                let materials = null;
                if (mtlSource) {
                    const mtlUrl = mtlSource instanceof File
                        ? URL.createObjectURL(mtlSource) : mtlSource;
                    const mtlLoader = new MTLLoader();
                    materials = await new Promise((res, rej) => {
                        mtlLoader.load(mtlUrl, res, undefined, rej);
                    });
                    materials.preload();
                    if (mtlSource instanceof File) URL.revokeObjectURL(mtlUrl);
                }
                const loader = new OBJLoader();
                if (materials) loader.setMaterials(materials);
                loader.load(url, resolve, onProgress, reject);
            } catch (e) {
                reject(e);
            }
        });
    }

    _loadSTL(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new STLLoader();
            loader.load(url, (geometry) => {
                geometry.computeVertexNormals();
                const mat  = new THREE.MeshStandardMaterial({
                    color: this.settings.defaultMaterialColor,
                    metalness: 0.2,
                    roughness: 0.6,
                    flatShading: false,
                });
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.castShadow    = true;
                mesh.receiveShadow = true;
                const group = new THREE.Group();
                group.add(mesh);
                resolve(group);
            }, onProgress, reject);
        });
    }

    _loadFBX(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new FBXLoader();
            loader.load(url, (object) => {
                if (object.animations && object.animations.length > 0) {
                    this._animations = object.animations;
                    this._mixer = new THREE.AnimationMixer(object);
                    this._animations.forEach(clip => {
                        this._mixer.clipAction(clip).play();
                    });
                }
                resolve(object);
            }, onProgress, reject);
        });
    }

    _loadPLY(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new PLYLoader();
            loader.load(url, (geometry) => {
                geometry.computeVertexNormals();
                let mat;
                if (geometry.hasAttribute('color')) {
                    mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.6 });
                } else {
                    mat = new THREE.MeshStandardMaterial({
                        color: this.settings.defaultMaterialColor,
                        metalness: 0.2,
                        roughness: 0.6,
                    });
                }
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.castShadow    = true;
                mesh.receiveShadow = true;
                const group = new THREE.Group();
                group.add(mesh);
                resolve(group);
            }, onProgress, reject);
        });
    }

    _load3DM(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new Rhino3dmLoader();
            loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/');
            loader.load(url, resolve, onProgress, reject);
        });
    }

    _loadDAE(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new ColladaLoader();
            loader.load(url, (collada) => {
                if (collada.animations && collada.animations.length > 0) {
                    this._animations = collada.animations;
                    this._mixer = new THREE.AnimationMixer(collada.scene);
                    this._animations.forEach(clip => {
                        this._mixer.clipAction(clip).play();
                    });
                }
                resolve(collada.scene);
            }, onProgress, reject);
        });
    }

    _load3MF(url, onProgress) {
        return new Promise((resolve, reject) => {
            const loader = new ThreeMFLoader();
            loader.load(url, resolve, onProgress, reject);
        });
    }

    /* ============================================================== */
    /*  Model Helpers                                                   */
    /* ============================================================== */

    /** Remove the current model from the scene and dispose resources. */
    removeModel() {
        if (this._model) {
            this.deselectMesh();
            this._removeEdges();
            this._disposeObject(this._model);
            this.scene.remove(this._model);
            this._model = null;
        }
        if (this._mixer) {
            this._mixer.stopAllAction();
            this._mixer = null;
            this._animations = [];
        }
    }

    /** Create a built-in sample geometry. */
    createProceduralSample(type = 'cube') {
        this.removeModel();
        let geom;
        const mat = new THREE.MeshStandardMaterial({
            color: 0x178bc5,
            metalness: 0.25,
            roughness: 0.45
        });
        const t = (type || '').toLowerCase();
        if (t === 'torus' || t === 'knot') {
            geom = new THREE.TorusKnotGeometry(1.5, 0.45, 128, 32);
        } else if (t === 'cylinder') {
            geom = new THREE.CylinderGeometry(1.2, 1.2, 2.5, 32);
        } else if (t === 'sphere') {
            geom = new THREE.SphereGeometry(1.5, 32, 32);
        } else if (t === 'dodecahedron') {
            geom = new THREE.DodecahedronGeometry(1.5);
        } else {
            geom = new THREE.BoxGeometry(2, 2, 2);
        }
        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = `Sample_${type}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this._model = mesh;
        this.scene.add(this._model);
        if (this.settings.wireframe) this._applyWireframe(true);
        if (this.settings.showEdges) this._applyEdges(true);
        this.fitToView();
        this._autoScaleGrid();
        return this._model;
    }

    /** Ensure every mesh has a material (fallback). */
    _ensureMaterials(root) {
        root.traverse((child) => {
            if (child.isMesh) {
                if (!child.material) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: this.settings.defaultMaterialColor,
                        metalness: 0.2,
                        roughness: 0.6,
                    });
                }
                child.castShadow    = true;
                child.receiveShadow = true;
            }
        });
    }

    /** Recursively dispose geometry + materials. */
    _disposeObject(obj) {
        obj.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    if (m.map) m.map.dispose();
                    if (m.normalMap) m.normalMap.dispose();
                    if (m.roughnessMap) m.roughnessMap.dispose();
                    if (m.metalnessMap) m.metalnessMap.dispose();
                    if (m.emissiveMap) m.emissiveMap.dispose();
                    if (m.aoMap) m.aoMap.dispose();
                    m.dispose();
                });
            }
        });
    }

    /** Auto‑scale grid based on loaded model's bounding box. */
    _autoScaleGrid() {
        if (!this._model) return;
        const box  = new THREE.Box3().setFromObject(this._model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1);
        const gridSize = Math.pow(10, Math.ceil(Math.log10(maxDim * 2)));
        this.gridHelper.geometry.dispose();
        const newGrid = new THREE.GridHelper(gridSize, this.settings.gridDivisions, 0x888888, 0x444444);
        this.gridHelper.geometry = newGrid.geometry;
        this.gridHelper.material.opacity = 0.25;
        this.gridHelper.material.transparent = true;
        newGrid.material.dispose(); // we stole the geometry, dispose original material
    }

    /* ============================================================== */
    /*  Camera — Fit / Reset / Views                                   */
    /* ============================================================== */

    /** Fit the camera so the entire model is visible with some padding. */
    fitToView(padding = 1.5) {
        const target = this._model || this.scene;
        const box    = new THREE.Box3().setFromObject(target);
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const fov       = this.perspCamera.fov * (Math.PI / 180);
        const distance  = (maxDim / 2) / Math.tan(fov / 2) * padding;
        const direction = this.camera.position.clone().sub(this.controls.target).normalize();

        const newPos = center.clone().add(direction.multiplyScalar(distance));
        this._animateCamera(newPos, center);

        // Update ortho frustum
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const half   = maxDim * padding * 0.5;
        this.orthoCamera.left   = -half * aspect;
        this.orthoCamera.right  =  half * aspect;
        this.orthoCamera.top    =  half;
        this.orthoCamera.bottom = -half;
        this.orthoCamera.updateProjectionMatrix();

        // Update shadow camera to cover model
        const shadowPad = maxDim * 2;
        this.keyLight.shadow.camera.left   = -shadowPad;
        this.keyLight.shadow.camera.right  =  shadowPad;
        this.keyLight.shadow.camera.top    =  shadowPad;
        this.keyLight.shadow.camera.bottom = -shadowPad;
        this.keyLight.shadow.camera.far    = shadowPad * 4;
        this.keyLight.shadow.camera.updateProjectionMatrix();
        this.keyLight.position.copy(center).add(new THREE.Vector3(maxDim, maxDim * 2, maxDim));
    }

    /** Reset camera to the default position. */
    resetCamera() {
        this._animateCamera(new THREE.Vector3(5, 5, 5), new THREE.Vector3(0, 0, 0));
    }

    /** Switch between perspective and orthographic cameras. */
    toggleProjection() {
        this._isOrtho = !this._isOrtho;
        const prev = this.camera;

        if (this._isOrtho) {
            this.orthoCamera.position.copy(prev.position);
            this.orthoCamera.quaternion.copy(prev.quaternion);
            this.camera = this.orthoCamera;
        } else {
            this.perspCamera.position.copy(prev.position);
            this.perspCamera.quaternion.copy(prev.quaternion);
            this.camera = this.perspCamera;
        }

        this.camera.updateProjectionMatrix();
        this.controls.object = this.camera;
        this.controls.update();
        return this._isOrtho ? 'orthographic' : 'perspective';
    }

    /**
     * Set a pre‑defined camera view.
     * @param {'front'|'back'|'left'|'right'|'top'|'bottom'} view
     */
    setView(view) {
        if (!this._model) return;
        const box    = new THREE.Box3().setFromObject(this._model);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist   = maxDim * 2;

        const offsets = {
            front:  new THREE.Vector3(0, 0,  dist),
            back:   new THREE.Vector3(0, 0, -dist),
            left:   new THREE.Vector3(-dist, 0, 0),
            right:  new THREE.Vector3( dist, 0, 0),
            top:    new THREE.Vector3(0,  dist, 0),
            bottom: new THREE.Vector3(0, -dist, 0),
        };

        const offset = offsets[view];
        if (!offset) return;
        this._animateCamera(center.clone().add(offset), center);
    }

    /* ---- Smooth camera transition ---- */

    _animateCamera(targetPos, targetLookAt, duration = 600) {
        const startPos    = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const startTime   = performance.now();

        /* Cancel any previous animation */
        if (this._cameraAnim) cancelAnimationFrame(this._cameraAnim);

        const step = (now) => {
            let t = Math.min((now - startTime) / duration, 1);
            /* Ease‑out cubic */
            t = 1 - Math.pow(1 - t, 3);

            this.camera.position.lerpVectors(startPos, targetPos, t);
            this.controls.target.lerpVectors(startTarget, targetLookAt, t);
            this.controls.update();

            if (t < 1) {
                this._cameraAnim = requestAnimationFrame(step);
            } else {
                this._cameraAnim = null;
            }
        };
        this._cameraAnim = requestAnimationFrame(step);
    }

    /* ============================================================== */
    /*  Raycasting & Selection                                         */
    /* ============================================================== */

    _handlePointerDown(event) {
        /* Only respond to left-click, and check if it's a "click" (not drag start).
           We do this by also listening for pointerup and comparing distance. */
        if (event.button !== 0) return;

        const startX = event.clientX;
        const startY = event.clientY;

        const onUp = (e) => {
            this.renderer.domElement.removeEventListener('pointerup', onUp);
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.sqrt(dx * dx + dy * dy) < 4) {
                this._pick(e);
            }
        };
        this.renderer.domElement.addEventListener('pointerup', onUp, { once: true });
    }

    _pick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._pointer.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        this._pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._pointer, this.camera);

        const meshes = [];
        if (this._model) {
            this._model.traverse(c => { if (c.isMesh) meshes.push(c); });
        }

        const hits = this._raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
            this.selectMesh(hits[0].object);
        } else {
            this.deselectMesh();
        }
    }

    /**
     * Highlight a specific mesh.
     * @param {THREE.Mesh} mesh
     */
    selectMesh(mesh) {
        if (this._selectedMesh === mesh) return;
        this.deselectMesh();

        this._selectedMesh = mesh;

        /* Store original materials and apply highlight */
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const highlighted = mats.map(m => {
            const clone = m.clone();
            clone.emissive = new THREE.Color(0x335599);
            clone.emissiveIntensity = 0.4;
            return clone;
        });
        this._prevMaterials.set(mesh, mesh.material);
        mesh.material = highlighted.length === 1 ? highlighted[0] : highlighted;

        /* Dispatch custom event */
        this.container.dispatchEvent(new CustomEvent('mesh-selected', { detail: this.getMeshInfo(mesh) }));
    }

    /** Remove selection highlight from current mesh. */
    deselectMesh() {
        if (!this._selectedMesh) return;
        const orig = this._prevMaterials.get(this._selectedMesh);
        if (orig) {
            /* Dispose cloned highlight materials */
            const cur = Array.isArray(this._selectedMesh.material)
                ? this._selectedMesh.material : [this._selectedMesh.material];
            cur.forEach(m => m.dispose());

            this._selectedMesh.material = orig;
        }
        this._prevMaterials.delete(this._selectedMesh);
        this._selectedMesh = null;
        this.container.dispatchEvent(new CustomEvent('mesh-deselected'));
    }

    /**
     * Return information about a mesh.
     * @param {THREE.Mesh} mesh
     * @returns {object}
     */
    getMeshInfo(mesh) {
        if (!mesh || !mesh.isMesh) return null;
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const idx = geo.index;
        return {
            name:       mesh.name || '(unnamed)',
            uuid:       mesh.uuid,
            vertices:   pos ? pos.count : 0,
            faces:      idx ? idx.count / 3 : (pos ? pos.count / 3 : 0),
            materialName: Array.isArray(mesh.material)
                ? mesh.material.map(m => m.name || m.type).join(', ')
                : (mesh.material.name || mesh.material.type),
            boundingBox: geo.boundingBox || (() => { geo.computeBoundingBox(); return geo.boundingBox; })(),
            worldPosition: new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld),
        };
    }

    /* ============================================================== */
    /*  Model Tree                                                     */
    /* ============================================================== */

    /**
     * Build a hierarchical tree of the model's objects.
     * @returns {object|null}
     */
    getModelTree() {
        if (!this._model) return null;
        const build = (obj) => {
            const node = {
                name:     obj.name || obj.type,
                type:     obj.type,
                uuid:     obj.uuid,
                visible:  obj.visible,
                children: [],
            };
            if (obj.isMesh) {
                const info = this.getMeshInfo(obj);
                node.vertices = info.vertices;
                node.faces    = info.faces;
            }
            obj.children.forEach(c => node.children.push(build(c)));
            return node;
        };
        return build(this._model);
    }

    /**
     * Find an object in the model by UUID.
     * @param {string} uuid
     * @returns {THREE.Object3D|null}
     */
    getObjectByUuid(uuid) {
        if (!this._model) return null;
        let found = null;
        this._model.traverse(c => { if (c.uuid === uuid) found = c; });
        return found;
    }

    /* ============================================================== */
    /*  Toggles / Settings                                             */
    /* ============================================================== */

    /** Show/hide the grid helper. */
    toggleGrid(show) {
        this.settings.showGrid = show !== undefined ? show : !this.settings.showGrid;
        this.gridHelper.visible = this.settings.showGrid;
        return this.settings.showGrid;
    }

    /** Show/hide the axes helper. */
    toggleAxes(show) {
        this.settings.showAxes = show !== undefined ? show : !this.settings.showAxes;
        this.axesHelper.visible = this.settings.showAxes;
        return this.settings.showAxes;
    }

    /** Toggle wireframe rendering on all model meshes. */
    toggleWireframe(on) {
        this.settings.wireframe = on !== undefined ? on : !this.settings.wireframe;
        this._applyWireframe(this.settings.wireframe);
        return this.settings.wireframe;
    }

    _applyWireframe(on) {
        if (!this._model) return;
        this._model.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => { m.wireframe = on; });
            }
        });
    }

    /** Toggle edge rendering. */
    toggleEdges(on) {
        this.settings.showEdges = on !== undefined ? on : !this.settings.showEdges;
        if (this.settings.showEdges) {
            this._applyEdges(true);
        } else {
            this._removeEdges();
        }
        return this.settings.showEdges;
    }

    _applyEdges(on) {
        this._removeEdges();
        if (!on || !this._model) return;
        this._edgeGroup = new THREE.Group();
        this._edgeGroup.name = '__edges__';
        this._model.traverse(child => {
            if (child.isMesh && child.geometry) {
                const edges = new THREE.EdgesGeometry(child.geometry, 15);
                const line  = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }));
                line.applyMatrix4(child.matrixWorld);
                this._edgeGroup.add(line);
            }
        });
        this.scene.add(this._edgeGroup);
    }

    _removeEdges() {
        if (this._edgeGroup) {
            this._disposeObject(this._edgeGroup);
            this.scene.remove(this._edgeGroup);
            this._edgeGroup = null;
        }
    }

    /** Set background color (disables gradient). */
    setBackgroundColor(hex) {
        this.settings.backgroundColor = hex;
        this.settings.backgroundGradient = false;
        this._applyBackground();
    }

    /** Enable gradient background. */
    setGradientBackground(enable = true) {
        this.settings.backgroundGradient = enable;
        this._applyBackground();
    }

    /** Set default material color and update existing model materials that are using the default. */
    setDefaultMaterialColor(hex) {
        this.settings.defaultMaterialColor = hex;
    }

    /** Switch up vector. */
    setUpVector(axis) {
        if (axis !== 'Y' && axis !== 'Z') return;
        this.settings.upVector = axis;
        if (axis === 'Z') {
            this.camera.up.set(0, 0, 1);
        } else {
            this.camera.up.set(0, 1, 0);
        }
        this.controls.update();
    }

    /** Update light intensities. */
    setLightIntensity(name, value) {
        switch (name) {
            case 'ambient':   this.ambientLight.intensity = value; break;
            case 'key':       this.keyLight.intensity     = value; break;
            case 'fill':      this.fillLight.intensity    = value; break;
            case 'hemisphere': this.hemiLight.intensity    = value; break;
        }
    }

    /* ============================================================== */
    /*  Animations                                                     */
    /* ============================================================== */

    /** Get available animation clip names. */
    getAnimationClips() {
        return this._animations.map(c => c.name);
    }

    /** Play a specific animation by name. */
    playAnimation(name) {
        if (!this._mixer) return;
        const clip = this._animations.find(c => c.name === name);
        if (clip) {
            this._mixer.stopAllAction();
            this._mixer.clipAction(clip).play();
        }
    }

    /** Stop all animations. */
    stopAnimations() {
        if (this._mixer) this._mixer.stopAllAction();
    }

    /* ============================================================== */
    /*  Export / Statistics                                             */
    /* ============================================================== */

    /**
     * Take a screenshot of the current view.
     * @param {string} [mimeType='image/png']
     * @returns {string} data URL
     */
    screenshot(mimeType = 'image/png') {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL(mimeType);
    }

    /**
     * Download a screenshot.
     * @param {string} [filename='screenshot.png']
     */
    downloadScreenshot(filename = 'screenshot.png') {
        const data = this.screenshot();
        const a    = document.createElement('a');
        a.href     = data;
        a.download = filename;
        a.click();
    }

    /**
     * Get aggregate model statistics.
     * @returns {object}
     */
    getModelStats() {
        if (!this._model) return null;

        let vertices = 0, faces = 0, meshes = 0;
        this._model.traverse(child => {
            if (child.isMesh && child.geometry) {
                meshes++;
                const pos = child.geometry.attributes.position;
                if (pos) vertices += pos.count;
                const idx = child.geometry.index;
                if (idx) {
                    faces += idx.count / 3;
                } else if (pos) {
                    faces += pos.count / 3;
                }
            }
        });

        const box = new THREE.Box3().setFromObject(this._model);
        const size = box.getSize(new THREE.Vector3());

        return {
            meshes,
            vertices,
            faces: Math.round(faces),
            boundingBox: {
                min: { x: box.min.x, y: box.min.y, z: box.min.z },
                max: { x: box.max.x, y: box.max.y, z: box.max.z },
            },
            size: { x: size.x, y: size.y, z: size.z },
            animations: this._animations.length,
        };
    }

    /* ============================================================== */
    /*  Rendering Loop                                                 */
    /* ============================================================== */

    _animate() {
        if (this._disposed) return;
        this._animFrameId = requestAnimationFrame(() => this._animate());

        const delta = this._clock.getDelta();

        /* Update animation mixer */
        if (this._mixer) this._mixer.update(delta);

        /* Update controls */
        this.controls.update();

        /* Render */
        this.renderer.render(this.scene, this.camera);
    }

    _handleResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;

        this.renderer.setSize(w, h);

        const aspect = w / h;

        this.perspCamera.aspect = aspect;
        this.perspCamera.updateProjectionMatrix();

        const half = (this.orthoCamera.top - this.orthoCamera.bottom) / 2 || 5;
        this.orthoCamera.left   = -half * aspect;
        this.orthoCamera.right  =  half * aspect;
        this.orthoCamera.updateProjectionMatrix();
    }

    /** Public resize — call when the container size changes externally. */
    resize() {
        this._handleResize();
    }

    /* ============================================================== */
    /*  Cleanup                                                        */
    /* ============================================================== */

    /** Fully dispose the engine and free all GPU resources. */
    dispose() {
        this._disposed = true;
        if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
        if (this._cameraAnim) cancelAnimationFrame(this._cameraAnim);

        window.removeEventListener('resize', this._onResize);
        this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);

        this.removeModel();
        this.controls.dispose();
        this.renderer.dispose();

        if (this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Expose globally so non‑module scripts can use it                   */
/* ------------------------------------------------------------------ */
window.ViewerEngine = ViewerEngine;

export default ViewerEngine;
