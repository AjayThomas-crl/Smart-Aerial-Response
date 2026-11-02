// Builds deliverables/Smart_Aerial_Response.pptx: the final Design of Smart Cities (IoT) course deck.
// Flow: context, objectives, requirements, IoT architecture, implementation, testing, outcome, dock-siting study,
// cost, research paper, conclusion. Numbers come from the IoT-loop runs, the dock study and the test results;
// the reused A.D.A.P.T. planner is cited as a service, not presented as this project's result.
// Run: NODE_PATH=<folder with node_modules> node deliverables/build/build_deck.js <path to pptx skill>
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const md = require("react-icons/md");
const { applyTheme } = require(path.join(process.argv[2], "scripts", "apply_theme.js"));

const ROOT = path.join(__dirname, "..", "..");
const FIG = p => path.join(ROOT, "deliverables", "figures", p);
const PFIG = p => path.join(ROOT, "research", "paper", "figures", p);
const json = p => JSON.parse(fs.readFileSync(path.join(ROOT, p)));
const A = json("research/authors.json");
const R = json("research/hub_study/results.json");
const IOT = json("research/hub_study/iot_budget.json");
const LAT = json("research/hub_study/latency_isolated.json");
const TESTS = fs.existsSync(path.join(ROOT, "tests/results/summary.json")) ? json("tests/results/summary.json") : null;
const cov = (c, s, part = "test") => Math.round(100 * R.per_strategy[c][s][part].coverage);
// latest IoT-loop run per city (iot/run_iot_demo.py writes iot/runs/<city>_<time>/summary.json)
const LOOP = {};
const runsDir = path.join(ROOT, "iot", "runs");
for (const d of (fs.existsSync(runsDir) ? fs.readdirSync(runsDir).sort() : [])) {
  const f = path.join(runsDir, d, "summary.json");
  if (fs.existsSync(f)) { const r = JSON.parse(fs.readFileSync(f)); LOOP[r.city] = r; }
}
const loopLine = c => { const p = (LOOP[c] || {}).plans || []; return p.length ? `${p.length} re-plans, dry docks ${p[0].docks_dry}→${p[p.length - 1].docks_dry}` : "not run yet"; };
const CITY_NAME = { varanasi: "Varanasi", kanpur: "Kanpur" };

// Flood-command palette: navy operations room, flood blue, one loud relief-amber accent.
const THEME = {
  name: "Smart Aerial Response", headFontFace: "Calibri", bodyFontFace: "Calibri",
  colors: { dk1: "13202C", lt1: "FFFFFF", dk2: "0E2A47", lt2: "EEF3F8", accent1: "E09A00", accent2: "1F6FB2",
            accent3: "2F8F5B", accent4: "9AA8B5", accent5: "B3372C", accent6: "56657A", hlink: "1F6FB2", folHlink: "56657A" },
};
const HEX = { navy: "0E2A47", amber: "E09A00", blue: "1F6FB2", green: "2F8F5B", grey: "9AA8B5", muted: "56657A", ink: "13202C", tint: "EEF3F8", white: "FFFFFF", teal: "0B7A75" };

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

// test categories shown when tests/results/summary.json is missing (the slide is rebuilt once tests have run)
const PLANNED_TESTS = ["Unit: planner building blocks", "IoT layer: codec, broker, trigger engine", "Dock-siting study scripts",
                       "System: server and end-to-end planning", "Performance: re-plan latency"];
const CATEGORY = { U: "Unit: acceptance tests of the reused planner", I: "IoT integration: codec, MQTT, bridge, trigger engine",
                   S: "Study and data: dock sets, results, message budget", T: "System: server, dashboard, IoT loop with planner" };
