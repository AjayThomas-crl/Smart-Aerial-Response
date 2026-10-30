# Smart Aerial Response

**An Autonomous UAV Framework for Resilient Flood Emergency Management in Smart Cities**

Course project for **Design of Smart Cities** (VIT, Fall Semester 2026-27). It adds a smart-city IoT layer around the open-source A.D.A.P.T. multi-drone planner (latest `main`, commit `37f0570`, used unchanged in `adapt_core/`): river gauges and drone docks report over LoRaWAN and MQTT, a trigger engine re-plans relief drone missions whenever the flood stage rises using only the docks that are still dry, an ICCC-style dashboard runs the planner live, and a scenario study shows where a city should install drone docks so they survive rising floods. Demonstrated on Varanasi and Kanpur.

The planning algorithms and their evaluation belong to the A.D.A.P.T. project and are described in its own manuscript; this repository claims none of the planner's results.

Team: Dharani I S and Sukant G; faculty guide Dr. Swarnalatha P, Professor Grade 1, SCOPE. The research paper adds Ajay Thomas K as second author. Names come from `research/authors.json`, which the report, paper and slides all read.

## Submission contents

Final course submission (due 4 November 2026).

| Item | Where | How to build or run it |
|---|---|---|
| Final project report (Requirements, Design, Implementation, Testing, Outcome) | `report/Smart_Aerial_Response_Course_Report.docx` | built by the report script in `report/` |
| Project presentation | `deliverables/Smart_Aerial_Response.pptx` | `node deliverables/build/build_deck.js` |
| IEEE-format research paper (unique outcome) | `research/paper/Flood_Resilient_Drone_Docks.docx` | `NODE_PATH=<node_modules with docx> node research/paper/make_paper.js` |
| Demo video script (10 min, recording steps) | `docs/demo_video_script.md` | record with Alt + PrintScreen (Omarchy) or OBS, export MP4 |
| Internal similarity self-check (the official report comes from the VIT library) | `submission_tools/out/Similarity_SelfCheck.pdf` | `python3 submission_tools/similarity_report.py` |
| Live command-centre demo | `demo/` | `demo/start_demo.sh`, then <http://localhost:8765> |
| IoT loop: gauges and docks over MQTT/LoRaWAN, trigger engine, re-planning | `iot/` | `.venv/bin/python iot/run_iot_demo.py --city varanasi` (add `--no-planner` for a 10-second run) |
| Tests | `tests/` | `.venv/bin/python -m pytest tests -m "not system"` (add `-m system` for the end-to-end planner runs) |
| Dock-siting study (180 planner runs) | `research/` | see `research/README.md` |

The study keeps only each run's `result.json` in git; `research/hub_study/run_batch.py` regenerates the full
sessions (about 600 MB).

## Live demo

```bash
demo/start_demo.sh
```

On Windows run `demo\start_demo.bat`. The first run creates `.venv` in this folder and installs the planner's packages (OpenCV, NumPy, Matplotlib, requests, python-dotenv); after that it starts at once and opens <http://localhost:8765>. `python3 demo/server.py` also works once `.venv` exists: the server always runs the planner with the `.venv` Python, and the page tells you if the packages are missing. The page:

- replays the pre-computed Varanasi and Kanpur swarms (all drones at once, with battery, payload, sortie and kit counts);
- **Plan swarm now** runs the real planner (`adapt_core/main.py --mode multi --no-gui`) and streams its log, then replays the new plan (about 30-60 s);
- **Max drones** caps how many drones the planner may use;
- **Operator picks flood colour** passes your map clicks to the planner as `--sample-points`.

Without the server, open `demo/static/index.html` directly: the replay works and live planning is disabled. Each live run writes its mission files (`baseN.waypoints`, QGC WPL 110) under `demo/runs/<city>/`.

## Rebuilding

```bash
# demo data from a planner session folder
python3 demo/export_session.py <session_dir> varanasi demo/static/data
# report, paper and slides (need the npm packages docx, pptxgenjs, react, react-dom, react-icons, sharp)
NODE_PATH=<node_modules> node report/build_report.js
NODE_PATH=<node_modules> node research/paper/make_paper.js
NODE_PATH=<node_modules> node deliverables/build/build_deck.js <path to the pptx skill, for apply_theme.js>
```
