# Demo video script (10 minutes maximum)

Recorded project demonstration for **Smart Aerial Response: An Autonomous UAV Framework for Resilient Flood
Emergency Management in Smart Cities** (Design of Smart Cities). The target is about 9 minutes, leaving a minute
of slack. Three voices work well: Dharani narrates sections 1–3, Sukant sections 4–5 and Ajay sections 6–7.

## Before you press record

Run all of these from the project folder (`~/Projects/Smart-Aerial-Response`).

1. Start the dashboard once, so its first-run setup is not on camera:
   ```bash
   demo/start_demo.sh
   ```
   Check that <http://localhost:8765> opens and that the bottom-right status says the planner is ready. Leave it
   running.
2. In a second terminal, do a dry run of the IoT loop. It takes about 6 seconds:
   ```bash
   .venv/bin/python iot/run_iot_demo.py --city varanasi --no-planner --hours-per-s 1
   ```
3. Do a dry run of the tests so pytest is warm:
   ```bash
   .venv/bin/python -m pytest tests -m "not system" -q
   ```
4. Open these in viewers, one tab or window each:
   - the PPT (`deliverables/Smart_Aerial_Response.pptx` or the final copy in the submission folder);
   - the paper's figures in `research/paper/figures/`: `fig1_iot_architecture.png`, `fig3_dock_maps.png`,
     `fig4_coverage_stage.png`.
5. Prepare the screen:
   - Close chat apps and notifications.
   - Set the terminal font large, around 16 pt.
   - Zoom the browser to 110%.
   - Set the display to 1920×1080 if you can.

## Recording on this laptop (Omarchy / Hyprland)

- **Start:** press **Alt + PrintScreen**. It opens Omarchy's capture menu. Choose the screen-recording option,
  then the monitor or region.
- **Stop:** press **Alt + PrintScreen** again.
- **From a terminal:**
  - Start with `omarchy-capture-screenrecording --fullscreen --with-microphone-audio`.
  - Stop with `omarchy-capture-screenrecording --stop-recording`.
  - Add `--resolution=1920x1080` to force 1080p.
- **Output:** files are saved as `~/Videos/screenrecording-<date>_<time>.mp4`. It uses gpu-screen-recorder,
  so the output is already MP4.
- **Alternative: OBS Studio** (`obs`, installed).
  - Add a *Screen Capture (PipeWire)* source and a microphone source.
  - Settings → Video: 1920×1080, 30 fps.
  - Settings → Output: recording format MP4 (or MKV, then *File → Remux Recordings* to MP4).
- **Editing:** record in sections if that is easier, then join and trim them. To join section files without
  re-encoding:
  ```bash
  printf "file '%s'\n" part*.mp4 > list.txt && ffmpeg -f concat -safe 0 -i list.txt -c copy demo_full.mp4
  ```
- **Final check:**
  - The length is under 10:00. Check with `ffprobe -v error -show_entries format=duration -of csv=p=0 demo_full.mp4`.
  - The audio is audible.
  - The file is MP4 (H.264) at 1080p.

---

## 1. Introduction and problem (0:00 – 1:00)

**Show:** the PPT title slide, then the problem slide.

**Say:**
> "We are Ajay Thomas, Dharani I S and Sukant G, presenting Smart Aerial Response under Dr. Swarnalatha P. When the Ganga
> floods, as it did in Varanasi and Kanpur in 2025, streets go under water first and boats arrive late. Small
> drones can carry food, water and medicine to people who are cut off. But a smart city has to answer three
> questions in minutes. Where is the water? Which drone goes where? And where can drones even take off when the
> ground itself is flooding? Our project is an IoT-driven framework that answers all three automatically, from
> a satellite flood map, the weather, and live sensor data."

## 2. Architecture and IoT layer (1:00 – 2:30)

**Show:** the system architecture slide, then `fig1_iot_architecture.png`. Point to each layer as you name it.

**Say:**
> "The system has five layers.
>
> - Perception: river-level gauges, rain gauges, satellite flood maps, drone docks, and the drones themselves.
> - Network: gauges send tiny 12-byte LoRaWAN messages every five minutes, while docks and drones use 4G or 5G
>   with MQTT.
> - Middleware: an MQTT broker, a time-series store and a city digital twin.
> - Decision: a trigger engine. When a river gauge crosses the warning mark, it re-plans the swarm with the
>   A.D.A.P.T. planner. The planner finds the flood, places drop points, chooses bases and routes every drone
>   around the water.
> - Application: the city's Integrated Command and Control Centre (ICCC) dashboard and mission dispatch.
>
> Everything a city sends, for six drones, six docks and twenty gauges, adds up to under 10 kilobits per
> second."