function testRows() {
  if (!TESTS) return { rows: PLANNED_TESTS.map(n => [n, "–", "–", "pending"]), total: null };
  let cats = Array.isArray(TESTS.categories) ? TESTS.categories
    : Object.entries(TESTS.categories || {}).map(([name, v]) => ({ name, ...v }));
  if (!cats.length && Array.isArray(TESTS.cases)) {         // derive from case ids: TC-U, TC-I, TC-S, TC-T
    const by = {};
    for (const c of TESTS.cases) {
      const k = (/^TC-([A-Z])/.exec(c.id || "") || [])[1] || "?";
      const b = by[k] || (by[k] = { name: CATEGORY[k] || `Other (${k})`, total: 0, passed: 0, failed: 0, skipped: 0 });
      b.total++; b[c.status === "pass" ? "passed" : c.status === "skip" || c.status === "skipped" ? "skipped" : "failed"]++;
    }
    cats = ["U", "I", "S", "T", "?"].filter(k => by[k]).map(k => by[k]);
  }
  const rows = cats.map(c => {
    const total = c.total ?? (c.passed ?? 0) + (c.failed ?? 0) + (c.skipped ?? 0);
    return [c.name, String(total), String(c.passed ?? 0), c.failed ? `${c.failed} failed` : "pass"];
  });
  const total = TESTS.total ?? cats.reduce((a, c) => a + (c.total ?? (c.passed ?? 0) + (c.failed ?? 0) + (c.skipped ?? 0)), 0);
  const passed = TESTS.passed ?? cats.reduce((a, c) => a + (c.passed ?? 0), 0);
  return { rows, total, passed };
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";               // 10 x 5.625 in
  pres.title = "Smart Aerial Response";
  pres.author = [A.guide.name, ...A.students.map(s => s.name)].join("; ");
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  // ---------- layouts ----------
  pres.defineSlideMaster({
    title: "TITLE_DARK", background: { color: HEX.navy },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.9, w: 8.8, h: 1.1, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
              { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 2.1, w: 8.8, h: 0.8, fontSize: 18, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } }],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { color: HEX.white },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9, h: 0.7, fontSize: 28, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: "Smart Aerial Response · Design of Smart Cities", options: { x: 0.5, y: 5.25, w: 5, h: 0.25, fontSize: 9, color: C.accent6, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.25, w: 0.5, h: 0.25, fontSize: 9, color: HEX.muted, align: "right" },
  });
  pres.defineSlideMaster({
    title: "SECTION_DARK", background: { color: HEX.navy },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 8.8, h: 0.7, fontSize: 28, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } }],
    slideNumber: { x: 9.0, y: 5.25, w: 0.5, h: 0.25, fontSize: 9, color: "C9D4DF", align: "right" },
  });

  const I = {};
  for (const [k, comp, col] of [["flood", md.MdFlood, HEX.blue], ["boat", md.MdDirectionsBoat, HEX.blue], ["batt", md.MdBatteryChargingFull, HEX.blue],
    ["twin", md.MdViewInAr, HEX.blue],
    ["storm", md.MdThunderstorm, HEX.white], ["hub", md.MdHub, HEX.white], ["shield", md.MdShield, HEX.white], ["route", md.MdAltRoute, HEX.white],
    ["doc", md.MdDescription, HEX.white], ["warn", md.MdReportProblem, HEX.white], ["sensors", md.MdSensors, HEX.white], ["city", md.MdLocationCity, HEX.white],
    ["map", md.MdSatelliteAlt, HEX.white], ["sync", md.MdSync, HEX.white], ["science", md.MdScience, HEX.white], ["dock", md.MdHome, HEX.white],
    ["check", md.MdCheckCircle, HEX.green]])
    I[k] = await icon(comp, col);

  const iconDisc = (s, img, x, y, d = 0.5, fill = HEX.navy, name = "icon") => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name + " disc" });
    s.addImage({ data: img, x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6, objectName: name });
  };
  const text = (s, t, o) => s.addText(t, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
  const card = (s, x, y, w, h, fill = HEX.tint, name = "card") =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });
  // place an image inside a box, keeping its aspect ratio, centred
  const fit = async (s, file, x, y, w, h, name, align = "center") => {
    const { width, height } = await sharp(file).metadata();
    const k = Math.min(w / width, h / height), iw = width * k, ih = height * k;
    const ix = align === "left" ? x : x + (w - iw) / 2;
    s.addImage({ path: file, x: ix, y: y + (h - ih) / 2, w: iw, h: ih, objectName: name });
    return { x: ix, y: y + (h - ih) / 2, w: iw, h: ih };
  };
  const bullets = items => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } }));

  // ===== 1. Title =====
  pres.addSection({ title: "Title" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Title" });
  s.addText("Smart Aerial Response", { placeholder: "title" });
  s.addText("An Autonomous UAV Framework for Resilient Flood Emergency Management in Smart Cities", { placeholder: "body" });
  text(s, "Case studies: Varanasi and Kanpur, Uttar Pradesh", { x: 0.6, y: 2.95, w: 8.8, h: 0.35, fontSize: 14, color: "F2B23A", bold: true });
  text(s, [
    { text: "Team  ", options: { bold: true, color: "F2B23A" } },
    { text: A.students.map(x => `${x.name} (${x.reg})`).join("   ·   "), options: { breakLine: true } },
    { text: "Guide  ", options: { bold: true, color: "F2B23A" } },
    { text: `${A.guide.name}, ${A.guide.designation}, SCOPE, VIT Vellore`, options: { breakLine: true } },
    { text: `${A.course} (Internet of Things)  ·  ${A.semester}`, options: {} },
  ], { x: 0.6, y: 3.65, w: 8.8, h: 1.2, fontSize: 13, color: "C9D4DF", paraSpaceAfter: 6 });
  s.addNotes(`Good morning. We are ${A.students.map(x => x.name).join(", ").replace(/, ([^,]*)$/, " and $1")}, working under ${A.guide.name}. Our project is the IoT layer that lets a smart city's command centre trigger drone relief planning from river gauges, and decide where drone docks should be installed, shown on Varanasi and Kanpur.`);

  // ===== 2. Abstract =====
  pres.addSection({ title: "Abstract" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Abstract" });
  s.addText("Abstract", { placeholder: "title" });
  text(s, "River gauges and drone docks report over LoRaWAN and MQTT to the city's command centre. When the river crosses its warning mark, a trigger engine re-plans relief missions from the docks that are still dry, using the existing open-source A.D.A.P.T. planner unchanged as the planning service. A scenario study chooses dock sites that stay usable as the flood rises.",
    { x: 0.5, y: 1.1, w: 9, h: 1.15, fontSize: 15, color: C.text1 });
  const nPlans = c => ((LOOP[c] || {}).plans || []).length;
  const T0 = testRows();
  const stats = [[`${cov("varanasi", "robust6")}% · ${cov("kanpur", "robust6")}%`, "robust-dock coverage on unseen flood stages (Varanasi · Kanpur)"],
                 [`${IOT.total_kbit_s}`, "kbit/s message budget per city (computed, not measured)"],
                 [`${nPlans("varanasi")} · ${nPlans("kanpur")}`, `automatic re-plans in the IoT loop; dry docks fell to ${(LOOP.varanasi?.plans || []).slice(-1)[0]?.docks_dry ?? "–"} and ${(LOOP.kanpur?.plans || []).slice(-1)[0]?.docks_dry ?? "–"} of 6`],
                 [T0.total ? `${T0.passed}/${T0.total}` : "–", T0.total ? "automated tests passed (pytest)" : "tests pending"]];
  stats.forEach(([big, small], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 2.45, 2.1, 1.9, HEX.tint, `stat card ${i + 1}`);
    text(s, big, { x: x + 0.15, y: 2.6, w: 1.8, h: 0.8, fontSize: i === 0 ? 26 : 34, bold: true, color: i === 0 ? C.accent1 : C.text2, valign: "middle" });
    text(s, small, { x: x + 0.15, y: 3.45, w: 1.8, h: 0.85, fontSize: 12, color: C.accent6 });
  });
  text(s, "Software-in-the-loop prototype: sensors are simulated and missions are validated in software, not yet flown.", { x: 0.5, y: 4.6, w: 9, h: 0.35, fontSize: 12, italic: true, color: C.accent6 });
  s.addNotes(`Our work is the IoT layer around an existing open-source planner. Sensors trigger planning automatically, the planner is called with only the docks that are still dry, and our dock-siting study shows where the city should install docks: robust docks keep ${cov("varanasi", "robust6")} and ${cov("kanpur", "robust6")} percent coverage on flood stages they were not chosen from. The message budget is a calculation, and the re-plan counts come from our IoT loop runs.`);

  // ===== 3. Problem & context =====
  pres.addSection({ title: "Introduction" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Introduction" });
  s.addText("Problem: floods cut people off", { placeholder: "title" });
  s.addImage({ path: path.join(ROOT, "demo/static/data/varanasi_map.jpg"), x: 5.6, y: 1.15, w: 3.9, h: 3.75, sizing: { type: "cover", w: 3.9, h: 3.75 }, objectName: "Varanasi flood map" });
  text(s, "Varanasi flood extent, August 2025 (ESA satellite data)", { x: 5.6, y: 4.95, w: 3.9, h: 0.22, fontSize: 9, color: C.accent6 });
  const probs = [[I.flood, "2025 Ganga floods", "In Varanasi the Ganga crossed its danger mark: 84 ghats submerged, over 6,500 people displaced (News18, Aug 2025)."],
                 [I.boat, "Ground relief is slow", "Boats struggle in fast water and helicopters are scarce; marooned pockets wait hours for food and medicine."],
                 [I.twin, "Cities already have the data", "Varanasi built a 3-D digital twin to predict flooded homes; Kanpur and Varanasi run ICCCs. The missing link is acting on it."]];
  probs.forEach(([img, h, b], i) => {
    const y = 1.2 + i * 1.28;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y, w: 0.6, h: 0.6, fill: { color: HEX.tint }, line: { color: HEX.tint }, objectName: `problem disc ${i + 1}` });
    s.addImage({ data: img, x: 0.62, y: y + 0.12, w: 0.36, h: 0.36, objectName: `problem icon ${i + 1}` });
    text(s, h, { x: 1.3, y: y - 0.02, w: 4.1, h: 0.33, fontSize: 16, bold: true, color: C.text2 });
    text(s, b, { x: 1.3, y: y + 0.33, w: 4.1, h: 0.85, fontSize: 13, color: C.text1 });
  });
  s.addNotes("Varanasi and Kanpur are Smart Cities Mission cities on the Ganga and both flooded in 2025. In Varanasi 84 ghats went under water and more than 6,500 people were displaced. The city already has sensors, a digital twin and a command centre; what it lacks is a system that turns those signals into relief missions automatically.");

  // ===== 4. Objectives =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Introduction" });
  s.addText("Objectives", { placeholder: "title" });
  const objs = [["Sense", "River gauges and docks report over LoRaWAN / MQTT to the ICCC"], ["Trigger", "Re-plan automatically when the river crosses its CWC warning mark"],
                ["Plan", "Call the existing A.D.A.P.T. planner as a service, with dry docks only"], ["Stay safe", "Never launch from a flooded dock; keep the planner's battery checks"],
                ["Site docks", "Find dock sites that stay dry as the flood rises"], ["Show", "A live command-centre dashboard for city officials"]];
  objs.forEach(([h, b], i) => {
    const x = 0.5 + (i % 3) * 3.05, y = 1.2 + Math.floor(i / 3) * 1.95;
    card(s, x, y, 2.85, 1.75, HEX.tint, `objective card ${i + 1}`);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.45, h: 0.45, fill: { color: HEX.navy }, line: { color: HEX.navy }, objectName: `objective number disc ${i + 1}` });
    text(s, String(i + 1), { x: x + 0.2, y: y + 0.2, w: 0.45, h: 0.45, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    text(s, h, { x: x + 0.8, y: y + 0.22, w: 1.9, h: 0.4, fontSize: 16, bold: true, color: C.text2, valign: "middle" });
    text(s, b, { x: x + 0.2, y: y + 0.8, w: 2.45, h: 0.85, fontSize: 13, color: C.text1 });
  });
  s.addNotes("Six objectives that follow the IoT pipeline: sense, trigger, plan, keep it safe, choose where the infrastructure goes, and show it to the city. Objective five is our research contribution: dock sites that survive a rising flood.");

  // ===== 5. Requirements =====
  pres.addSection({ title: "Requirements" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Requirements" });
  s.addText("Requirements", { placeholder: "title" });
  for (const [col, ttl, items] of [
    [0, "Functional", ["Ingest gauge levels, dock status and weather", "Detect flood extent from a satellite map", "Trigger a re-plan on warning or stage rise",
                       "Choose bases only from dry docks", "Route around current and 2-h forecast water", "Export one QGC WPL 110 mission per drone", "Hand unreachable points to boat teams"]],
    [1, "Non-functional", ["Re-plan in about a minute on a laptop", "City-wide IoT traffic ≤ 10 kbit/s", "Battery ≤ 80% and payload ≤ 8 kg per sortie",
                           "Zero route crossings between drones", "Open data and open standards (MQTT, LoRaWAN, MAVLink)", "Clear failure messages; never a silent drop"]]]) {
    const x = 0.5 + col * 4.6;
    card(s, x, 1.15, 4.4, 3.85, col ? "FDF1D6" : HEX.tint, `${ttl} requirements card`);
    text(s, ttl, { x: x + 0.25, y: 1.3, w: 3.9, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    text(s, bullets(items), { x: x + 0.25, y: 1.8, w: 3.95, h: 3.1, fontSize: 13, color: C.text1, paraSpaceAfter: 5 });
  }
  s.addNotes("These are the key requirements from our SRS; the full list with IDs is in the report. Functional requirements follow the data from sensors to missions. The non-functional ones are what make it usable in a real command centre: fast, light on the network, and safe.");

  // ===== 6. IoT architecture =====
  pres.addSection({ title: "Architecture" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  s.addText("IoT architecture: five layers", { placeholder: "title" });
  await fit(s, PFIG("fig1_iot_architecture.png"), 0.5, 1.1, 4.1, 4.05, "five-layer IoT architecture", "left");
  const layers = [["Perception", "River and rain gauges, satellite flood maps, dock sensors, drone telemetry"],
                  ["Network", "LoRaWAN for gauges (12-byte uplinks), 4G/5G + MQTT for docks and drones"],
                  ["Middleware", "MQTT broker, time-series store, digital twin, trigger engine"],
                  ["Decision", "Swarm planner with bases limited to dry docks; offline dock-siting study"],
                  ["Application", "ICCC dashboard, mission dispatch, hand-off to NDRF / boat teams"]];
  layers.forEach(([h, b], i) => {
    const y = 1.15 + i * 0.8;
    s.addShape(pres.shapes.RECTANGLE, { x: 4.95, y, w: 0.07, h: 0.65, fill: { color: i === 3 ? HEX.teal : HEX.navy }, line: { color: i === 3 ? HEX.teal : HEX.navy }, objectName: `layer bar ${i + 1}` });
    text(s, h, { x: 5.15, y, w: 4.35, h: 0.28, fontSize: 14, bold: true, color: C.text2 });
    text(s, b, { x: 5.15, y: y + 0.29, w: 4.35, h: 0.45, fontSize: 12, color: C.text1 });
  });
  s.addNotes("This is the standard five-layer IoT stack applied to flood relief. Teal boxes are the closed loop: a sensor trigger in the middleware drives the planner in the decision layer, which dispatches missions. Public alerts are dashed because we considered but did not build them.");

  // ===== 7-8. System and planner architecture =====
  for (const [file, ttl, note] of [
    ["architecture_system.png", "Smart-city system architecture",
     "Four layers. City data in: satellite flood map, live weather, sensor triggers. Intelligence: the existing open-source A.D.A.P.T. planner, which we use unchanged as a service. Execution: one mission file per drone. Command centre: live dashboard, relief to citizens, unreachable points to NDRF and boat teams."],
  ]) {
    s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
    s.addText(ttl, { placeholder: "title" });
    await fit(s, FIG(file), 0.5, 1.1, 9, 3.65, ttl);
    text(s, "Planning service: the existing open-source A.D.A.P.T. planner [10], used unchanged. Our work is the IoT layer, dock siting and the ICCC dashboard around it.", { x: 0.5, y: 4.82, w: 9, h: 0.3, fontSize: 11, italic: true, color: C.accent6 });
    s.addNotes(note);
  }

  // ===== 9. Implementation: IoT loop =====
  pres.addSection({ title: "Implementation" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Implementation" });
  s.addText("Implementation: the IoT trigger loop", { placeholder: "title" });
  const steps = [[I.sensors, "Gauges", "12-byte LoRaWAN uplink: id, time, level, rate, battery"], [I.sync, "Network server", "decodes uplinks to JSON on sar/<city>/gauge/…"],
                 [I.hub, "MQTT broker", "amqtt, in-process; docks publish status every second"], [I.warn, "Trigger engine", "level ≥ warning and stage rising → re-plan"],
                 [I.route, "Planner [10]", "existing A.D.A.P.T., unchanged; dry docks only"], [I.city, "ICCC", "plan summary on sar/<city>/iccc/plan"]];
  steps.forEach(([img, h, b], i) => {
    const x = 0.5 + i * 1.53;
    iconDisc(s, img, x + 0.42, 1.2, 0.6, i === 3 || i === 4 ? HEX.teal : HEX.navy, `loop step icon ${i + 1}`);
    if (i < steps.length - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 1.15, y: 1.38, w: 0.32, h: 0.24, fill: { color: HEX.grey }, line: { color: HEX.grey }, objectName: `loop arrow ${i + 1}` });
    text(s, h, { x, y: 1.9, w: 1.45, h: 0.3, fontSize: 13, bold: true, color: C.text2, align: "center" });
    text(s, b, { x, y: 2.22, w: 1.45, h: 0.85, fontSize: 11, color: C.text1, align: "center" });
  });
  const head = ["Reference gauge (CWC)", "Warning mark", "Danger mark"].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, align: i ? "center" : "left" } }));
  const g = [["Varanasi · Rajghat", "70.262 m", "71.262 m"], ["Kanpur · Ganga Barrage", "114.000 m", "115.000 m"]]
    .map((r, ri) => r.map((c, i) => ({ text: c, options: { align: i ? "center" : "left", fill: { color: ri % 2 ? HEX.white : HEX.tint } } })));
  s.addTable([head, ...g], { x: 0.5, y: 3.3, w: 6.2, colW: [2.6, 1.8, 1.8], fontSize: 12, fontFace: "Calibri", color: HEX.ink, rowH: 0.36, border: { type: "solid", pt: 0.5, color: "C9D4DF" }, objectName: "gauge thresholds table" });
  text(s, "Planner flood stage: 0 at the warning mark, 6 at the danger mark, 12 at danger + 1 m.", { x: 0.5, y: 4.48, w: 6.2, h: 0.32, fontSize: 11, color: C.text1 });
  card(s, 6.95, 3.3, 2.55, 1.5, "E2F3E9", "loop result card");
  text(s, "Each rise in flood stage drops flooded docks from the dry set and re-plans the swarm automatically.", { x: 7.1, y: 3.3, w: 2.25, h: 1.5, fontSize: 12, bold: true, color: C.text1, valign: "middle" });
  text(s, "iot/smartcity_iot.py · iot/run_iot_demo.py · planner: existing open-source A.D.A.P.T. [10], used unchanged", { x: 0.5, y: 4.85, w: 9, h: 0.25, fontSize: 10, italic: true, color: C.accent6 });
  s.addNotes("This loop runs on a laptop with a real MQTT broker. Simulated gauges send packed LoRaWAN uplinks, a network-server step decodes them, and the trigger engine watches the reference gauge against the Central Water Commission warning and danger marks. Every time the flood stage rises, it re-plans with only the docks that report dry.");

  // ===== 10. Implementation: planner + live dashboard =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Implementation" });
  s.addText("Implementation: ICCC dashboard", { placeholder: "title" });
  await fit(s, FIG("demo_varanasi.jpg"), 0.5, 1.1, 5.9, 3.55, "command centre screenshot", "left");
  text(s, "Command-centre view replaying a Varanasi plan: drones, docks, kits delivered and the planner log", { x: 0.5, y: 4.72, w: 5.9, h: 0.3, fontSize: 10, color: C.accent6 });
  text(s, [
    { text: "1  ", options: { bold: true, color: HEX.amber } }, { text: "One button starts a planning run; its log streams live to the browser (SSE)", options: { breakLine: true } },
    { text: "2  ", options: { bold: true, color: HEX.amber } }, { text: "Each finished plan is replayed on the city map with live telemetry", options: { breakLine: true } },
    { text: "3  ", options: { bold: true, color: HEX.amber } }, { text: "Battery, payload, sortie and kits per drone, as an ICCC operator sees them", options: { breakLine: true } },
    { text: "4  ", options: { bold: true, color: HEX.amber } }, { text: "Python standard-library server; no cloud services needed", options: {} },
  ], { x: 6.7, y: 1.15, w: 2.85, h: 3.6, fontSize: 13, color: C.text1, paraSpaceAfter: 8 });
  s.addNotes("Switch to the browser here: run demo/start_demo.sh and open localhost:8765. Start a planning run for Varanasi and let the log stream, then replay the plan on the map. This dashboard is the application layer of our IoT architecture: it is what an ICCC operator would watch.");

  // ===== 11. Novelty =====
  s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: "Implementation" });
  s.addText("Novelty: what is new", { placeholder: "title" });
  const nov = [[I.sensors, "IoT trigger loop", "River gauges over LoRaWAN and docks over MQTT start a re-plan the moment the flood stage rises, with CWC thresholds."],
               [I.dock, "Flood-resilient dock siting", "Dock sites chosen across many flood stages and weathers stay usable when the water rises; tested on held-out stages."],
               [I.city, "ICCC dashboard integration", "Plans arrive on an MQTT topic and are shown live to command-centre operators."],
               [I.shield, "Dry-dock safety rule", "The planner is only ever offered docks that report dry, so no mission starts from flooded ground."]];
  nov.forEach(([img, h, b], i) => {
    const y = 1.25 + i * 0.95;
    iconDisc(s, img, 0.6, y, 0.55, HEX.teal, `novelty icon ${i + 1}`);
    text(s, h, { x: 1.4, y: y - 0.02, w: 2.9, h: 0.6, fontSize: 16, bold: true, color: "F2B23A", valign: "middle" });
    text(s, b, { x: 4.3, y: y - 0.02, w: 5.2, h: 0.6, fontSize: 13, color: C.background1, valign: "middle" });
  });
  s.addNotes("Everything on this slide is our own contribution; the route planner itself is an existing open-source tool we reuse unchanged. What is new is the IoT loop that triggers planning from river gauges, the study that tells the city where to put docks, and the integration with the command-centre dashboard.");

  // ===== 12. Testing =====
  pres.addSection({ title: "Testing" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Testing" });
  s.addText("Testing", { placeholder: "title" });
  const T = testRows();
  const th = ["Category", "Tests", "Passed", "Result"].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, align: i ? "center" : "left" } }));
  const tr = T.rows.map((r, ri) => r.map((c, i) => ({ text: c, options: { align: i ? "center" : "left", fill: { color: ri % 2 ? HEX.white : HEX.tint },
    color: i === 3 ? (c === "pass" ? HEX.green : c === "pending" ? HEX.muted : "B3372C") : HEX.ink, bold: i === 3 } })));
  s.addTable([th, ...tr], { x: 0.5, y: 1.15, w: 6.1, colW: [3.4, 0.85, 0.85, 1.0], fontSize: 12, fontFace: "Calibri", color: HEX.ink, rowH: 0.4, border: { type: "solid", pt: 0.5, color: "C9D4DF" }, objectName: "test results table" });
  card(s, 6.9, 1.15, 2.6, 1.9, T.total ? "E2F3E9" : HEX.tint, "test total card");
  text(s, T.total ? `${T.passed}/${T.total}` : "pending", { x: 7.05, y: 1.3, w: 2.3, h: 0.8, fontSize: T.total ? 38 : 28, bold: true, color: T.total ? HEX.green : C.accent6, valign: "middle" });
  text(s, T.total ? `tests passed (${Math.round(100 * T.passed / T.total)}%), pytest${T.total - T.passed ? `; ${T.total - T.passed} failing` : ""}` : "results are added when the test suite has run", { x: 7.05, y: 2.15, w: 2.3, h: 0.8, fontSize: 12, color: C.text1 });
  text(s, bullets(["Unit tests are acceptance tests of the reused planner", "180 scenario runs of the dock study all completed", `IoT loop: ${loopLine("varanasi")} (VNS); ${loopLine("kanpur")} (KNP)`]),
    { x: 6.9, y: 3.25, w: 2.6, h: 1.75, fontSize: 12, color: C.text1, paraSpaceAfter: 5 });
  s.addNotes(T.total ? `We wrote ${T.total} automated tests with pytest across unit, IoT, study and system levels; ${T.passed} pass. The unit tests check that the reused planner behaves as our system expects; the IoT and system tests cover our own code, including the broker, the trigger engine and the full loop.`
    : "Our tests cover the planner building blocks, the IoT layer, the study scripts and the full system. On the right are the scenario-level checks from the dock study: all 180 runs completed with no route crossings.");

  // ===== 12. Outcome: IoT loop results =====
  pres.addSection({ title: "Outcome" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Outcome" });
  s.addText("Outcome: the IoT loop re-plans as the river rises", { placeholder: "title" });
  const oh = ["City", "Plan", "Flood stage", "Docks dry", "Drops served", "Planner (s)"].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, align: i ? "center" : "left" } }));
  const orows = [];
  for (const c of ["varanasi", "kanpur"])
    for (const p of (LOOP[c] || {}).plans || [])
      orows.push([CITY_NAME[c], `#${p.n}`, String(p.stage), `${p.docks_dry} of ${p.docks_total}`,
                  p.served != null ? `${p.served} of ${p.drop_points}` : "–", p.planner_s != null ? String(Math.round(p.planner_s)) : "–"]);
  if (!orows.length) orows.push(["IoT loop not run yet", "", "", "", "", ""]);
  s.addTable([oh, ...orows.map((r, ri) => r.map((c, i) => ({ text: c, options: { align: i ? "center" : "left", fill: { color: ri % 2 ? HEX.white : HEX.tint } } })))],
    { x: 0.5, y: 1.15, w: 5.6, colW: [1.1, 0.6, 0.95, 0.95, 1.1, 0.9], fontSize: 12, fontFace: "Calibri", color: HEX.ink, rowH: 0.36, border: { type: "solid", pt: 0.5, color: "C9D4DF" }, objectName: "IoT loop results table" });
  text(s, "Heavy weather; river rising from 0.3 m below the warning mark to 1.25 m above danger (iot/runs/*/summary.json).", { x: 0.5, y: 3.8, w: 5.6, h: 0.45, fontSize: 10, italic: true, color: C.accent6 });
  text(s, "Drop points change with the flood stage, so compare plans within a row, not across rows.", { x: 0.5, y: 4.3, w: 5.6, h: 0.45, fontSize: 10, italic: true, color: C.accent6 });
  card(s, 6.4, 1.15, 3.1, 1.75, "E2F3E9", "dock study headline card");
  text(s, `${cov("varanasi", "robust6")}% · ${cov("kanpur", "robust6")}%`, { x: 6.55, y: 1.25, w: 2.8, h: 0.6, fontSize: 28, bold: true, color: HEX.green, valign: "middle" });
  text(s, `coverage with robust docks on unseen flood stages, against ${cov("varanasi", "event")}% · ${cov("kanpur", "event")}% for docks sited from one past flood`, { x: 6.55, y: 1.9, w: 2.8, h: 0.95, fontSize: 11, color: C.text1 });
  await fit(s, FIG("demo_varanasi.jpg"), 6.4, 3.05, 3.1, 1.75, "ICCC dashboard thumbnail");
  text(s, "Each plan is published to the ICCC dashboard", { x: 6.4, y: 4.85, w: 3.1, h: 0.25, fontSize: 10, color: C.accent6, align: "center" });
  s.addNotes(`These are results of our IoT loop. As the simulated river rose past the warning and danger marks, the trigger engine re-planned automatically: ${loopLine("varanasi")} in Varanasi and ${loopLine("kanpur")} in Kanpur, each time offering the planner only the docks that reported dry. The headline of the dock study is on the right.`);

  // ===== 13. Dock-siting study =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Outcome" });
  s.addText("Outcome: where should the city install docks?", { placeholder: "title" });
  await fit(s, PFIG("fig4_coverage_stage.png"), 0.5, 1.1, 3.6, 4.05, "coverage against flood stage", "left");
  await fit(s, PFIG("fig3_dock_maps.png"), 4.25, 1.1, 2.9, 2.1, "dock site maps");
  text(s, "Dock sites over the stage-0 flood; hollow = unusable at stage 12", { x: 4.25, y: 3.22, w: 2.9, h: 0.4, fontSize: 9, color: C.accent6, align: "center" });
  const dh = ["Docks (6)", "VNS", "KNP"].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, align: i ? "center" : "left" } }));
  const dr = [["Robust (ours)", "robust6"], ["Event-sited", "event"], ["Uniform", "uniform6"]]
    .map(([n, k], ri) => [n, `${cov("varanasi", k)}%`, `${cov("kanpur", k)}%`].map((c, i) => ({ text: c, options: { align: i ? "center" : "left", bold: ri === 0, fill: { color: ri % 2 ? HEX.white : HEX.tint } } })));
  s.addTable([dh, ...dr], { x: 4.25, y: 3.7, w: 2.9, colW: [1.5, 0.7, 0.7], fontSize: 12, fontFace: "Calibri", color: HEX.ink, rowH: 0.3, border: { type: "solid", pt: 0.5, color: "C9D4DF" }, objectName: "dock coverage table" });
  text(s, "Coverage on unseen flood stages", { x: 4.25, y: 4.95, w: 2.9, h: 0.22, fontSize: 9, color: C.accent6, align: "center" });
  text(s, bullets(["180 planner runs: 2 cities × 5 flood stages × 3 weathers",
                   "Docks sited from one past flood lose about 2.5 of 5 to the water",
                   `Freely re-sited bases reach ${cov("varanasi", "adaptive")}% / ${cov("kanpur", "adaptive")}%, but must move about 260–290 m at every rise`]),
    { x: 7.35, y: 1.15, w: 2.2, h: 3.9, fontSize: 12, color: C.text1, paraSpaceAfter: 8 });
  s.addNotes(`This is our research contribution. We tested where to install permanent docks across rising flood stages. Docks chosen with our robust method serve ${cov("varanasi", "robust6")}% of drop points in Varanasi and ${cov("kanpur", "robust6")}% in Kanpur on flood stages they were not chosen from, against ${cov("varanasi", "event")}% and ${cov("kanpur", "event")}% for docks sited from a single past flood, which the rising water covers.`);

  // ===== 16. Cost sketch + research paper =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Outcome" });
  s.addText("Cost sketch and research outcome", { placeholder: "title" });
  const ch = ["Item (per city)", "Qty", "Indicative list price"].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, align: i ? "center" : "left" } }));
  const cr = [["Drone-in-a-box dock + drone (DJI Dock 2 bundle)", "6", "₹12.3–20.2 lakh each"], ["LoRaWAN ultrasonic level sensor (Dragino LDDS20)", "20", "≈ US$79 each"],
              ["MQTT broker, planner, dashboard", "1", "open source, existing ICCC servers"]]
    .map((r, ri) => r.map((c, i) => ({ text: c, options: { align: i ? "center" : "left", fill: { color: ri % 2 ? HEX.white : HEX.tint } } })));
  s.addTable([ch, ...cr], { x: 0.5, y: 1.15, w: 5.4, colW: [2.9, 0.5, 2.0], fontSize: 11, fontFace: "Calibri", color: HEX.ink, rowH: 0.45, border: { type: "solid", pt: 0.5, color: "C9D4DF" }, objectName: "cost table" });
  text(s, "Indicative list prices from Indian resellers and the vendor web shop (Oct 2026), not quotations. The docks dominate the cost, which is why siting them where they survive the flood matters.",
    { x: 0.5, y: 3.25, w: 5.4, h: 0.8, fontSize: 11, italic: true, color: C.accent6 });
  card(s, 6.2, 1.15, 3.3, 2.95, "FDF1D6", "research paper card");
  iconDisc(s, I.doc, 6.4, 1.35, 0.55, HEX.navy, "paper icon");
  text(s, "IEEE-format research paper", { x: 7.1, y: 1.38, w: 2.3, h: 0.5, fontSize: 14, bold: true, color: C.text2, valign: "middle" });
  text(s, "Flood-Resilient Siting of IoT Drone Docks for Smart-City Relief: A Scenario Study of Varanasi and Kanpur", { x: 6.4, y: 2.05, w: 2.95, h: 1.0, fontSize: 12, italic: true, color: C.text1 });
  text(s, [A.guide.name, ...A.paper_order].join(", "), { x: 6.4, y: 3.1, w: 2.95, h: 0.5, fontSize: 12, bold: true, color: C.text1 });
  text(s, "6 pages, two-column IEEE format; built on 180 new planner runs", { x: 6.4, y: 3.55, w: 2.95, h: 0.45, fontSize: 11, color: C.accent6 });
  s.addNotes("For a city, six dock-and-drone bundles are the main cost, at roughly 12 to 20 lakh rupees each at list price; the twenty gauges are a small fraction. These are indicative list prices, not quotes. Our unique outcome is an IEEE-format research paper on dock siting, with our guide as first author.");

  // ===== 17. Conclusion & future work =====
  s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: "Outcome" });
  s.addText("Conclusion and future work", { placeholder: "title" });
  text(s, "From a river-gauge reading to relief missions from dry docks, automatically.", { x: 0.6, y: 1.25, w: 8.8, h: 0.9, fontSize: 24, bold: true, color: "F2B23A" });
  text(s, bullets([`IoT loop re-plans on CWC thresholds: ${loopLine("varanasi")} (Varanasi), ${loopLine("kanpur")} (Kanpur)`,
                   `Robust dock sites keep ${cov("varanasi", "robust6")}% / ${cov("kanpur", "robust6")}% coverage as the flood rises`,
                   `Message budget ${IOT.total_kbit_s} kbit/s per city; standard protocols fit a smart city's ICCC`]),
    { x: 0.6, y: 2.25, w: 4.5, h: 2.7, fontSize: 14, color: C.background1, paraSpaceAfter: 10 });
  text(s, "Next", { x: 5.5, y: 2.25, w: 3.9, h: 0.35, fontSize: 15, bold: true, color: "F2B23A" });
  text(s, bullets(["Field gauges and a LoRaWAN gateway", "Georeferenced maps (GeoTIFF input is supported)", "Flight trials in ArduPilot SITL, then outdoors", "Hydraulic flood model in place of mask growth"]),
    { x: 5.5, y: 2.65, w: 3.9, h: 2.3, fontSize: 13, color: C.background1, paraSpaceAfter: 8 });
  s.addNotes("To close: our IoT layer turns river-gauge readings into relief missions from docks that are still dry, and our study tells the city where those docks should go. Everything is simulated so far; the next steps are real gauges and a LoRaWAN gateway, georeferenced maps and flight trials.");

  // ===== 18. References =====
  pres.addSection({ title: "References" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "References" });
  s.addText("References", { placeholder: "title" });
  const refs = [
    "S. Koenig, M. Likhachev, \"D* Lite,\" AAAI, 2002.",
    "M. Erdelj et al., \"Help from the sky: Leveraging UAVs for disaster management,\" IEEE Pervasive Computing, 16(1), 2017.",
    "N. Mohamed et al., \"Unmanned aerial vehicles applications in future smart cities,\" Technol. Forecast. Soc. Change, 153, 2020.",
    "A. Zanella et al., \"Internet of Things for smart cities,\" IEEE Internet of Things Journal, 1(1), 2014.",
    "LoRa Alliance, LoRaWAN Regional Parameters; OASIS, MQTT Version 5.0, 2019.",
    "MoHUA, Government of India, Smart Cities Mission, smartcities.gov.in",
    "Central Water Commission flood levels, as reported for Varanasi (Rajghat) and Kanpur (Ganga Barrage), Sept 2026.",
    "News18, \"Ganga crosses danger mark in Varanasi; 84 ghats submerged, over 6,500 displaced,\" Aug 2025.",
    "Times of India, \"3D digital twin helps Kashi plan flood response in advance,\" Sept 2026.",
    "T. Saha et al., A.D.A.P.T.: Autonomous Drone for Adaptive Path Tracking, GitHub, 2026.",
  ];
  text(s, refs.map((r, i) => ({ text: `[${i + 1}]  ${r}`, options: { breakLine: i < refs.length - 1 } })),
    { x: 0.5, y: 1.1, w: 9, h: 3.95, fontSize: 12, color: C.text1, paraSpaceAfter: 5 });
  s.addNotes("The full reference list is in the report and the research paper.");

  // ===== 19. Thank you =====
  pres.addSection({ title: "Close" });
  s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Close" });
  s.addText("Thank you", { placeholder: "title" });
  s.addText("Live demo: Varanasi and Kanpur  ·  Questions", { placeholder: "body" });
  s.addNotes("Thank you. We are happy to run the live demo again or take questions.");

  const file = path.join(ROOT, "deliverables", "Smart_Aerial_Response.pptx");
  await pres.writeFile({ fileName: file });
  await applyTheme(file, THEME);
  console.log("wrote", file, TESTS ? "(with test results)" : "(test results pending)");
})();
