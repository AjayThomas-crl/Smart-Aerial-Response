# Tests

33 automated tests in four groups, run with the project venv:

```bash
.venv/bin/python -m pytest tests -v --junitxml=tests/results/junit.xml
.venv/bin/python tests/summarize.py        # writes tests/results/summary.json (ids, what, expected, status)
```

| File | Ids | What it covers |
|---|---|---|
| `test_planner_units.py` | TC-U01 to U12 | battery model, wind, sorties, tour, crossing check, coordinates, weather input, QGC WPL export, D* Lite routing around water, flood segmentation, flood spread |
| `test_iot.py` | TC-I01 to I09 | LoRaWAN 12-byte uplink codec, river level to flood stage, MQTT broker round trip, LoRaWAN-to-MQTT bridge, trigger engine rules, city data-rate budget |
| `test_study.py` | TC-S01 to S04 | dock sites shrink as water rises, robust dock separation, held-out coverage, all 180 study runs present |
| `test_system.py` | TC-T01 to T03 | demo server health, a live Varanasi plan streamed over SSE to completion with 0 route crossings, input validation |

`test_system.py` starts its own copy of `demo/server.py` on a free port (a demo already running on 8765 is not
touched) and runs the real planner once, about 25 s. Skip it with `-m "not system"`. It rewrites
`demo/static/live/varanasi_live.json`, the replay of the latest live run.
