# Online 3D Viewer

A web-based 3D model viewer running directly in your browser. Replicates the features, design, and capabilities of [3dviewer.net](https://3dviewer.net).

## Features

- **Multi-Format Support**:
  - **CAD / Engineering**: STEP (`.stp`, `.step`), IGES (`.igs`, `.iges`), IFC, BIM, BREP, 3DM (Rhinoceros), FCStd.
  - **Standard / 3D Printing**: STL, OBJ (+ MTL), GLTF, GLB, 3DS, 3MF, AMF, PLY, DAE, FBX, OFF, WRL.
- **Client-Side Processing**: Fast rendering directly in your browser with WebGL.
- **Full 3D Interaction**:
  - Orbit rotation, panning, zooming.
  - Perspective and Orthographic projection toggle.
  - Wireframe, edge rendering, and flat/smooth shading modes.
  - Sectioning and measurement tools.
  - Snapshot / high-resolution image export.
- **Model Hierarchy & Materials**:
  - Left panel shows complete model tree, mesh sub-components, and visibility toggles.
  - Right panel displays object properties, dimensions, and material properties.
- **Flexible File Loading**:
  - Drag and drop 3D files (supports multi-file imports like `.obj` + `.mtl`).
  - Open local files using the file picker.
  - Load models via URL using hash parameters (e.g. `#model=assets/models/DamagedHelmet.glb`).

## Getting Started

### Run Locally

Simply run the startup script:

```bash
./start.sh
```

Or start any static web server:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your web browser.

## License

MIT License
