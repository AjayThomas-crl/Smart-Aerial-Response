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
// faculty guide is the first author, the two students follow (edit ../authors.json, not this file)
const AUTHORS = JSON.parse(fs.readFileSync(path.join(HERE, "..", "authors.json")));
const author = (name, second, email) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(name, { size: 22, italics: name.startsWith("[") })] }),
  ...[second, "School of Computer Science and Engineering", "Vellore Institute of Technology", "Vellore, India", email].filter(Boolean)
    .map(t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [run(t, { size: 16, italics: t.startsWith("[") })] })),
];
// the paper lists no register numbers; Ajay Thomas K (not in the course report) is its second author
const AUTHOR_CELLS = [
  [AUTHORS.guide.name, AUTHORS.guide.designation, AUTHORS.guide.email],
  ...[...(AUTHORS.paper_extra_authors || []), ...AUTHORS.students].map(s => [s.name, null, s.email]),
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
    ...rich(`Relief drones can supply people cut off by urban floods, but they need dry places to launch, swap batteries and reload. In a smart city these places can be permanent, networked drone docks, sited years before any flood. This paper asks where such docks should go so that they keep working as the water rises. We propose an Internet of Things (IoT) architecture in which river and rain gauges, docks and drones report over LoRaWAN and MQTT to a command centre that re-plans missions from docks that are still dry. Docks are sited by a scenario method: an open-source multi-UAV relief planner is run on 30 flood scenarios (two cities, five flood stages, three weather levels), and sites it chooses repeatedly and that stay dry are kept. On held-out flood stages, six robust docks serve ${pct(S("varanasi", "robust6", "test").coverage)}% of drop points in Varanasi and ${pct(S("kanpur", "robust6", "test").coverage)}% in Kanpur, against ${pct(S("varanasi", "event", "test").coverage)}% and ${pct(S("kanpur", "event", "test").coverage)}% for docks sited from a single event and ${pct(S("varanasi", "uniform6", "test").coverage)}% and ${pct(S("kanpur", "uniform6", "test").coverage)}% for evenly spread docks. Freely re-sited bases, the upper bound, move by ${Math.round(disp("varanasi").meanPx * 2.6)} to ${Math.round(disp("kanpur").meanPx * 2.6)} m on average between consecutive flood stages, which a fixed installation avoids. A city's full telemetry load is ${IOT.total_kbit_s} kbit/s. All results are from simulation on published flood maps; no drone was flown.`, { size: 18, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 216 }, children: [
    run("Index Terms", { size: 18, bold: true, italics: true }), run("—", { size: 18, bold: true }),
    run("smart cities, Internet of Things, drone docks, facility location, flood resilience, UAV relief, MQTT, LoRaWAN.", { size: 18, bold: true })] }),
];

const intro = [
  H1("Introduction"),
  P(`Indian cities on large rivers flood almost every monsoon. When water cuts off a ward, the first need is to get small loads of food, water and medicine to people who cannot leave. Small drones can carry such loads over water in minutes, and city governments are already testing them for emergency logistics [1], [2]. A drone, however, is only as useful as the place it flies from. It must take off from dry ground, come back to swap a battery and pick up the next kits, and do so several times within its short endurance. In most studies of relief drones this launch site is assumed to exist or is chosen on the day.`),
  P(`Smart cities offer a different option. Under India's Smart Cities Mission every participating city runs an Integrated Command and Control Centre (ICCC) that already collects data from field sensors, including flood sensors and rain gauges in several cities [3], [4]. A natural extension is a network of **drone docks**: weather-proof boxes that store a drone, charge or swap its batteries and hold relief kits, connected to the ICCC like any other IoT device. Docks, unlike pop-up launch sites, are infrastructure. They are bought, permitted and wired in advance, so their locations must be decided long before anyone knows how high the next flood will rise.`),
  P(`This creates a siting problem with a twist. A dock placed close to today's flooded wards serves them well, but the same dock may itself be under water when the river rises another metre. A dock placed far from any water is always safe but may be too far for a drone to reach the people who need it. We study this trade-off directly, using an existing open-source relief planner as an evaluator: for any flood map, weather and set of allowed launch sites, it returns the drop points a fleet can serve within battery and payload limits [5].`),
  P(`We address three research questions:`, { noIndent: true }),
  bullet(`**RQ1.** How much relief coverage does a fixed set of docks lose, compared with launch sites re-chosen for every event, as the flood rises and the weather changes?`),
  bullet(`**RQ2.** Can a dock set chosen from a few flood scenarios keep working on flood stages it was not chosen for, and how does it compare with docks sited for one event or spread evenly?`),
  bullet(`**RQ3.** What does an IoT layer that triggers re-planning from sensor readings require in data rate and response time?`),
  P(`Our contributions are: (i) a five-layer IoT architecture that couples gauges, docks and drones to the ICCC and restricts each re-plan to docks that are still dry (Section III); (ii) a scenario-based dock siting method that scores candidate sites by how often a relief planner chooses them and how often they stay dry, with a train and test split over flood stages (Section IV); (iii) an evaluation on flood maps of Varanasi and Kanpur with 180 planner runs, comparing robust, event-sited, evenly spread and freely re-sited bases (Section V); and (iv) a measured telemetry budget and planning latency for the architecture (Section V-F).`),
];

