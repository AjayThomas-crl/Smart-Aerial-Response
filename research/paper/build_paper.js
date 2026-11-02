// Builds research/paper/Flood_Resilient_Drone_Docks.docx in IEEE conference style (two columns).
// Numbers are read from research/hub_study/results.json and iot_budget.json so text and data agree.
// Run: NODE_PATH=<folder with node_modules> node research/paper/build_paper.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, SectionType, Footer, PageNumber, LevelFormat, VerticalAlign, Math: OMath, MathRun, MathSum,
} = require("docx");

const HERE = __dirname;
const STUDY = path.join(HERE, "..", "hub_study");
const R = JSON.parse(fs.readFileSync(path.join(STUDY, "results.json")));
const IOT = JSON.parse(fs.readFileSync(path.join(STUDY, "iot_budget.json")));
const FONT = "Times New Roman";
const PAGE = { width: 12240, height: 15840 };                        // US Letter, as IEEE templates
const MARGIN = { top: 1080, bottom: 1440, left: 1022, right: 1022 };  // 0.75 in top, 0.71 in sides
const FULL_DXA = PAGE.width - MARGIN.left - MARGIN.right;            // 10196
const COL_GAP = 360;
const COL_DXA = (FULL_DXA - COL_GAP) / 2;                            // 4918
const COL_PX = Math.round(COL_DXA / 15), FULL_PX = Math.round(FULL_DXA / 15);

// ---------- numbers ----------
const pct = (x, d = 0) => (100 * x).toFixed(d);
const S = (city, strat, part = "all") => R.per_strategy[city][strat][part];
const L = R.latency;
const disp = city => {
  const m = R.displacement[city];
  return { meanPx: m.reduce((a, x) => a + x.mean_px, 0) / m.length, moved: m.reduce((a, x) => a + x.moved_share, 0) / m.length };
};

// ---------- text helpers ----------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 20, bold: o.bold, italics: o.italics,
  smallCaps: o.smallCaps, superScript: o.sup });
function rich(text, o = {}) {   // **bold**, *italic*, ^sup^
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\^[^^]+\^)/).filter(Boolean).map(s =>
    s.startsWith("**") ? run(s.slice(2, -2), { ...o, bold: true })
      : s.startsWith("^") ? run(s.slice(1, -1), { ...o, sup: true })
        : s.startsWith("*") ? run(s.slice(1, -1), { ...o, italics: true }) : run(s, o));
}
const P = (t, o = {}) => new Paragraph({ children: rich(t, o), alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { after: o.after ?? 40, line: 228 }, indent: o.noIndent ? undefined : { firstLine: 202 } });
let secNo = 0, subNo = 0;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function H1(t) {
  subNo = 0;
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
    children: [run(`${ROMAN[secNo++]}. `, { size: 20 }), run(t, { size: 20, smallCaps: true })] });
}
const H2 = t => new Paragraph({ spacing: { before: 100, after: 60 }, keepNext: true,
  children: [run(`${String.fromCharCode(65 + subNo++)}. ${t}`, { size: 20, italics: true })] });
const bullet = t => new Paragraph({ numbering: { reference: "bul", level: 0 }, children: rich(t),
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 30, line: 228 } });
const eq = (t, n) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 },
  children: [...rich(t, { italics: false }), run(`\t(${n})`)], tabStops: [{ type: "right", position: COL_DXA }] });

let figNo = 0, tabNo = 0;
function imgSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function figure(file, caption, full) {
  const buf = fs.readFileSync(path.join(HERE, "figures", file));
  const { w, h } = imgSize(buf), width = full ? FULL_PX - 8 : COL_PX - 4;
  figNo++;
  const image = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true,
    children: [new ImageRun({ type: "png", data: buf, transformation: { width, height: Math.round(width * h / w) },
      altText: { title: `Fig. ${figNo}`, description: caption, name: `fig${figNo}` } })] });
  if (full) image.__wideCount = 2;           // make_paper.js puts image + caption in a one-column section
  return [image,
    new Paragraph({ alignment: full ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, spacing: { after: 120 },
      children: [run(`Fig. ${figNo}.  `, { size: 16 }), ...rich(caption, { size: 16 })] }),
  ];
}
const thin = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function table(caption, header, rows, widths, full) {
  tabNo++;
  if (full) widths = widths.map(w => Math.round(w * (FULL_DXA - 400) / widths.reduce((a, b) => a + b, 0)));
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, head, last) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    borders: { top: head ? thin : none, bottom: head || last ? thin : none, left: none, right: none },
    margins: { top: 30, bottom: 30, left: 50, right: 50 },
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, keepNext: !last,
      children: rich(String(t), { size: 16, bold: head }) })] });   // keepNext on every row keeps the table on one page
  const label = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 20 }, keepNext: true,
    children: [run(`TABLE ${ROMAN[tabNo - 1]}`, { size: 16 })] });
  if (full) label.__wideCount = 4;           // label, caption, table and spacer go in a one-column section
  return [
    label,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, keepNext: true,
      children: [run(caption, { size: 16, smallCaps: true })] }),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
      rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true, false)) }),
        ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, i, false, ri === rows.length - 1)) }))] }),
    new Paragraph({ spacing: { after: 100 }, children: [] }),
  ];
}

