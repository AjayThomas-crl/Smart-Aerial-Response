// Assembles the paper: front matter and Sections I-IV from build_paper.js, then results, discussion,
// conclusion and references, all numbers read from the study's results files.
const fs = require("fs");
const path = require("path");
const B = require("./build_paper.js");
const REFS = require("./references.js");
const { P, H1, H2, bullet, figure, table, run, rich, R, S, pct, disp, L, D, IOT,
  Document, Packer, Paragraph, AlignmentType, SectionType, Footer, PageNumber, LevelFormat,
  PAGE, MARGIN, COL_GAP, FONT } = B;

const C = ["varanasi", "kanpur"];
const name = c => c[0].toUpperCase() + c.slice(1);
const st = (c, s, part = "all") => S(c, s, part);
const iso = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hub_study", "latency_isolated.json")));

const allCov = (c, s) => Object.values(R.per_stage[c][s]).flatMap(v => v.coverage);
const minCov = (c, s) => Math.min(...allCov(c, s));
const results = [
  H1("Results"),
  P(`All 180 runs (30 adaptive, 150 fixed-dock) of the planner produced plans with no route crossings. For all scenarios, at least one dock of each strategy was usable for all stages of the flood. Table III summarizes the results for the three strategies on all scenarios as well as on the held-out stages alone (VNS: Varanasi, KNP: Kanpur).`),
  H2("Coverage under rising water (RQ1)"),
  P(`Fig. 3 shows the coverage of the fixed-dock strategies under rising water. Adaptive bases can reach 98% of drop points in Varanasi and 96% in Kanpur on average (minimum for a single scenario 92% and 81%). The coverage of fixed-dock strategies decreases with the flood stage but at very different rates. Robust docks are closest to the adaptive bound with a mean regret of 3% in Varanasi and 7% in Kanpur. Event-sited docks do well on the event they were chosen for but their coverage decreases significantly as the water level rises over them (mean regret 50% and 44%). Uniform docks are in the middle (mean regret 31% and 20%) with some docks being flooded and the remaining ones being far from the drop points on average.`),
  P(`The number of drop points itself changes with the flood stage. As separate pockets of water merge, the planner places fewer drop points on the larger merged zones (e.g. Kanpur falls from 46 to 13 drop points between stages 0 and 9). The coverage shares thus compare the strategies within a stage rather than across stages.`),
  ...figure("fig4_coverage_stage.png", "Share of drop points served as the flood rises. Markers: mean over the three weather levels; bars: range. Grey bands mark held-out stages."),
  ...table("Strategy comparison (mean over scenarios)",
    ["Strategy", "Docks", "Cov. all", "Cov. test", "Regret", "Lost (max)", "≤30 min"],
    C.flatMap(c => ["adaptive", "robust6", "event", "uniform6"].map(s => {
      const a = st(c, s), t = st(c, s, "test");
      const docks = s === "adaptive" ? "≤6" : String(R.hubs[c][s].length);
      const lost = s === "adaptive" ? "–" : `${a.docks_lost_mean.toFixed(1)} (${a.docks_lost_max})`;
      return [`${{ varanasi: "VNS", kanpur: "KNP" }[c]} ${{ adaptive: "adaptive", robust6: "robust", event: "event-sited", uniform6: "uniform" }[s]}`,
        docks, `${pct(a.coverage)}%`, `${pct(t.coverage)}%`, s === "adaptive" ? "–" : `${pct(a.regret)}%`, lost, `${pct(a.sla30)}%`];
    })),
    [1300, 580, 540, 540, 640, 720, 560]),
  H2("Dock survival (RQ1)"),
  ...figure("fig3_dock_maps.png", "Dock sites of the three fixed strategies over the stage-0 flood and the water added by stage 12. Hollow markers are docks unusable at stage 12 under heavy weather."),
  P(`Figures 4 and 5 (top) can explain the coverage gap of the fixed-dock strategies to the adaptive bound. The event-sited docks were placed where the planner wanted bases for the stage-0 flood. As the flood rises most of these docks are flooded or fall inside the clearance of the forecast flood. The robust docks lose fewer of their docks because the survival term *a*(*c*) in (1) favors sites that stayed dry across the training stages. The uniform docks were placed without regard to the water and thus their losses depend on where the clusters happen to fall. On average 2.5 of the 5 event-sited docks are unusable in Varanasi and 2.4 of 5 in Kanpur, against 0.1 and 1.0 of six robust docks and 1.3 and 1.6 of six uniform docks.`),
  ...figure("fig5_docks_sla.png", "Top: docks unusable at each flood stage (mean over weathers). Bottom: share of drop points served within 30 minutes of dispatch."),
  H2("Generalisation to unseen flood stages (RQ2)"),
  P(`Robust docks chosen from the stages 0, 6 and 12 serve 94% of drop points in Varanasi and 90% in Kanpur on the held-out stages 3 and 9. This compares to 96% and 88% on the training stages. Event-sited docks reach 49% and 45% on the same held-out stages and uniform docks 68% and 73%.`),
  ...table("Robust dock count (all scenarios)",
    ["City", "Docks", "Coverage", "Regret", "≤30 min"],
    C.flatMap(c => ["robust4", "robust6", "robust8"].map(s => [name(c), R.hubs[c][s].length,
      `${pct(st(c, s).coverage)}%`, `${pct(st(c, s).regret)}%`, `${pct(st(c, s).sla30)}%`])),
    [1400, 700, 900, 900, 900]),
  P(`Table IV varies the number of robust docks. The selection of docks is nested, meaning that the four-dock set is contained in the six-dock set, and the six-dock set is contained in the eight-dock set (Fig. 4 shows six). Thus, a city could install docks in phases, starting with the highest-scoring sites, without moving any of the docks later. Returns decrease, however: going from four to six docks increases the coverage by 4% in Varanasi and 12% in Kanpur; going from six to eight docks increases the coverage by 0% and 6% respectively.`),
  H2("Service within 30 minutes"),
  P(`As coverage counts the number of served drop points, late arriving drones are also counted. Figure 5 (bottom) shows the percentage of drop points served within 30 minutes of dispatch. As each vertical maneuver takes time (with our timing assumptions, a single drop adds 101 s and each reload 240 s), drones far from their drop points or performing many sorties will take longer than 30 minutes to serve all of their drop points. The percentage of drop points served within 30 minutes by adaptive bases is 68% and 77% respectively, by robust docks 67% and 74%, by event-sited docks 40% and 44% and by uniform docks 52% and 70%.`),
  H2("Stability of re-sited bases"),
  P(`The adaptive bound assumes bases can move freely. Between consecutive flood stages under the same weather, an adaptive base lies on average 101 map pixels (about 263 m at the planner's nominal scale) from the nearest base of the next plan in Varanasi and 110 pixels (287 m) in Kanpur; 83% and 70% of bases move by more than 45 pixels. In practice every such move means carrying a launch team, batteries and kits through a flooded city, which is exactly what fixed docks avoid.`),
  H2("IoT data rate and planning latency (RQ3)"),
  P(`Table II summarizes the required IoT budget for a single city (Varanasi or Kanpur) with six drones, six docks and twenty gauges. The dominant part of the IoT data rate is the drone telemetry (1 Hz) which adds up to 9.61 kbit/s for the whole city. The readings of the gauges are packed into LoRaWAN payloads and thus fit into the allowed payload size of all data rates [17]. The planning latency of a single run of the relief planner on a laptop (16 logical cores) takes 27 s for Varanasi and 54 s for Kanpur from trigger to exported missions. In the batch of twelve runs, sharing the machine, the median time for adaptive-dock runs is 79 s and for robust-dock runs 91 s. Thus, a re-plan per gauge reading every five minutes is feasible on commodity hardware.`),
];

