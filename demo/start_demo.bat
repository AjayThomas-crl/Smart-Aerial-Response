@echo off
rem Starts the Smart Aerial Response command-centre demo at http://localhost:8765.
rem First run creates .venv in the project folder and installs the planner's packages into it.
cd /d "%~dp0.."
.venv\Scripts\python.exe -c "import cv2, numpy, matplotlib, dotenv, requests" 2>nul
if errorlevel 1 (
  echo Setting up .venv with the planner's packages ^(first run only^)...
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install -q -r demo\requirements.txt
)
.venv\Scripts\python.exe demo\server.py %*