const related = [
  H1("Related Work"),
  H2("IoT for urban flood monitoring"),
  P(`IoT flood monitoring is mature at the sensing level. Zanella *et al.* [6] describe the layered IoT stack of a smart city, from constrained field devices to cloud services. Low-power wide-area networks suit river gauges: Zakaria *et al.* [7] report a solar-powered LoRaWAN water-level node with an ultrasonic sensor and measure its packet delivery and delay. Indian ICCCs now integrate such sensors: Chennai's centre plans dozens of flood sensors and rain gauges [3]. These systems detect and warn; none of them dispatches a physical response. We use their sensor stream as the trigger for drone missions.`),
  H2("Drones in smart cities and disaster response"),
  P(`Mohamed *et al.* [1] survey UAV applications in smart cities and the regulation and technology needed to integrate them. Erdelj *et al.* [2] review UAVs for disaster management, from monitoring to delivery. Rabta *et al.* [8] model a drone fleet that delivers small relief packages from recharging stations in a disaster area. These works establish the role of drones but treat the launch infrastructure as given.`),
  H2("Locating drone bases"),
  P(`Choosing launch sites is a facility location problem. The location set covering model of Toregas *et al.* [9] and the maximal covering location problem of Church and ReVelle [10] underlie most emergency-facility siting, and Snyder [11] reviews how uncertainty in demand and in facility availability enters such models. Drone networks for cardiac arrest are the best-studied application: Pulver and Wei [12] site medical drone bases with covering models, and Boutilier *et al.* [13] size a drone network to beat ambulance response times in Toronto. Closest to our setting, Chin *et al.* [14] locate drone search bases before a disaster in Iwate, Japan, and extend the model to bases that may be damaged. These models need demand points and travel times as inputs and score coverage with straight-line or fixed ranges. Our method instead obtains coverage from a planner that routes around water, splits work into battery-limited sorties and changes its demand points as the flood grows, and it treats flooding of the dock itself as the failure mode.`),
  H2("Relief mission planning from flood maps"),
  P(`The evaluator we use, A.D.A.P.T. [5], turns a flood-annotated map and the weather into autopilot missions for one drone or a fleet, with D* Lite routing [15] and battery-limited sorties; its own evaluation concerns perception accuracy, mission verification and simulator flights. We use it unchanged as a black box and add what it does not cover: fixed docks, rising water, and the IoT layer. Table I contrasts the scope of these lines of work.`),
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
  P(`Fig. 1 shows the proposed architecture in five layers. Its purpose is to close the loop from a sensor reading to dispatched drone missions without manual map work, while keeping a human approval step.`),
  ...figure("fig1_iot_architecture.png", "Proposed IoT architecture for dock-based flood relief. Teal elements form the trigger-to-dispatch path."),
  P(`**Perception.** River-stage gauges on ghats and bridges and ward-level rain gauges measure the hazard; satellite radar flood products [19] supply the extent of water when available. Docks carry their own water sensor, an anemometer, a rain sensor and counters for charged batteries and kits, so the ICCC knows at all times which docks can launch. Drones report position, battery, payload and mission progress from the autopilot.`),
  P(`**Network.** Gauges are battery or solar powered and send packed binary readings of 10 to 12 bytes every five minutes over LoRaWAN, which fits the smallest LoRaWAN payload, allowed at the longest range [17]. Docks and drones need more bandwidth and a down-link for missions, so they use cellular links and publish JSON messages to an MQTT broker [16] under topics of the form sar/<city>/<device type>/<id>/….`),
  P(`**Middleware.** The broker feeds a time-series store and a city digital twin that holds the current and forecast flood extent and the state of every dock. A rule-based trigger engine starts a re-plan when a gauge crosses a warning level, when its rate of rise exceeds a threshold, when a new flood map arrives, or when the weather changes class.`),
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
  P(`Fig. 2 summarises the study: scenarios are generated, the planner places bases freely in each, dock sets are derived from those plans, and every dock set is evaluated again on all scenarios.`),
  ...figure("fig2_method.png", "Study design: scenarios, adaptive plans, dock strategies, fixed-dock plans and metrics."),
  H2("Relief planner as evaluator"),
  P(`For a flood map, the weather and a set of permitted launch sites, the planner [5] segments flooded areas by colour, grows them by a weather-driven forecast over two hours, places drop points on the dry edges of flood zones, chooses up to *K* launch bases that together reach the most drop points, assigns each drop point to a base, splits each base's work into sorties that respect an 8 kg payload and an 80% battery limit, and routes each leg around current and forecast water. We use its open-source release with default settings (cruise 5 m/s, 7 min loaded endurance, 0.25 kg per kit, nominal scale 2 m per map pixel) and call it unmodified; the only intervention is the list of candidate base sites it may choose from. Its own documentation lists the battery model and the map scale as approximations, so absolute coverage figures here are indicative; all comparisons are made under identical settings.`),
  H2("Scenarios"),
  P(`We use the published flood maps of Varanasi and Kanpur from the 2025 Ganga floods, both Smart Cities Mission cities. Flood stage *g* represents rising water: the detected flood mask is grown by *g* ∈ {0, 3, 6, 9, 12} map pixels, which raises the flooded share of the map from ${pct(0.095)}% to ${pct(0.28)}% in Varanasi and from ${pct(0.149)}% to ${pct(0.393)}% in Kanpur. Three weather levels are used: calm (0 mm/h, 0 km/h), moderate (3 mm/h, 12 km/h) and heavy (10 mm/h, 30 km/h), with wind from the west. This gives 15 scenarios per city. Stages 0, 6 and 12 form the training set; stages 3 and 9 are held out for testing.`),
  H2("Strategies"),
  P(`**Adaptive.** The planner chooses up to six bases freely in every scenario. This is an upper bound for coverage, but it assumes that a launch site can be set up wherever the plan says, on the day.`),
  P(`**Robust docks.** Every base chosen in a training scenario is a candidate site *c*. Its score combines support and survival:`),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, tabStops: [{ type: "right", position: COL_DXA }],
    children: [new OMath({ children: [new MathRun("s(c) = a(c) · "),
      new MathSum({ children: [new MathRun("n(b)")], subScript: [new MathRun("b∈B, ‖b−c‖≤45")] })] }), run("\t(1)")] }),
  P(`where *B* is the set of bases in all training plans, *n*(*b*) the drop points base *b* served, and *a*(*c*) the share of training scenarios in which *c* is dry and clear of the forecast flood under the planner's own test. Sites are taken in order of score, skipping any closer than the planner's 150-pixel minimum base separation, until *H* docks are chosen; we use *H* = 4, 6 and 8.`, { noIndent: true }),
  P(`**Event-sited docks.** The bases the planner chose for one event, stage 0 under moderate weather (${D.varanasi.event.length} docks in Varanasi, ${D.kanpur.event.length} in Kanpur). This is what a city would install if it sited docks after studying its most recent flood.`),
  P(`**Uniform docks.** Six sites spread evenly over dry land by *k*-means clustering of the planner's dry grid points at stage 0, the naive geographic layout.`),
  P(`In every fixed-dock run the planner may choose bases only among the docks of the strategy that are dry and clear in that scenario; flooded docks are counted as lost.`),
  H2("Metrics"),
  P(`**Coverage** is the share of the scenario's drop points that the plan serves. **Regret** is the relative loss of served drop points against the adaptive plan of the same scenario. **Docks lost** counts docks that are flooded or within the planner's clearance of the forecast flood. **Service level** is the share of drop points served within 30 minutes of dispatch, using the routed path at 5 m/s, 40 s to climb to 100 m, 101 s per drop (descent to 10 m, 5 s loiter, climb), 80 s to land and 120 s to swap a battery and reload; vertical speeds follow ArduCopter defaults [18]. **Base displacement** is the mean distance from each adaptive base to the nearest base of the next flood stage. **Planning latency** is the wall time of a planner run.`),
];

module.exports = { AUTHORS, front, authorTable, abstract, intro, related, arch, method, P, H1, H2, bullet, figure, table, eq, run, rich,
  R, IOT, S, pct, disp, L, D, PAGE, MARGIN, FULL_DXA, COL_DXA, COL_GAP, FONT, Document, Packer, Paragraph, TextRun,
  AlignmentType, SectionType, Footer, PageNumber, LevelFormat };