// ================= front matter =================
const front = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [run("Flood-Resilient Siting of IoT Drone Docks for Smart-City Relief: A Scenario Study of Varanasi and Kanpur", { size: 44 })] }),
];
// faculty guide is the first author, the students follow in paper_order (edit ../authors.json, not this file)
const AUTHORS = JSON.parse(fs.readFileSync(path.join(HERE, "..", "authors.json")));
const author = (name, second, email) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(name, { size: 22, italics: name.startsWith("[") })] }),
  ...[second, "School of Computer Science and Engineering", "Vellore Institute of Technology", "Vellore, India", email].filter(Boolean)
    .map(t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(t, { size: 16, italics: t.startsWith("[") })] })),
];
// the paper lists no register numbers
const PAPER_AUTHORS = AUTHORS.paper_order.map(n => AUTHORS.students.find(s => s.name === n));
const AUTHOR_CELLS = [
  [AUTHORS.guide.name, AUTHORS.guide.designation, AUTHORS.guide.email],
  ...PAPER_AUTHORS.map(s => [s.name, null, s.email]),
];
const authorTable = new Table({
  width: { size: FULL_DXA, type: WidthType.DXA }, columnWidths: AUTHOR_CELLS.map(() => FULL_DXA / AUTHOR_CELLS.length),
  rows: [new TableRow({ children: AUTHOR_CELLS.map(c => new TableCell({ width: { size: FULL_DXA / AUTHOR_CELLS.length, type: WidthType.DXA },
    borders: { top: none, bottom: none, left: none, right: none }, children: author(...c) })) })],
});

// ================= body =================
const vs = city => S(city, "robust6");
const abstract = [
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 216 }, children: [
    run("Abstract", { size: 18, bold: true, italics: true }), run("—", { size: 18, bold: true }),
    ...rich(`Relief drones can supply people cut off by urban floods, but they need dry places to launch, swap batteries and reload. In a smart city these places can be permanent, networked drone docks, sited years before any flood. This paper asks where such docks should go so that they keep working as the water rises. We propose an Internet of Things (IoT) architecture in which river and rain gauges, docks and drones report over LoRaWAN and MQTT to a command centre that re-plans missions from docks that are still dry. Docks are sited by a scenario method: an open-source multi-UAV relief planner is run on 30 flood scenarios (two cities, five flood stages, three weather levels), and sites it chooses repeatedly and that stay dry are kept. On held-out flood stages, six robust docks serve 94% of drop points in Varanasi and 90% in Kanpur, against 49% and 45% for docks sited from a single event and 68% and 73% for evenly spread docks. Freely re-sited bases, the upper bound, move by 263 to 287 m on average between consecutive flood stages, which a fixed installation avoids. A city's full telemetry load is 9.61 kbit/s. All results are from simulation on published flood maps; no drone was flown.`, { size: 18, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 216 }, children: [
    run("Index Terms", { size: 18, bold: true, italics: true }), run("—", { size: 18, bold: true }),
    run("smart cities, Internet of Things, drone docks, facility location, flood resilience, UAV relief, MQTT, LoRaWAN.", { size: 18, bold: true })] }),
];

