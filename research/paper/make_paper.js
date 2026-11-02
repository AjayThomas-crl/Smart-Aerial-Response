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
  P(`All 180 planner runs (30 adaptive, 150 with fixed docks) completed and every one produced a plan with no route crossings: in every scenario at least one dock of every strategy stayed usable. Table III summarises the strategies over all scenarios and over the held-out stages alone (VNS: Varanasi, KNP: Kanpur).`),
  H2("Coverage under rising water (RQ1)"),
  P(`Fig. 3 shows coverage against flood stage. Adaptive bases serve ${pct(st("varanasi", "adaptive").coverage)}% of drop points in Varanasi and ${pct(st("kanpur", "adaptive").coverage)}% in Kanpur on average (scenario minimum ${pct(minCov("varanasi", "adaptive"))}% and ${pct(minCov("kanpur", "adaptive"))}%), because the planner can move a base next to the water in every scenario. Fixed docks lose coverage as the flood grows, but at very different rates. Robust docks stay closest to the adaptive bound, with a mean regret of ${pct(st("varanasi", "robust6").regret)}% in Varanasi and ${pct(st("kanpur", "robust6").regret)}% in Kanpur. Event-sited docks do well on the event they were sited for and degrade as the water rises over them (regret ${pct(st("varanasi", "event").regret)}% and ${pct(st("kanpur", "event").regret)}%). Uniform docks sit in the middle (regret ${pct(st("varanasi", "uniform6").regret)}% and ${pct(st("kanpur", "uniform6").regret)}%): some are lost to the water and the survivors are often far from the drop points.`),
  P(`The number of drop points itself changes with the stage: as separate pockets of water merge, the planner places fewer drop points on the larger merged zones (Kanpur falls from 46 to 13 drop points between stages 0 and 9). Coverage shares therefore compare strategies within a stage, not across stages.`),
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
  ...figure("fig5_docks_sla.png", "Top: docks unusable at each flood stage (mean over weathers). Bottom: share of drop points served within 30 minutes of dispatch."),
  P(`Figs. 4 and 5 (top) explain the coverage gap. Event-sited docks are placed where the planner wanted bases for the stage-0 flood, which is next to the water; as it rises, most of them are flooded or fall inside the clearance of the forecast flood. Robust docks lose fewer because the survival term *a*(*c*) in (1) favours sites that stayed dry across the training stages. Uniform docks are placed without regard to the water, so their losses depend on where the clusters happen to fall. On average ${st("varanasi", "event").docks_lost_mean.toFixed(1)} of the ${R.hubs.varanasi.event.length} event-sited docks are unusable in Varanasi and ${st("kanpur", "event").docks_lost_mean.toFixed(1)} of ${R.hubs.kanpur.event.length} in Kanpur, against ${st("varanasi", "robust6").docks_lost_mean.toFixed(1)} and ${st("kanpur", "robust6").docks_lost_mean.toFixed(1)} of six robust docks and ${st("varanasi", "uniform6").docks_lost_mean.toFixed(1)} and ${st("kanpur", "uniform6").docks_lost_mean.toFixed(1)} of six uniform docks.`),
  H2("Generalisation to unseen flood stages (RQ2)"),
  P(`Robust docks were chosen from stages 0, 6 and 12 only. On the held-out stages 3 and 9 they serve ${pct(st("varanasi", "robust6", "test").coverage)}% of drop points in Varanasi and ${pct(st("kanpur", "robust6", "test").coverage)}% in Kanpur, compared with ${pct(st("varanasi", "robust6", "train").coverage)}% and ${pct(st("kanpur", "robust6", "train").coverage)}% on the training stages. Event-sited docks reach ${pct(st("varanasi", "event", "test").coverage)}% and ${pct(st("kanpur", "event", "test").coverage)}% on the same held-out stages, and uniform docks ${pct(st("varanasi", "uniform6", "test").coverage)}% and ${pct(st("kanpur", "uniform6", "test").coverage)}%.`),
  ...table("Robust dock count (all scenarios)",
    ["City", "Docks", "Coverage", "Regret", "≤30 min"],
    C.flatMap(c => ["robust4", "robust6", "robust8"].map(s => [name(c), R.hubs[c][s].length,
      `${pct(st(c, s).coverage)}%`, `${pct(st(c, s).regret)}%`, `${pct(st(c, s).sla30)}%`])),
    [1400, 700, 900, 900, 900]),
  P(`Table IV varies the number of robust docks. The selection is nested: the four-dock set is contained in the six-dock set and that in the eight-dock set (Fig. 4 shows six), so a city can install docks in phases, starting with the highest-scoring sites, without moving any later. Returns diminish: going from four to six docks raises coverage by ${pct(st("varanasi", "robust6").coverage - st("varanasi", "robust4").coverage)} points in Varanasi and ${pct(st("kanpur", "robust6").coverage - st("kanpur", "robust4").coverage)} in Kanpur, and from six to eight by ${pct(st("varanasi", "robust8").coverage - st("varanasi", "robust6").coverage)} and ${pct(st("kanpur", "robust8").coverage - st("kanpur", "robust6").coverage)}.`),
  H2("Service within 30 minutes"),
  P(`Coverage counts a drop point as served however late the drone arrives. Fig. 5 (bottom) shows the share served within 30 minutes of dispatch. Every vertical manoeuvre costs time: with our timing assumptions a single drop adds 101 s and every reload adds 240 s, so drones far from their drop points or making many sorties fall behind. Adaptive bases reach ${pct(st("varanasi", "adaptive").sla30)}% and ${pct(st("kanpur", "adaptive").sla30)}% within 30 minutes; robust docks ${pct(st("varanasi", "robust6").sla30)}% and ${pct(st("kanpur", "robust6").sla30)}%; event-sited ${pct(st("varanasi", "event").sla30)}% and ${pct(st("kanpur", "event").sla30)}%; uniform ${pct(st("varanasi", "uniform6").sla30)}% and ${pct(st("kanpur", "uniform6").sla30)}%.`),
  H2("Stability of re-sited bases"),
  P(`The adaptive bound assumes bases can move freely. Between consecutive flood stages under the same weather, an adaptive base lies on average ${Math.round(disp("varanasi").meanPx)} map pixels (about ${Math.round(disp("varanasi").meanPx * 2.6)} m at the planner's nominal scale) from the nearest base of the next plan in Varanasi and ${Math.round(disp("kanpur").meanPx)} pixels (${Math.round(disp("kanpur").meanPx * 2.6)} m) in Kanpur; ${pct(disp("varanasi").moved)}% and ${pct(disp("kanpur").moved)}% of bases move by more than 45 pixels. In practice every such move means carrying a launch team, batteries and kits through a flooded city, which is exactly what fixed docks avoid.`),
  H2("IoT data rate and planning latency (RQ3)"),
  P(`Table II gives the IoT budget for one city with six drones, six docks and twenty gauges. Drone telemetry at 1 Hz dominates; the whole city needs ${IOT.total_kbit_s} kbit/s, well within one cellular link, and the gauges' packed readings fit LoRaWAN payload limits at all data rates [17]. Planning is the slow step. Run alone on a laptop (16 logical cores), one planner run takes ${iso.varanasi.toFixed(0)} s for Varanasi and ${iso.kanpur.toFixed(0)} s for Kanpur from trigger to exported missions. In the batch, with twelve runs sharing the machine, the median was ${L.adaptive.median.toFixed(0)} s for adaptive and ${L.robust6.median.toFixed(0)} s for robust-dock runs. A re-plan per gauge reading every five minutes is therefore feasible on commodity hardware.`),
];