## 3. Live IoT loop: sensor to re-plan (2:30 – 3:45)

**Show:** the terminal. Type the command live:
```bash
.venv/bin/python iot/run_iot_demo.py --city varanasi --no-planner --hours-per-s 1
```

**Say:** describe the log lines as they appear.
> "This starts a real MQTT broker. Simulated gauges send packed LoRaWAN uplinks, a codec turns them into JSON,
> and six docks report their status.
>
> The thresholds are the Central Water Commission marks for the Rajghat gauge: warning at 70.262 metres and
> danger at 71.262. Watch the river rise. Each time it crosses into a new flood stage, the trigger engine fires.
> It counts how many docks are still dry and asks for a new plan. The plan summary goes to the ICCC topic.
>
> Here we skip the planner to keep it fast. Without the `--no-planner` flag, every trigger runs the full planner
> using only the dry docks."

Point at the `[trigger]` lines, then the `[iccc] received` lines.

## 4. Command-centre dashboard: Varanasi (3:45 – 5:45)

**Show:** the browser at <http://localhost:8765>, with Varanasi selected.

**Do and say:**
1. Click **▶ Launch swarm**.
   > "This replays the planned swarm for Varanasi under heavy weather: 10 millimetres of rain and 30 km/h wind.
   > Five drones from separate bases serve 28 of 29 drop points. The telemetry shows battery, payload, sortie and
   > kits for every drone, and no two routes cross."
2. Click **Show planning steps**.
   > "These are the stages: the detected flood, the forecast spread, then the drop points, the bases and the
   > routes."
3. Click **⚡ Plan swarm now**, with Weather set to *Heavy* and Max drones at *6*.
   > "Now we run the real planner live on this city. The console streams its log. It takes about 30 to 60
   > seconds."
   - While it runs, talk over the console: the flood colour is detected, the bases are chosen, and D* Lite
     routes are planned around the water.
   - When it finishes, the new plan replays automatically.
4. Optional, about 20 seconds: set **Max drones** to 1 and run again (or describe it).
   > "One drone serves only 14 drops; the swarm doubles the coverage."

## 5. Dashboard: Kanpur (5:45 – 6:45)

**Do:** click **Kanpur**, then **▶ Launch swarm**. If time allows, also click **⚡ Plan swarm now**.

**Say:**
> "Kanpur's flood is larger and more spread out. The planner picks six bases and serves 43 of 46 drop points,
> again with zero route crossings. Every drone gets a standard QGC mission file that ArduPilot or PX4 can fly."

## 6. Research result: where to build the docks (6:45 – 8:00)

**Show:** `fig3_dock_maps.png`, then `fig4_coverage_stage.png` (or the matching PPT slides).

**Say:**
> "Our research question: if a city installs permanent drone docks, where should they go so they still work
> when the water rises? We ran the planner 180 times, over two cities, five flood stages and three weathers,
> and compared dock strategies.
>
> Docks sited from one past flood get drowned by the next one. They serve only about 49% of drop points in
> Varanasi and 45% in Kanpur. Our robust siting picks places that stay dry and useful across flood stages. On
> flood stages it never saw, it serves 94% in Varanasi and 90% in Kanpur. That is close to the 98% you get by
> freely moving bases every time, but with no need to relocate equipment as the water rises."

## 7. Testing and outcome (8:00 – 9:15)

**Show:** the terminal. Type:
```bash
.venv/bin/python -m pytest tests -m "not system" -q
```

**Say:**
> "We test the planner's building blocks: the battery model, wind, sortie splitting, routing around water,
> mission-file validity and flood segmentation. We also test the IoT layer and the dock study. All of these
> pass."

Then show the PPT outcome slide.

**Say:**
> "The outcomes are a working command-centre demo on two real Indian smart cities, a runnable IoT loop from
> sensor to re-plan, and an IEEE-format research paper on flood-resilient dock siting."

## Close (9:15 – 9:30)

> "Smart Aerial Response turns sensor data into flying relief in under a minute. Thank you."

---

### If something goes wrong on camera

- **Plan swarm now** fails: the console prints the reason. Press **▶ Launch swarm** to show the pre-computed
  replay, and explain that live planning takes about a minute.
- The port is busy: the server falls back to ports 8766–8774. Use the address it prints.
- Over 10 minutes: cut section 5's live run and the "Max drones = 1" run first.
