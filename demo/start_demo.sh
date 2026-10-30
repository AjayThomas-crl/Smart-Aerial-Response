#!/usr/bin/env bash
# Starts the Smart Aerial Response command-centre demo at http://localhost:8765.
# First run creates .venv in the project folder and installs the planner's packages into it.
set -e
cd "$(dirname "$0")/.."
if ! .venv/bin/python -c "import cv2, numpy, matplotlib, dotenv, requests" 2>/dev/null; then
  echo "Setting up .venv with the planner's packages (first run only)..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r demo/requirements.txt
fi
exec .venv/bin/python demo/server.py "$@"
