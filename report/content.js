// Chapters of the course report. Structure follows the course brief (smart-city concepts: requirements (SRS),
// design (SDS), implementation, testing, outcome) inside the SCOPE report template.
const REFS = require("./references");

function cite(...keys) {
  return "[" + keys.map(k => { const i = REFS.findIndex(r => r.key === k); if (i < 0) throw new Error("no ref " + k); return i + 1; }).join("], [") + "]";
}

function abstract(H, D) {
  const v = D.demo.varanasi.stats, k = D.demo.kanpur.stats;
  return [
    H.P(`Floods are the most frequent disaster in Indian river cities. During the August 2025 Ganga flood, 84 ghats in Varanasi went under water and more than 6,500 people were displaced ${cite("news18")}, and the river crossed its warning mark again in Varanasi and Kanpur in September 2026 ${cite("dc2026", "toi_knp")}. Cut-off households need water, food and medicine within hours, while boats are slow and roads are blocked. Small drones can carry relief kits over the water, but a city needs to know where they should take off, which flooded pockets each one serves, and how to replan when the water keeps rising.`),
    H.P(`This project, **Smart Aerial Response**, builds the smart-city layer around an existing open-source multi-drone planner ${cite("adapt")}. Its Internet of Things (IoT) layer connects river-level gauges (LoRaWAN), drone docks and drones (MQTT over 4G/5G) to a trigger engine at the city's Integrated Command and Control Centre (ICCC). When the reference gauge is above the Central Water Commission warning mark and the flood stage rises, the engine automatically requests a new plan that may launch only from docks that report dry, and publishes it to the ICCC. A web dashboard runs the planning service live and replays the swarm for the operator. A scenario study then answers a planning question the city faces before any flood: where to install permanent drone docks so that enough of them stay usable as the water rises.`),
    H.P(`In software-in-the-loop runs on the 2025 Ganga flood maps, the loop re-planned automatically at every rise of the flood stage, dropping flooded docks (Varanasi 6 → ${D.iot.varanasi.plans.at(-1).docks_dry}, Kanpur 6 → ${D.iot.kanpur.plans.at(-1).docks_dry} dry docks). In 180 planner runs, six docks chosen for flood resilience kept ${D.pct(D.st("varanasi", "robust6", "test").coverage)}% and ${D.pct(D.st("kanpur", "robust6", "test").coverage)}% coverage on flood stages they were not chosen from, against ${D.pct(D.st("varanasi", "event", "test").coverage)}% and ${D.pct(D.st("kanpur", "event", "test").coverage)}% for docks sited from a single past flood. The message budget of a whole city is ${D.budget.total_kbit_s} kbit/s, and the system passed ${D.tests.passed} of ${D.tests.total} automated tests. It is a software prototype: no drone was flown and no sensor installed.`),
    H.P(`**Keywords:** smart city, Internet of Things, LoRaWAN, MQTT, UAV swarm, flood relief, ICCC, D* Lite, facility location.`),
  ];
}