const discussion = [
  H1("Discussion"),
  P(`**What a city should do.** The results of the study can be used to set up a procedure for a city's ICCC. First, run the relief planner on a set of plausible flood stages and weather levels. Keep the sites that are chosen frequently and that are dry. Install the docks on these sites in order of their scores. The docks chosen from the most recent flood alone are not worth much, as they are placed on the exact location where the next, higher flood will reach. Spreading the docks evenly over the city's area is safe but wastes range.`),
  P(`**Fixed docks vs. mobile launch teams.** Robust docks recover most of the coverage of freely re-sited bases while avoiding base moves of hundreds of metres between re-plans. A practical deployment would combine both: fixed docks for the first hours, and mobile teams for drop points that no surviving dock can reach, which the planner lists explicitly.`),
  P(`**Role of the IoT layer.** The data rates involved are small; the value of the IoT layer is in knowing, at the moment of re-planning, which docks are dry, charged and stocked. Without the dock's own water sensor the planner would have to infer dock availability from a flood map that may be hours old.`),
  H1("Limitations"),
  bullet(`**Synthetic flood stages.** The rising water is modeled by uniformly growing the detected flood mask. This is not a hydraulic model of the water with terrain, hence real floods rise along low ground first.`),
  bullet(`**Planner approximations.** The planner's battery model does not take into account the energy for take-off and descent, the planner's maps are not georeferenced, hence absolute coverage and distance values are on the optimistic side and are given in map units. The service within 30 minutes adds the vertical-manoeuvre time, but does not change the feasibility.`),
  bullet(`**Two maps, one flood season.** The study uses one published map per city; dock sites should be recomputed with more events and with georeferenced inputs.`),
  bullet(`**Prototype scope.** The dashboard was built; the MQTT layer and docks were specified and sized but not deployed, and no drone was flown.`),
];

