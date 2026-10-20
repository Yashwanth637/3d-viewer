#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT=8080
echo "Starting Online 3D Viewer local server on http://localhost:$PORT ..."
# Open browser
open "http://localhost:$PORT" 2>/dev/null || true
python3 -m http.server $PORT