module.exports = function content(H, D) {
  const { P, bullet, numbered, code, chapter, H2, H3, figure, table } = H;
  const v = D.demo.varanasi.stats, k = D.demo.kanpur.stats, veh = D.demo.varanasi.vehicle || {};
  const iv = D.iot.varanasi, ik = D.iot.kanpur;
  const T = D.tests;
  const byCat = {};
  for (const c of T.cases) {
    const cat = c.id.split("-")[1][0];
    byCat[cat] = byCat[cat] || { n: 0, pass: 0 };
    byCat[cat].n++; if (c.status === "pass") byCat[cat].pass++;
  }
  const catName = { U: "Acceptance (reused planner)", I: "Integration (IoT layer)", S: "Study / data checks", T: "System (end to end)" };
  const R = D.study;

  const out = [];
  const add = (...xs) => xs.forEach(x => Array.isArray(x) ? out.push(...x) : out.push(x));

  // =========================================================== 1 INTRODUCTION
  add(chapter("Introduction"));
  add(H2("Background"));
  add(P(`India's Smart Cities Mission ${cite("scm")} has given a hundred cities an Integrated Command and Control Centre (ICCC): a room where traffic cameras, utility sensors and emergency calls meet on one dashboard. Floods are where such a centre is tested hardest. Rivers such as the Ganga rise for days, the water spreads street by street, and the people who stay behind in upper floors and on ghats need supplies long before roads reopen. Varanasi already uses a three-dimensional digital twin of the city to predict which homes will be submerged ${cite("toi_twin")}, and both Varanasi and Kanpur publish river levels against fixed warning and danger marks ${cite("dc2026", "toi_knp")}. What is missing is the step from *knowing* where the water is to *acting* on it at city scale.`));
  add(P(`Unmanned aerial vehicles (UAVs) are a natural tool for that step ${cite("mohamed", "erdelj")}. A quadcopter can carry a one-kilogram kit of medicine, water purification tablets and food over a flooded street in minutes. One drone, however, cannot serve a city: its battery limits how far it can fly and its payload limits how many drops it can make per trip. A city needs a *swarm*, launched from several sites, with routes that avoid the water and each other, re-planned whenever the flood changes.`));
  add(H2("Motivation"));
  add(P(`During the 2025 Ganga flood, 84 ghats in Varanasi were submerged and more than 6,500 people were displaced ${cite("news18")}; in Kanpur, riverside Katri villages were cut off and depended on boats for weeks ${cite("toi_knp")}. Relief teams had to decide, again and again, where to send scarce boats and personnel as the water rose. Three practical questions motivated this project:`));
  add(numbered("Can a command centre go from a flood map to safe, flyable drone missions for a whole city in about a minute, rather than planning each flight by hand?", "n1"));
  add(numbered("Can the city's existing sensors, river gauges in particular, *trigger* that planning automatically when the water crosses an official mark?", "n1"));
  add(numbered("If a city installs permanent drone docks, where should they go so that they still work when the next, higher flood arrives?", "n1"));
  add(H2("Smart City Context"));
  add(P(`The project is designed as a smart-city service rather than a stand-alone drone tool. It follows the layered IoT model of perception, network, middleware, decision and application ${cite("zanella")}. It reuses infrastructure a smart city already has: river and rain gauges, a city network, an ICCC and its data platform. It adds three things: drone docks that report their own state, a trigger engine that turns sensor readings into planning requests, and a swarm planner whose output the ICCC operator approves before dispatch. The two demonstration cities, Varanasi and Kanpur, are both Smart Cities Mission cities on the Ganga with documented flood histories, which makes them realistic test beds.`));
  add(H2("Scope of the Project"));
  add(bullet("**In scope:** flood segmentation from satellite flood maps; weather-driven spread forecast; multi-drone base selection, sortie and route planning; mission-file export; a live command-centre dashboard; a software IoT layer with an MQTT broker, LoRaWAN uplink codec, simulated gauges and docks and a trigger engine; a study of where to site permanent docks; automated tests."));
  add(bullet("**Reused, not re-evaluated:** the multi-drone planning algorithms (flood segmentation, spread forecast, base selection, sorties, routing, mission export) come from the open-source A.D.A.P.T. planner " + cite("adapt") + ", developed in an earlier project and described in a separate manuscript that is under review. This report treats the planner as an existing component, does not re-evaluate it, and claims none of its results; the contributions of this project are the IoT layer, the ICCC dashboard, the dock-siting study and the tests."));
  add(bullet("**Out of scope:** flying real drones; hardware sensor installation; public alerting; regulatory approvals (beyond-visual-line-of-sight permission); hydraulic flood modelling."));
  add(H2("Literature Review"));
  add(P(`**UAVs in smart cities and disasters.** Mohamed *et al.* survey UAV applications in smart cities and identify emergency response and delivery as key services ${cite("mohamed")}. Erdelj *et al.* review how UAVs support disaster management, from situational awareness to delivering supplies, and highlight the need for coordination among several drones ${cite("erdelj")}.`));
  add(P(`**IoT flood monitoring.** Zanella *et al.* describe the architecture of an urban IoT and its network technologies ${cite("zanella")}. Zakaria *et al.* build a LoRaWAN smart sensing unit for flood monitoring and warning in catchment areas, showing that water-level sensors can report over long distances on very little power ${cite("zakaria")}. LoRaWAN regional parameters ${cite("lora")} and the MQTT standard ${cite("mqtt")} define the radio and messaging layers used here.`));
  add(P(`**Drone relief and facility location.** Rabta *et al.* model a drone fleet for last-mile delivery in disaster relief ${cite("rabta")}. Where to place service facilities has been studied since the set-covering model of Toregas *et al.* ${cite("toregas")} and the maximal covering location problem of Church and ReVelle ${cite("church")}; Snyder reviews facility location under uncertainty ${cite("snyder")}. For drones, Pulver and Wei optimise medical drone bases ${cite("pulver")} and Boutilier *et al.* site drone bases to deliver defibrillators faster ${cite("boutilier")}.`));
  add(P(`**Path planning.** D* Lite ${cite("dstar")} is an incremental shortest-path algorithm that is widely used in robotics because it can repair a route quickly when the map changes, which suits a growing flood.`));
  add(H2("Research Gap"));
  add(P(`Existing work tends to address one layer at a time: IoT papers stop at the warning, drone-routing papers assume the bases are given, and facility-location models assume the demand is fixed. Three gaps follow: (i) no end-to-end loop from a city sensor trigger to dispatched multi-drone missions; (ii) base and dock locations are rarely tested against a flood that keeps rising after they are chosen; (iii) results are seldom demonstrated on real flood maps of Indian cities. This project addresses all three, at prototype level.`));
  add(H2("Objectives"));
  ["Integrate an existing open-source multi-drone planner as the city's planning service, callable from the ICCC and restricted to the docks that are usable.",
    "Build an IoT layer in which river gauges and drone docks report over LoRaWAN and MQTT and a trigger engine re-plans the swarm automatically when the flood stage rises.",
    "Provide an ICCC-style dashboard that runs the planner live and shows every drone, battery and kit.",
    "Determine, with a scenario study, where permanent drone docks should be installed so they remain usable as the flood grows.",
    "Verify the system with automated unit, integration, data and end-to-end tests.",
  ].forEach(t => add(numbered(t, "n2")));
  add(H2("Problem Statement"));
  add(P(`*Given a city's flood map, its live river-level and weather readings and a set of drone docks, decide automatically and within minutes which docks to launch from, which flooded locations each drone supplies, in which order and by which route, so that every sortie stays within battery and payload limits, no route crosses water or another drone's route, and the plan is renewed whenever the flood stage rises; and choose the dock locations in advance so that enough of them stay dry in future floods.*`));
  add(H2("Project Plan"));
  add(P(`The project ran over the Fall Semester 2026 in eight overlapping work packages, from requirements to the final report, paper and presentation (Figure 1.1).`));
  add(figure("report/figures/project_plan.png", "Project plan for the Fall Semester 2026"));

  // =========================================================== 2 REQUIREMENTS
  add(chapter("Requirements"));
  add(P(`This chapter is the Software Requirements Specification (SRS) of the system: who uses it, what it must do, how well it must do it, and what it needs to run.`));
  add(H2("Stakeholders and Users"));
  add(table("Stakeholders and their needs", ["Stakeholder", "Role", "Main need"], [
    ["ICCC operator", "Runs the dashboard during a flood", "A safe plan in minutes, clear view of every drone, approve before dispatch"],
    ["District disaster management authority", "Owns the response", "Know where help can reach and what is left for boats"],
    ["Smart-city planner", "Plans infrastructure", "Where to install docks so they survive future floods"],
    ["Responders (NDRF, boat teams)", "Act on the ground", "List of points drones cannot reach"],
    ["Field technicians", "Maintain gauges and docks", "Low-power devices, simple status messages"],
    ["Residents in flooded areas", "Receive kits", "Fast, reliable delivery to where they are"],
  ], [2300, 2600, 4100], { left: [0, 1, 2] }));
  add(H2("Functional Requirements"));
  add(P(`Requirements FR1–FR9 are met by the reused planner and were verified, not built, in this project; FR10–FR14 were built in this project.`));
  add(table("Functional requirements", ["ID", "Requirement", "Provided by"], [
    ["FR1", "Detect flooded areas in a satellite flood map automatically (no manual clicks needed)", "Reused planner"],
    ["FR2", "Forecast flood spread for the next two hours from rain and wind", "Reused planner"],
    ["FR3", "Fetch live weather or use stored heavy/moderate presets", "Reused planner"],
    ["FR4", "Choose up to K launch bases (docks) that are dry and clear of forecast water", "Reused planner (restricted to docks here)"],
    ["FR5", "Place drop points on flooded pockets and assign each to one base", "Reused planner"],
    ["FR6", "Split each base's work into sorties within payload and 80% battery limits", "Reused planner"],
    ["FR7", "Route every leg around current and forecast water", "Reused planner"],
    ["FR8", "Detect and repair crossings between drones' routes", "Reused planner"],
    ["FR9", "Export one QGC WPL 110 mission file per drone and validate it", "Reused planner"],
    ["FR10", "Decode LoRaWAN gauge uplinks and publish readings on MQTT topics", "This project (iot/)"],
    ["FR11", "Re-plan automatically when the flood stage rises, using only docks reporting dry", "This project (TriggerEngine)"],
    ["FR12", "Show the live plan, drones, batteries and kits on an ICCC dashboard", "This project (demo/)"],
    ["FR13", "List drop points that no drone can reach, for hand-off to responders", "This project (dashboard)"],
    ["FR14", "Evaluate dock-siting strategies over flood-stage and weather scenarios", "This project (research/hub_study)"],
  ], [800, 5200, 3000], { left: [1, 2] }));
  add(H2("Non-Functional Requirements"));
  add(table("Non-functional requirements and how they are checked", ["ID", "Quality", "Target", "Verified by"], [
    ["NFR1", "Performance", "One city plan in about a minute on a laptop", "Measured planner wall time"],
    ["NFR2", "Safety", "No sortie above 80% battery; no route crossings; no straight-line fallbacks over water", "Planner checks, system test"],
    ["NFR3", "Reliability", "Re-plan with any subset of docks; flooded docks excluded", "IoT tests, IoT loop runs"],
    ["NFR4", "Scalability", "City IoT traffic far below a single 4G link", "Data-rate budget"],
    ["NFR5", "Interoperability", "Standard protocols: LoRaWAN, MQTT, MAVLink missions (QGC WPL)", "Mission validator, codec tests"],
    ["NFR6", "Usability", "One-click planning, streaming log, clear error if packages are missing", "Dashboard demo"],
    ["NFR7", "Repeatability", "Same inputs give the same plan (automatic colour sampling)", "Study runs, tests"],
    ["NFR8", "Portability", "Runs on Linux and Windows with Python 3 and a browser", "Start scripts"],
  ], [900, 1700, 3900, 2500], { left: [1, 2, 3] }));
  add(H2("Feasibility Study"));
  add(H3("Technical Feasibility"));
  add(P(`All components use mature technology. LoRaWAN water-level sensors and outdoor gateways are sold in India for the IN865 band ${cite("dragino", "rak")}, enterprise drone docks are available from Indian resellers ${cite("dock")}, and MQTT brokers run on modest servers. The planner and IoT layer run on an ordinary laptop: a full city plan took ${D.latency.varanasi.toFixed(0)} s for Varanasi and ${D.latency.kanpur.toFixed(0)} s for Kanpur on an idle 16-thread machine.`));
  add(H3("Economic Feasibility"));
  add(P(`The software stack is open source, so the cost is hardware and operation. Section 6.5 estimates the hardware for one city at roughly one crore rupees for six dock-and-drone sets plus a sensor network. For comparison, the Varanasi digital twin project cost about six crore rupees ${cite("toi_twin")} and ICCC operation contracts run to tens of crores ${cite("dtnext")}; the drone layer is a small addition that reuses the ICCC.`));
  add(H3("Social Feasibility"));
  add(P(`Faster delivery of medicine and water to cut-off households has clear social value, and drones reduce the risk to boat crews in fast water. Concerns about privacy and noise are limited because relief drones fly only during declared emergencies and carry no cameras beyond navigation. Every plan is approved by a human operator, which keeps responsibility with the district authority.`));
  add(H2("System Specification"));
  add(H3("Hardware Specification"));
  add(table("Hardware used for development and proposed for deployment", ["Component", "Development (used)", "Deployment (proposed)"], [
    ["Compute", "Laptop, 16 threads, Linux", "ICCC server or cloud VM"],
    ["River gauges", "Simulated (iot/smartcity_iot.py)", "LoRaWAN ultrasonic level sensor, IN865"],
    ["Gateway", "–", "Outdoor 8-channel LoRaWAN gateway"],
    ["Drone docks", "Simulated status messages", "Weatherproof drone dock with water sensor, 4G/5G"],
    ["Drones", "Mission files validated in software", "Quadcopter with ArduPilot/PX4, 8 kg payload class, servo drop"],
    ["Network", "Localhost MQTT", "City fibre / 4G / 5G to the ICCC"],
  ], [2000, 3400, 3600], { left: [0, 1, 2] }));
  add(H3("Software Specification"));
  add(table("Software used", ["Software", "Version / note", "Purpose"], [
    ["Python", "3.14 (project virtual environment)", "Planner, IoT layer, study, tests"],
    ["OpenCV, NumPy, Matplotlib", "OpenCV 5.0", "Image processing, numerics, figures"],
    ["amqtt, paho-mqtt", "amqtt 0.12, paho-mqtt 2.1", "MQTT broker and clients"],
    ["pytest", "9.x", "Automated tests"],
    ["Open-Meteo API", "Live weather", "Rain and wind for the spread forecast"],
    ["Web browser", "Any modern browser", "ICCC dashboard (HTML, canvas, Server-Sent Events)"],
    ["QGroundControl / Mission Planner", "Optional", "Open the exported missions"],
  ], [2800, 2800, 3400], { left: [0, 1, 2] }));
  add(H2("Constraints and Assumptions"));
  add(bullet("Flood maps are published images of the 2025 floods, not georeferenced rasters; distances use a nominal scale of about 2.6 m per pixel."));
  add(bullet("The rise of the flood is modelled by growing the mapped flood outward; the mapping from river level to flood stage is an assumption, not a hydraulic model."));
  add(bullet("Battery use follows the planner's endurance model (default settings, not a calibrated vehicle)."));
  add(bullet("Drone flights require Directorate General of Civil Aviation permission; this prototype stops at validated mission files."));

  // =========================================================== 3 DESIGN
  add(chapter("Design"));
  add(P(`This chapter is the Software Design Specification (SDS): the architecture, the data flows, the UML views and the message formats.`));
  add(H2("System Architecture"));
  add(P(`Figure 3.1 shows the system from the city's point of view. Sensors and satellite maps feed the ICCC; the planning service produces missions; docks launch drones; the operator watches and approves on the dashboard; points no drone can reach are handed to boat teams.`));
  add(figure("deliverables/figures/architecture_system.png", "Smart-city system architecture of Smart Aerial Response"));
  add(H2("IoT Layered Architecture"));
  add(P(`The IoT design follows five layers (Figure 3.2). **Perception:** river and rain gauges, satellite flood maps, drone docks and drones. **Network:** LoRaWAN for battery-powered gauges, HTTPS for weather and satellite data, 4G/5G with MQTT for docks and drones. **Middleware:** the MQTT broker, a time-series store, the trigger engine and the city digital twin. **Decision:** the swarm planner, the offline dock-siting study and a safety gate. **Application:** the ICCC dashboard, mission dispatch and responder hand-off.`));
  add(figure("research/paper/figures/fig1_iot_architecture.png", "Five-layer IoT architecture; teal elements close the loop from a sensor trigger to dispatched missions", 0.62));
  add(H2("Planning Service Interface"));
  add(P(`The planner is used as a service with a fixed interface. **Inputs:** a flood map, the weather (live or a preset), the maximum number of drones and, from this project, the list of permitted launch sites (the docks that report dry) and the flood stage. **Outputs:** a session folder with one validated mission file per drone, the drop points served and not served, and a JSON summary that the trigger engine publishes and the dashboard replays. How the planner computes the plan is described in its own documentation ${cite("adapt")} and is not repeated here.`));
  add(H2("Data Flow Diagrams"));
  add(P(`The level-0 diagram (Figure 3.3) treats the system as one process and shows its external entities and data flows. The level-1 diagram (Figure 3.5) opens it into six processes and three data stores (Figure 3.4).`));
  add(figure("report/figures/dfd_level0.png", "Data flow diagram, level 0 (context)"));
  add(figure("report/figures/dfd_level1.png", "Data flow diagram, level 1"));
  add(H2("Use Case Diagram"));
  add(figure("report/figures/use_case.png", "Use case diagram"));
  add(P(`The ICCC operator monitors levels, receives triggers, reviews and approves plans and dispatches missions. The smart-city planner runs the dock-siting study offline. The sensor network and the docks and drones are system actors; responder teams receive the list of points drones cannot reach (Figure 3.5).`));
  add(H2("Class Diagram"));
  add(figure("report/figures/class_diagram.png", "Class and module diagram of the implementation"));
  add(H2("Sequence Diagram"));
  add(P(`Figure 3.7 traces one automatic re-plan: a gauge uplink is decoded and published, the trigger engine detects a higher flood stage, collects the docks that report dry, runs the planner restricted to them and publishes the plan to the ICCC, where the operator approves dispatch.`));
  add(figure("report/figures/sequence_replan.png", "Sequence diagram of an automatic re-plan"));
  add(H2("Deployment Design"));
  add(figure("report/figures/iot_deployment.png", "Deployment and network design for one city"));
  add(H2("Data and Message Design"));
  add(P(`Gauges send a packed binary uplink to save airtime and battery; everything after the network server is JSON on MQTT topics under \`sar/<city>/\`. Table 3.1 gives the uplink layout and Table 3.2 the topics.`));
  add(table("LoRaWAN gauge uplink (12 bytes, big-endian)", ["Field", "Type", "Bytes", "Example"], [
    ["Device id", "uint16", "2", "1 (reference gauge)"], ["Time", "uint32 (Unix seconds)", "4", "1793180000"],
    ["Level", "uint16 (cm above MSL)", "2", "7142 = 71.42 m"], ["Rate of rise", "int16 (cm/h)", "2", "50"],
    ["Battery", "uint16 (mV)", "2", "3700"],
  ], [2200, 2800, 1200, 2800], { left: [0, 1] }));
  add(table("MQTT topics", ["Topic", "Publisher", "Rate", "Content"], D.budget.messages.map(m => [
    `\`${m.topic}\``, { telemetry: "Drone", event: "Drone", status: "Dock", level: "LoRaWAN bridge", plan: "Trigger engine" }[m.topic.split("/").pop()],
    m.rate_hz >= 1 ? `${m.rate_hz} Hz` : `1 / ${Math.round(1 / m.rate_hz)} s`,
    { telemetry: "position, battery, payload, state", event: "drop, reload, landing", status: "water at pad, batteries, kits", level: "level, rate of rise, battery", plan: "trigger, docks used, drops, missions" }[m.topic.split("/").pop()],
  ]), [3300, 1700, 1300, 2700], { left: [0, 3], size: 19 }));
  add(H2("Dock-Siting Design"));
  add(P(`To choose permanent dock sites, the planner is first allowed to place bases freely in every training scenario (three flood stages × three weather levels). A candidate site *c* scores ${"s(c) = a(c) × Σ n(b)"}, where the sum runs over training bases *b* within 45 pixels of *c*, *n(b)* is the number of drops base *b* served, and *a(c)* is the share of training scenarios in which *c* is dry and clear of forecast water. Sites are taken in order of score subject to the planner's minimum separation. The resulting "robust" docks are compared with docks sited from a single past flood and with evenly spread docks on held-out flood stages (Chapter 6).`));

  // =========================================================== 4 IMPLEMENTATION
  add(chapter("Implementation"));
  add(H2("Technology Stack and Code Organisation"));
  add(P(`The swarm planner is the open-source A.D.A.P.T. system ${cite("adapt")} (latest main branch, multi-drone mode), used unchanged as a library. The IoT layer, the dashboard, the dock-siting study and the tests were written in this project. Table 4.1 shows how the code is organised.`));
  add(table("Code organisation", ["Folder", "Content", "Language"], [
    ["adapt_core/", "Swarm planner (open-source A.D.A.P.T., latest main, multi-drone mode)", "Python"],
    ["iot/", "MQTT broker, LoRaWAN codec, gauge and dock simulators, trigger engine, loop runner", "Python"],
    ["demo/", "ICCC dashboard: HTTP + Server-Sent Events server, exporter, web page", "Python, HTML, JavaScript"],
    ["research/hub_study/", "Dock-siting study: scenario runner, batch, dock selection, analysis", "Python"],
    ["research/paper/", "IEEE research paper build and figures", "JavaScript, HTML"],
    ["tests/", "Automated test suite (unit, integration, data, system)", "Python (pytest)"],
  ], [2400, 4900, 1700], { left: [0, 1, 2] }));
  add(H2("Module Description"));
  add(H3("Planning Service (Reused)"));
  add(P(`The open-source planner ${cite("adapt")} is called unchanged through its command-line interface or, for runs restricted to docks, through \`research/hub_study/run_scenario.py\`, which passes the permitted launch sites and the flood stage. This project added no code to the planner; it only wraps it as a service, checks its outputs (Chapter 5) and consumes its JSON summary.`));
  add(H3("IoT Layer"));
  add(P(`\`iot/smartcity_iot.py\` implements the five layers in software. An **amqtt** broker runs in-process. **Gauge simulators** follow a rising hydrograph and send 12-byte LoRaWAN uplinks to \`lorawan/<dev>/up\`. A **LoRaWAN bridge** (the network-server role) decodes them and republishes JSON on \`sar/<city>/gauge/<id>/level\`. **Dock simulators** publish \`sar/<city>/dock/<id>/status\` with water at the pad whenever their site is unusable at the current flood stage. The **trigger engine** subscribes to both. It waits until every dock has reported and the reference gauge is at or above the Central Water Commission warning mark (Varanasi, Rajghat: 70.262 m warning, 71.262 m danger ${cite("dc2026")}; Kanpur, Ganga Barrage: 114 m and 115 m ${cite("toi_knp")}). It maps the level to a flood stage and, whenever the stage rises, runs the planner with only the dry docks, then publishes the result on \`sar/<city>/iccc/plan\`. If the water rises again while a plan is running, intermediate stages are collapsed and the next plan uses the latest stage.`));
  add(code(`def on_message(self, cl, userdata, msg):
    d = json.loads(msg.payload)
    if "/dock/" in msg.topic:
        self.docks[d["id"]] = d
        return
    self.levels[d["id"]] = d
    ref = self.levels.get(f"{self.cfg['code']}-RG01")
    if not ref or len(self.docks) < self.n_docks or ref["level_m"] < self.cfg["warning"]:
        return
    stage = flood_stage(ref["level_m"], self.cfg["warning"], self.cfg["danger"])
    if self.stage is None or stage > self.stage:     # flood got worse: queue a re-plan
        ...`));
  add(H3("ICCC Dashboard"));
  add(P(`\`demo/server.py\` is a small HTTP server. \`/api/plan\` starts the planner as a subprocess and streams every log line to the browser as Server-Sent Events, then exports the session (routes, timings, flood layers) for replay. The page animates all drones at once on the flood map with battery, payload, sortie and kit counters, and lets the operator change city, weather and the number of drones, or click flood colours. \`/api/health\` reports whether the planner's Python packages are installed and how to fix it if not.`));
  add(H3("Dock-Siting Study"));
  add(P(`\`run_scenario.py\` runs the unmodified planner on one scenario, growing the flood mask by a given number of pixels, fixing the weather and optionally restricting bases to a dock list; \`run_batch.py\` runs all 180 scenarios in parallel; \`select_hubs.py\` computes the robust, event-sited and uniform dock sets; \`analyze.py\` produces the tables and figures.`));
  add(H2("Project Demonstration"));
  add(P(`The live demonstration covers both cities. Running \`demo/start_demo.sh\` creates the environment if needed and opens the dashboard at \`http://localhost:8765\`; *Plan swarm now* runs the real planner and replays the swarm (Figures 4.1 and 4.2). \`iot/run_iot_demo.py\` runs the IoT loop in a terminal, printing each trigger, dock count and re-plan.`));
  add(figure("report/figures/demo_varanasi.png", "ICCC dashboard replaying the Varanasi swarm"));
  add(figure("report/figures/demo_kanpur.png", "ICCC dashboard replaying the Kanpur swarm"));


  // =========================================================== 5 TESTING
  add(chapter("Testing"));
  add(H2("Test Strategy"));
  add(P(`Testing was done at four levels. **Acceptance tests** check the reused planner's building blocks against known answers before the system relies on them. **Integration tests** run the IoT layer through a real MQTT broker. **Data tests** check that the study's outputs are complete and internally consistent. **System tests** start the dashboard server and run a full plan through its API. In addition, the 180 planner runs of the dock study act as **scenario tests**, and planning time is measured as a **performance test**. All automated tests are in \`tests/\` and run with \`pytest\`.`));
  add(H2("Test Environment"));
  add(P(`Linux laptop (16 threads), Python virtual environment of the project, pytest; MQTT broker started on a free local port by each test; the dashboard server started on a free port. Test run: ${new Date(T.run_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, ${T.total} tests in ${Math.round(T.duration_s)} s.`));
  add(H2("Test Cases and Results"));
  add(table("Summary of automated test results", ["Category", "Tests", "Passed", "Pass rate"],
    Object.entries(byCat).map(([c, x]) => [catName[c] || c, x.n, x.pass, `${Math.round(100 * x.pass / x.n)}%`]).concat([["**Total**", `**${T.total}**`, `**${T.passed}**`, `**${Math.round(100 * T.passed / T.total)}%**`]]),
    [4200, 1500, 1500, 1800], { left: [0] }));
  add(table("Test cases", ["ID", "Test", "Expected result", "Result"],
    T.cases.map(c => [c.id, c.what || c.name, c.expected || "", c.status === "pass" ? "Pass" : c.status === "skip" ? "Skipped" : "**Fail**"]),
    [1100, 3900, 3000, 1000], { left: [1, 2], size: 18 }));
  if (T.failed) add(P(`${T.failed} test(s) failed; the failures and their causes are listed in \`tests/results/summary.json\`.`));
  add(H2("Scenario Testing"));
  add(P(`The dock-siting study ran the planner on 30 scenarios per strategy: two cities, five flood stages (mask grown by 0, 3, 6, 9 and 12 pixels) and three weather levels (calm; moderate: 3 mm/h rain, 12 km/h wind; heavy: 10 mm/h, 30 km/h). All 180 runs completed with a valid plan and no route crossings, including those where flooded docks left the planner with only a few launch sites.`));
  add(H2("IoT Loop Testing"));
  add(P(`The full IoT loop was run with the planner for both cities under heavy weather, the river starting 0.3 m below the warning mark and rising 50 cm/h (simulated time compressed). Table 5.3 lists every automatic re-plan.`));
  const iotRows = [];
  for (const [c, r] of [["Varanasi", iv], ["Kanpur", ik]]) r.plans.forEach(p => iotRows.push([c, p.n, p.stage, `${p.docks_dry} of ${p.docks_total}`, `${p.served} of ${p.drop_points}`, p.bases, `${p.planner_s.toFixed(0)} s`, `${p.trigger_to_plan_s.toFixed(0)} s`]));
  add(table("Automatic re-plans in the IoT loop runs", ["City", "Plan", "Flood stage", "Docks dry", "Drops served", "Bases", "Planner", "Trigger to plan"], iotRows,
    [1300, 700, 1000, 1200, 1400, 900, 1100, 1400], { size: 19 }));
  add(P(`As the river rose, flooded docks dropped out (Varanasi 6 → 5, Kanpur 6 → 4) and the engine re-planned with the remaining ones each time. When the water rose by more than one stage during a plan, the engine skipped the intermediate stage and planned for the latest one, which is why the trigger-to-plan time of a queued plan includes waiting for the previous one.`));
  add(H2("Performance Testing"));
  add(P(`On an idle machine a full Varanasi plan took ${D.latency.varanasi.toFixed(0)} s and a Kanpur plan ${D.latency.kanpur.toFixed(0)} s. Across the 180 study runs, executed ten at a time in parallel, the median wall time per run was ${Math.round(R.latency.adaptive.median)} s for free base placement and ${Math.round(R.latency.robust6.median)} s for the robust docks. The IoT layer itself adds well under a second between a gauge uplink and the trigger.`));
  add(H2("Defects Found and Fixed"));
  add(table("Defects found during development and testing", ["Defect", "Cause", "Fix"], [
    ["Dashboard server failed with 'address already in use'", "Another server instance held port 8765", "Server tries ports 8765–8774 and prints the one it uses"],
    ["'Plan swarm now' failed", "System Python lacked OpenCV", "Project virtual environment; server runs the planner with it and the page explains how to fix a missing package"],
    ["Server crashed on a favicon request", "Log formatter assumed a string", "Log message converted with str()"],
    ["Trigger engine planned before all docks reported", "Engine acted on the first dock message", "Engine waits for every dock and for the warning mark"],
  ], [3000, 2800, 3200], { left: [0, 1, 2], size: 20 }));

  // =========================================================== 6 OUTCOME
  add(chapter("Outcome"));
  add(H2("IoT Loop Results"));
  add(P(`The trigger loop closed automatically in both cities (Table 5.3). Each time the river rose past a new flood stage, the engine collected the docks that still reported dry and published a new plan to the ICCC within one planning time. In Varanasi the number of usable docks fell from 6 to ${iv.plans.at(-1).docks_dry} and in Kanpur from 6 to ${ik.plans.at(-1).docks_dry} as the water reached them, and every plan was produced from the remaining docks without operator input. When the water rose faster than the planner could run, intermediate stages were skipped so that the ICCC always received a plan for the latest state.`));
  add(P(`The message budget for a whole city (Table 6.1), computed from the message sizes and rates, is ${D.budget.total_kbit_s} kbit/s, dominated by 1 Hz drone telemetry; it fits comfortably on a single 4G link, and LoRaWAN gauges send one 12-byte uplink every five minutes.`));
  add(table("IoT message budget for one city", ["Topic", "Payload (bytes)", "Rate", "Devices", "kbit/s"],
    D.budget.messages.map(m => [`\`${m.topic}\``, m.payload_bytes, m.rate_hz >= 1 ? `${m.rate_hz} Hz` : `1 / ${Math.round(1 / m.rate_hz)} s`, m.devices, m.kbit_s.toFixed(2)])
      .concat([["**Total**", "", "", "", `**${D.budget.total_kbit_s}**`]]), [3700, 1500, 1300, 1200, 1300], { left: [0], size: 19 }));
  add(H2("Dock-Siting Results"));
  add(P(`Table 6.2 compares the dock strategies on all 30 scenarios and on the held-out flood stages (3 and 9) that were not used to choose the robust docks. Coverage is the share of drop points served; regret is the coverage lost compared with re-siting bases freely for every event.`));
  add(table("Dock strategies (6 docks unless stated)", ["City / strategy", "Coverage (all)", "Coverage (held-out)", "Regret", "Docks lost", "≤ 30 min"],
    ["varanasi", "kanpur"].flatMap(c => [["adaptive", "Re-sited per event"], ["robust6", "Robust docks"], ["event", "Event-sited docks"], ["uniform6", "Uniform docks"]].map(([s, n]) => {
      const a = D.st(c, s), t = D.st(c, s, "test");
      return [`${c[0].toUpperCase() + c.slice(1)}: ${n}`, `${D.pct(a.coverage)}%`, `${D.pct(t.coverage)}%`, s === "adaptive" ? "–" : `${D.pct(a.regret)}%`,
        s === "adaptive" ? "–" : a.docks_lost_mean.toFixed(1), `${D.pct(a.sla30)}%`];
    })), [3000, 1300, 1400, 1100, 1100, 1100], { left: [0], size: 20 }));
  add(figure("research/paper/figures/fig4_coverage_stage.png", "Share of drop points served as the flood rises; grey bands mark held-out stages", 0.6));
  add(P(`Docks sited from one past flood fail because the next, higher flood covers them: on average ${D.st("varanasi", "event").docks_lost_mean.toFixed(1)} of five are unusable in Varanasi. Robust docks lose almost none in Varanasi and keep coverage within a few points of the free re-siting bound, which would require moving every base by hundreds of metres each time the water rises (Figure 6.2).`));
  add(figure("research/paper/figures/fig3_dock_maps.png", "Dock sites of the three fixed strategies; hollow markers are docks unusable at the highest stage", 0.6));
  add(H2("Smart City Impact"));
  add(bullet("**Automatic response:** a new plan is requested as soon as the river crosses the next flood stage, instead of waiting for someone to notice and plan by hand."));
  add(bullet("**Reuse of city infrastructure:** gauges, network and the ICCC dashboard already exist; the system adds docks, a trigger engine and a planner."));
  add(bullet("**Better infrastructure decisions:** the dock study gives planners an evidence-based list of dock sites that survive future floods."));
  add(bullet("**Safer operations:** human approval, battery limits, no crossing routes and a clear list of points left for responders."));
  add(H2("Unique Outcome: Research Paper"));
  add(P(`The dock-siting study and the IoT layer are written up as an IEEE-format research paper, *"Flood-Resilient Siting of IoT Drone Docks for Smart-City Relief: A Scenario Study of Varanasi and Kanpur"*, by ${[D.authors.guide.name, ...D.authors.paper_order].join(", ").replace(/, ([^,]*)$/, " and $1")}. It asks where a smart city should install drone docks so they keep working as the flood rises, and reports the results of Section 6.2 in full.`));
  add(H2("Cost Analysis"));
  add(P(`Table 6.3 gives an indicative hardware cost for one city with six docks and twenty gauges, using list prices from Indian resellers found in October 2026. Prices vary with configuration, software licences and maintenance contracts, so the total is an order of magnitude, not a quotation.`));
  add(table("Indicative hardware cost for one city", ["Item", "Quantity", "Unit price (list)", "Total"], [
    ["Drone dock with drone (DJI Dock 2 bundle)", "6", "₹12.3–20.2 lakh " + cite("dock"), "₹74–121 lakh"],
    ["LoRaWAN ultrasonic level sensor", "20", "US$79 (≈ ₹6,600) " + cite("dragino"), "≈ ₹1.3 lakh"],
    ["Outdoor LoRaWAN gateway, IN865", "2", "₹65,775 " + cite("rak"), "≈ ₹1.3 lakh"],
    ["Server / cloud VM for broker and planner", "1", "existing ICCC", "–"],
    ["**Total (hardware)**", "", "", "**≈ ₹77–124 lakh**"],
  ], [3800, 1100, 2300, 1800], { left: [0] }));
  add(P(`The software is open source. The dominant cost is the docks; four robust docks instead of six cut it by a third at a moderate loss of coverage (Varanasi held-out coverage ${D.pct(D.st("varanasi", "robust4", "test").coverage)}% with four docks against ${D.pct(D.st("varanasi", "robust6", "test").coverage)}% with six).`));
  add(H2("Limitations"));
  add(bullet("All results are from simulation on two published flood maps; no drone was flown and no sensor was installed."));
  add(bullet("Rising water is modelled by widening the mapped flood; the level-to-stage mapping is an assumption."));
  add(bullet("The planner uses default, uncalibrated battery and speed settings, so results are comparative rather than absolute."));

  // =========================================================== 7 CONCLUSION
  add(chapter("Conclusion and Future Work"));
  add(P(`Smart Aerial Response shows that a smart city can close the loop from a river gauge to dispatched drone relief missions. Gauge readings travel over LoRaWAN and MQTT to a trigger engine that re-plans a swarm whenever the flood stage rises, using only the docks that are still dry. The existing open-source planner is wrapped as a city service and fed only with usable docks; the dashboard runs it live for both cities. A study of 180 scenarios shows that docks chosen for flood resilience keep about nine-tenths of the achievable coverage on unseen flood stages, while docks sited from a single past flood lose about half. The system passed ${T.passed} of ${T.total} automated tests and runs live for Varanasi and Kanpur.`));
  add(P(`**Future work:** georeferenced flood rasters from Sentinel-1 ${cite("sentinel")} in place of published maps; calibration of the battery model with a real vehicle; a pilot with two docks and a LoRaWAN gauge on one ghat; integration with the city's ICCC platform and digital twin; and a hydraulic model to map river level to flood extent.`));

  // =========================================================== references, appendix
  out.push(new (require("docx").Paragraph)({ pageBreakBefore: true, alignment: require("docx").AlignmentType.CENTER, spacing: { after: 360 },
    children: [H.run("REFERENCES", { size: 32, bold: true })] }));
  REFS.forEach((r, i) => out.push(new (require("docx").Paragraph)({ alignment: require("docx").AlignmentType.JUSTIFIED,
    spacing: { after: 100, line: BODY() }, indent: { left: 540, hanging: 540 }, children: [H.run(`[${i + 1}]\t`), ...H.rich(r.text)] })));
  out.push(new (require("docx").Paragraph)({ pageBreakBefore: true, alignment: require("docx").AlignmentType.CENTER, spacing: { after: 360 },
    children: [H.run("APPENDIX A – SAMPLE CODE", { size: 32, bold: true })] }));
  add(P("**A.1 LoRaWAN uplink codec** (`iot/smartcity_iot.py`)"));
  add(code(`UPLINK = struct.Struct(">HIHhH")   # dev id, unix time, level cm, rate cm/h, battery mV: 12 bytes

def encode_uplink(dev, t, level_m, rate_cm_h, battery_v):
    return UPLINK.pack(dev, int(t), round(level_m * 100), round(rate_cm_h), round(battery_v * 1000))

def decode_uplink(payload):
    dev, t, level_cm, rate, mv = UPLINK.unpack(payload)
    return {"dev": dev, "t": t, "level_m": level_cm / 100, "rate_cm_h": rate, "batt_v": mv / 1000}`));
  add(P("**A.2 River level to flood stage** (`iot/smartcity_iot.py`)"));
  add(code(`STAGES = (0, 3, 6, 9, 12)

def flood_stage(level_m, warning, danger):
    """Warning mark = stage 0, danger mark = 6, one metre above danger = 12."""
    raw = 6.0 * (level_m - warning) / (danger - warning)
    return max(s for s in STAGES if s <= max(0.0, raw))`));
  add(P("**A.3 Re-plan with the dry docks** (`iot/smartcity_iot.py`, abridged)"));
  add(code(`docks = self.dry_docks()
hubs.write_text(json.dumps(docks))
cmd = [PLANNER_PY, "run_scenario.py", "--city", self.city, "--grow", str(job["stage"]),
       "--rain", str(rain), "--wind", str(wind), "--max-bases", "6", "--hubs", str(hubs), "--out", str(run_dir)]
subprocess.run(cmd, capture_output=True, text=True)
self.c.publish(f"sar/{self.city}/iccc/plan", json.dumps(rec), qos=1)`));
  add(P("**A.4 Server-Sent Events from the dashboard server** (`demo/server.py`)"));
  add(code(`def sse(self, event, data):
    payload = f"event: {event}\\ndata: {json.dumps(data)}\\n\\n".encode()
    self.wfile.write(payload)
    self.wfile.flush()`));
  add(P("**A.5 Example unit test** (`tests/test_planner_units.py`)"));
  add(code(`def test_u06_crossing_detector():
    assert polyline_intersections([(0, 0), (10, 10)], [(0, 10), (10, 0)]) == [(5.0, 5.0)]
    assert polyline_intersections([(0, 0), (10, 0)], [(0, 5), (10, 5)]) == []`));
  return out;
};
const BODY = () => 276;
module.exports.abstract = abstract;