const conclusion = [
  H1("Conclusion"),
  P(`In this paper we have considered the relief-drone launch sites as smart-city infrastructure and investigated where the IoT drone docks can be installed to remain operational during a flood. We have used an open-source relief planner to evaluate the coverage of the different dock types on 30 scenarios for Varanasi and Kanpur. The docks chosen for both planner support and survival of the docks have the highest coverage of all fixed-dock strategies on the flood stages on which they were not chosen. The coverage of the event-sited docks, however, decreases quickly with increasing water level. The uniform docks have average coverage: some of them are lost to the water and the remaining ones can be far from the drop points.`),
  new Paragraph({ spacing: { before: 120, after: 60 }, children: [run("Acknowledgment", { size: 20, smallCaps: true })], alignment: AlignmentType.CENTER }),
  P(`The relief planner used as the evaluator in this study is the open-source A.D.A.P.T. system [5] by T. Saha, A. Vatsal, A. Thomas K (a co-author of this paper) and A. K; a manuscript describing that planner is under review elsewhere. This paper does not describe or evaluate the planner itself. The work was carried out in the Design of Smart Cities course at the School of Computer Science and Engineering, VIT.`),
];

const references = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true, children: [run("References", { size: 20, smallCaps: true })] }),
  ...REFS.map((r, i) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 30, line: 200 },
    indent: { left: 360, hanging: 360 }, children: [run(`[${i + 1}]\t`, { size: 16 }), ...rich(r, { size: 16 })],
    tabStops: [{ type: "left", position: 360 }] })),
];

// wide figures sit in single-column sections between two-column sections
function split(blocks) {
  const sections = [];
  let cur = [];
  const isWide = b => b.__wide;
  for (const b of blocks) {
    if (isWide(b)) { if (cur.length) sections.push({ cols: 2, children: cur }); sections.push({ cols: 1, children: b.items }); cur = []; }
    else cur.push(b);
  }
  if (cur.length) sections.push({ cols: 2, children: cur });
  return sections;
}
// group the blocks that figure(..., true) and table(..., true) mark as full width
function markWide(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.__wideCount) { out.push({ __wide: true, items: arr.slice(i, i + p.__wideCount) }); i += p.__wideCount - 1; } else out.push(p);
  }
  return out;
}

const body = [...B.abstract, ...B.intro, ...B.related, ...B.arch, ...B.method, ...results, ...discussion, ...conclusion, ...references];
const sectionsSpec = split(markWide(body));
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new B.TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 })] })] });
const pageProps = (cols, first) => ({
  page: { size: PAGE, margin: MARGIN },
  column: cols === 2 ? { count: 2, space: COL_GAP, equalWidth: true } : { count: 1 },
  type: first ? undefined : SectionType.CONTINUOUS,
});
const doc = new Document({
  creator: [B.AUTHORS.guide.name, ...B.AUTHORS.paper_order].join("; "), title: "Flood-Resilient Siting of IoT Drone Docks for Smart-City Relief",
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 288, hanging: 180 } } } }] }] },
  sections: [
    { properties: pageProps(1, true), footers: { default: footer }, children: [...B.front, B.authorTable, new Paragraph({ spacing: { after: 120 }, children: [] })] },
    ...sectionsSpec.map(sp => ({ properties: pageProps(sp.cols, false), footers: { default: footer }, children: sp.children })),
    // a closing continuous section makes Word and LibreOffice balance the two columns on the last page
    { properties: pageProps(1, false), footers: { default: footer }, children: [new Paragraph({ spacing: { after: 0 }, children: [] })] },
  ],
});
const out = path.join(__dirname, "Flood_Resilient_Drone_Docks.docx");
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log("wrote", out); });