const intro = [
  H1("Introduction"),
  P(`The study is based on the situation of Indian cities located on large rivers. During the monsoon, the water cuts off parts of the city and small loads of food, water and medicine are needed to be transported to people who cannot leave their homes. Relief drones are used for emergency logistics in such situations and are being tested by city governments [1], [2]. However, the drones need to be launched from dry ground and to return to base to swap batteries and to be re-equipped with relief kits. Thus, the launch site has to be available and is usually chosen on the day of relief delivery in most studies on relief drones.`),
  P(`We propose to use the smart city's existing infrastructure of an Integrated Command and Control Centre (ICCC) to establish a network of permanent, weather-proof **drone docks**, which are to be used for storing drones, charging/swapping their batteries and holding relief kits for distribution by the drones. The ICCC already collects field data from various sensors including flood sensors and rain gauges in several cities [3], [4]. The docks can be connected to the ICCC as any other IoT device.`),
  P(`This creates a siting problem with a twist. While a dock placed near to the flooded wards of today will be able to serve them, it might be submerged by water in the next few meters of flood. On the other hand, a dock sited far from any water will always be safe, but it might be too far from people in need. We study this trade-off directly by using an existing open-source relief planner as an evaluator. For a given flood map, weather and set of allowed launch sites, the planner returns the set of drop points that can be served by a fleet of drones, within the bounds of battery and payload of each drone [5].`),
  P(`We address three research questions:`, { noIndent: true }),
  bullet(`**RQ1.** How much relief coverage does a fixed set of docks lose compared with launch sites re-chosen for every event as flood level and weather change?`),
  bullet(`**RQ2.** Can a dock set chosen from a few flood scenarios keep working on flood stages it was not chosen for, and how does it compare with docks sited for one event or spread evenly?`),
  bullet(`**RQ3.** What does an IoT layer that triggers re-planning from sensor readings require in data rate and response time?`),
  P(`Our main contributions are: (i) an IoT architecture that links sensors, docks and drones with the ICCC and restricts re-planning to the currently dry docks (Section III); (ii) a scenario-based approach for siting drone docks that scores the possible sites based on how frequently a relief planner can select them for the required relief coverage and how long they remain dry, with a training and testing split over the available flood stages (Section IV); (iii) a comprehensive evaluation of different approaches for siting drone docks, including robust siting based on multiple scenarios, event-based siting, even distribution of sites, and freely re-sited bases, on flood maps of two different cities (Section V); (iv) a telemetry budget and a planning latency for the IoT architecture (Section V-F).`),
];

const related = [
  H1("Related Work"),
  H2("IoT for urban flood monitoring"),
  P(`IoT flood monitoring systems have already been designed and implemented in several research studies. For instance, in [6], the authors described the architecture of the Smart City's IoT system. In addition, there are several works that used low-power wide-area networks for the river gauge data transmission. For example, in [7], the authors designed and developed a solar-powered LoRaWAN water-level node with an ultrasonic sensor. They evaluated the packet delivery ratio and delay of the proposed system. In many of the Indian Smart Cities, the data from several flood sensors and rain gauges are being integrated in the ICCCs. For example, in Chennai, the ICCC is planning to integrate dozens of flood sensors and rain gauges [3]. However, the current systems are used for flood monitoring and early warning and there is no provision for the physical response by the drones.`),
  H2("Drones in smart cities and disaster response"),
  P(`Many UAV applications can be deployed in the context of smart cities, provided that the required regulation and technology are in place [1]. UAVs have already been used for disaster management, including for monitoring and delivery of relief [2]. In a scenario where small relief packages need to be distributed from recharging stations in a disaster area, a drone fleet can be used to deliver these packages [8]. However, in such scenarios, the launch sites of the drones are assumed to exist.`),
  H2("Locating drone bases"),
  P(`As far as we are aware, locating drone bases for flood relief has received little attention, although emergency-facility location problems are well studied. Typically, a location set covering model, proposed by Toregas *et al.* [9], is used, or a maximal covering location problem, as introduced by Church and ReVelle [10]. Both models can be extended to take into account uncertainty in demand and in facility availability, as reviewed by Snyder [11]. The application of such models to locate medical drone bases for the treatment of cardiac arrest is studied in [12]. In [13], the size of a drone network is optimized to outperform ambulance service in terms of response time in the city of Toronto. In [14], drone search bases are located prior to a disaster in Iwate, Japan. The model is extended to take into account damage to the bases.`),
  H2("Relief mission planning from flood maps"),
  P(`Our evaluator, A.D.A.P.T. [5], is used to generate autopilot missions for relief drones (single or in swarms) from a flood-annotated map and weather data, using D* Lite [15] for routing around water, and splitting up the mission into several battery-limited sorties. We use A.D.A.P.T. as a black box and extend it by fixed docks, increasing water levels and the IoT layer.`),
  ...table("Scope of related work and of this study",
    ["Work", "Pre-sited bases", "Rising flood", "Routed reach", "IoT trigger", "City case"],
    [["IoT flood monitoring [6], [7]", "–", "sensed", "–", "✓", "✓"],
     ["Drones in smart cities [1], [2]", "–", "–", "–", "(✓)", "–"],
     ["Covering models [9], [10], [12], [13]", "✓", "–", "–", "–", "✓"],
     ["Damage-aware drone bases [14]", "✓", "(✓)", "–", "–", "✓"],
     ["Flood-map relief planner [5]", "–", "(✓)", "✓", "–", "✓"],
     ["This study", "✓", "✓", "✓", "✓", "✓"]],
    [1900, 650, 600, 620, 600, 548]),
];