const discussion = [
  H1("Discussion"),
  P(`**What a city should do.** The results suggest a simple procedure for a city ICCC: run the relief planner on a set of plausible flood stages and weather levels, keep the sites it chooses often and that stay dry, and install docks there in order of score. Docks sited from the most recent flood alone are a poor investment: they are placed exactly where the next, higher flood will reach. Spreading docks evenly is safe but wastes range.`),
  P(`**Fixed docks versus mobile launch teams.** Robust docks recover most of the coverage of freely re-sited bases while avoiding base moves of hundreds of metres between re-plans. A practical deployment would combine both: fixed docks for the first hours, and mobile teams for drop points that no surviving dock can reach, which the planner lists explicitly.`),
  P(`**Role of the IoT layer.** The data rates involved are small; the value of the IoT layer is in knowing, at the moment of re-planning, which docks are dry, charged and stocked. Without the dock's own water sensor the planner would have to infer dock availability from a flood map that may be hours old.`),
  H1("Limitations"),
  bullet(`**Synthetic flood stages.** Rising water is modelled by growing the detected flood mask uniformly, not by a hydraulic model with terrain; real floods rise along low ground first.`),
  bullet(`**Planner approximations.** The planner's battery model ignores take-off and descent energy and its maps are not georeferenced, so absolute coverage and distances are optimistic and in map units; the 30-minute service level adds vertical-manoeuvre time but does not change feasibility. Comparisons between strategies share these approximations.`),
  bullet(`**Two maps, one flood season.** The study uses one published map per city; dock sites should be recomputed with more events and with georeferenced inputs.`),
  bullet(`**Prototype scope.** The dashboard was built; the MQTT layer and docks were specified and sized but not deployed, and no drone was flown.`),
];

const conclusion = [
  H1("Conclusion"),
  P(`This paper treated relief-drone launch sites as smart-city infrastructure and asked where IoT drone docks should be installed so that they keep working as a flood rises. Using an open-source relief planner as an evaluator on 30 scenarios for Varanasi and Kanpur, docks chosen for both planner support and survival kept coverage close to freely re-sited bases on flood stages they were not chosen from, while docks sited from a single event lost most of their value as the water rose. A five-layer IoT architecture with LoRaWAN gauges and MQTT-connected docks needs under 10 kbit/s per city and can re-plan within about a minute. Future work will use terrain-based flood scenarios, georeferenced maps, dock costs and a field trial with one dock.`),
  new Paragraph({ spacing: { before: 120, after: 60 }, children: [run("Acknowledgment", { size: 20, smallCaps: true })], alignment: AlignmentType.CENTER }),
  P(`The relief planner used as the evaluator in this study is the open-source A.D.A.P.T. system [5] by T. Saha, A. Vatsal, A. Thomas K (one of the present authors) and A. K; a manuscript describing that planner is under review elsewhere. This paper does not describe or evaluate the planner itself. The work was carried out in the Design of Smart Cities course at the School of Computer Science and Engineering, VIT.`),
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