const iotT = IOT.messages;
const arch = [
  H1("IoT Architecture"),
  P(`The proposed architecture is shown in Fig. 1. It consists of five layers, each with specific tasks. The architecture's purpose is to enable the automatic generation of drone missions from sensor data in real-time, without any human interaction required to create maps.`),
  ...figure("fig1_iot_architecture.png", "Proposed IoT architecture for dock-based flood relief. Teal elements form the trigger-to-dispatch path."),
  P(`**Perception.** In this layer, the hazard level is measured by river-stage gauges located on ghats and bridges, and by ward-level rain gauges. Satellite radar flood products [19] can also be used to estimate the extent of water, when available. Docks are equipped with water sensors, anemometers, rain gauges and battery/kit counters. The ICCC can query the state of each dock at any time. Drones report their position, battery level, payload, and the progress of the current mission, via the autopilot.`),
  P(`**Network.** Gauges are battery or solar powered and send packed binary readings of 10 to 12 bytes every five minutes over LoRaWAN, which fits the smallest LoRaWAN payload, allowed at the longest range [17]. Docks and drones need more bandwidth and a down-link for missions, so they use cellular links and publish JSON messages to an MQTT broker [16] under topics of the form sar/<city>/<device type>/<id>/….`),
  P(`**Middleware.** The time-series data from the sensors is stored in a time-series database and used to update a city digital twin. This digital twin contains the current and forecast extent of the flood as well as the status of each of the docks. A rule-based trigger engine is used to start a re-plan of relief missions when a warning level on a sensor is exceeded, when the rate of rise on a sensor is too high, when a new flood map is uploaded, or when the weather changes class.`),
  P(`**Decision.** The planner service runs the relief planner [5] with one change in how it is called: its candidate launch sites are restricted to docks that the twin reports as dry, clear of the forecast flood and stocked. It returns drop points, sorties and one mission per drone, which pass a safety gate (battery limit, geofence, operator approval). The dock siting study of Section IV runs offline and decides where the docks are in the first place.`),
  P(`**Application.** The ICCC dashboard shows the swarm, docks, gauges and an event log; missions are sent to the docks; drop points that no dock can reach are handed to boat teams. A prototype of this dashboard, which streams the planner's log and replays the swarm on the city map, was built for this study; the MQTT layer is specified and sized but not deployed.`),
  ...table("Message types and data rate for one city",
    ["Topic (sar/<city>/…)", "Bytes", "Rate", "N", "kbit/s"],
    iotT.map(m => [m.topic.replace("sar/<city>/", "").replace(/<id>\//, "").replace("/<id>", ""), m.payload_bytes,
      m.rate_hz >= 1 ? `${m.rate_hz} Hz` : `1/${Math.round(1 / m.rate_hz)} s`, m.devices, m.kbit_s.toFixed(2)])
      .concat([["Total", "", "", "", IOT.total_kbit_s.toFixed(2)]]),
    [1900, 650, 900, 500, 750]),
];

const D = R.hubs;
const method = [
  H1("Dock Siting Method"),
  P(`The different components of the study are summarized in Fig. 2. We generated scenarios, freely placed the bases in each of the scenarios using the planner, derived dock sets from the resulting plans, and then evaluated each of the dock sets on all of the scenarios.`),
  ...figure("fig2_method.png", "Study design: scenarios, adaptive plans, dock strategies, fixed-dock plans and metrics."),
  H2("Relief planner as evaluator"),
  P(`The planner [5] segments flooded areas by color, grows them by a weather-driven forecast over two hours, places drop points on the dry edges of flood zones, chooses up to *K* launch bases that together reach the most drop points, assigns each drop point to a base, splits each base's work into sorties that respect an 8 kg payload and an 80% battery limit, and routes each leg around current and forecast water. We use its open-source release with default settings (cruise 5 m/s, 7 min loaded endurance, 0.25 kg per kit, nominal scale 2 m per map pixel) and call it unmodified; the only intervention is the list of candidate base sites it may choose from. Its own documentation lists the battery model and the map scale as approximations, so absolute coverage figures here are indicative; all comparisons are made under identical settings.`),
  H2("Scenarios"),
  P(`The scenarios are based on the published flood maps of Varanasi and Kanpur from the 2025 Ganga floods. Both cities are covered under the Smart Cities Mission. Flood stage *g* represents increasing water, and is defined as the detected flood mask grown by *g* ∈ {0, 3, 6, 9, 12} map pixels, corresponding to 10% to 28% of the map being flooded in Varanasi and 15% to 39% in Kanpur. Three weather conditions are considered: calm (0 mm/h, 0 km/h), moderate (3 mm/h, 12 km/h) and heavy (10 mm/h, 30 km/h) with wind coming from the west. 15 scenarios are generated for each city. For the evaluation, the scenarios are split into training and testing sets, where the training set consists of scenarios with flood stages 0, 6 and 12, and the testing set consists of scenarios with flood stages 3 and 9.`),
  H2("Strategies"),
  P(`**Adaptive.** The Adaptive strategy allows the planner to freely choose up to 6 bases for each scenario. This is an upper bound on coverage as the planner assumes that a launch site can be placed at any location on any day.`),
  P(`**Robust docks.** The candidate sites for fixed-dock runs of the planner are the bases of the training scenarios chosen by the planner. The score of a candidate site *c* is the product of support and survival of *c*:`),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, tabStops: [{ type: "right", position: COL_DXA }],
    children: [new OMath({ children: [new MathRun("s(c) = a(c) · "),
      new MathSum({ children: [new MathRun("n(b)")], subScript: [new MathRun("b∈B, ‖b−c‖≤45")] })] }), run("\t(1)")] }),
  P(`where *B* is the set of all bases in all training plans, *n*(*b*) is the number of drop points that were served by base *b* and *a*(*c*) is the share of training scenarios in which *c* is dry and clear of the forecast flood under the planner's own test. We take the sites with the highest scores and skip any sites that are closer than the minimum distance between bases that the planner uses (150 pixels for the runs presented here). We use *H* = 4, 6 and 8.`, { noIndent: true }),
  P(`**Event-sited docks.** This fixed-dock strategy is what a city would install after having studied the most recent flood for that city. Here, for example, we used the bases that the planner chose for the one event of stage 0 under moderate weather (5 docks in Varanasi, 5 in Kanpur).`),
  P(`**Uniform docks.** Six fixed docks can be placed on the dry land in a naive geographic manner by *k*-means clustering of the dry grid points of the planner at stage 0.`),
  P(`For fixed-dock runs of the planner, the planner can only choose from the set of docks of the given strategy that are dry and clear in the given scenario.`),
  H2("Metrics"),
  P(`**Coverage** is the proportion of drop points in a scenario that are served by a plan. **Regret** is the relative decrease in the number of served drop points as compared to the adaptive plan for that scenario. **Docks lost** is the number of docks that are flooded or within the clearance of the forecast flood for that scenario. **Service level** is the percentage of drop points served within 30 minutes of dispatch, using the routed path flown at 5 m/s, 40 s to climb to 100 m, 101 s for each drop (descent to 10 m, 5 s loiter and climb), 80 s for landing and 120 s for battery swap and reload. Vertical speeds follow ArduCopter defaults [18]. **Base displacement** is the mean distance between the adaptive bases of a scenario and the nearest base of the next flood stage. **Planning latency** is the wall time of a single planner run.`),
];

module.exports = { AUTHORS, front, authorTable, abstract, intro, related, arch, method, P, H1, H2, bullet, figure, table, eq, run, rich,
  R, IOT, S, pct, disp, L, D, PAGE, MARGIN, FULL_DXA, COL_DXA, COL_GAP, FONT, Document, Packer, Paragraph, TextRun,
  AlignmentType, SectionType, Footer, PageNumber, LevelFormat };
