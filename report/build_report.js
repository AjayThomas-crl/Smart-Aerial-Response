// Builds report/Smart_Aerial_Response_Course_Report.docx: the Design of Smart Cities course project report,
// laid out after the SCOPE project-report template (A4, Times New Roman, roman-numbered front matter).
// The table of contents and the lists of figures and tables carry real page numbers: the report is built
// once, rendered with LibreOffice, the page of every heading and caption is read back, then built again.
// Run: NODE_PATH=<folder with node_modules> node report/build_report.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, Footer, PageNumber, NumberFormat, LevelFormat, VerticalAlign, ShadingType, TabStopType,
} = require("docx");
const D = require("./data");

const HERE = __dirname;
const OUT = path.join(HERE, "Smart_Aerial_Response_Course_Report.docx");
const FONT = "Times New Roman";
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
const CONTENT_DXA = PAGE.width - MARGIN.left - MARGIN.right;     // 9026
const CONTENT_PX = Math.round(CONTENT_DXA / 15);
const BODY_LINE = 276;                                           // 1.15 line spacing, as the template asks

// ---------------------------------------------------------------- text helpers
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics,
  color: o.color, allCaps: o.caps, superScript: o.sup });
function rich(text, o = {}) {           // **bold**, *italic* and `code` spans inside a string
  return String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).filter(Boolean).map(s =>
    s.startsWith("**") ? run(s.slice(2, -2), { ...o, bold: true })
      : s.startsWith("`") ? new TextRun({ text: s.slice(1, -1), font: "Liberation Mono", size: (o.size || 24) - 3 })
        : s.startsWith("*") ? run(s.slice(1, -1), { ...o, italics: true }) : run(s, o));
}
const P = (text, o = {}) => new Paragraph({ children: rich(text, o), alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { after: o.after ?? 140, line: o.line || BODY_LINE }, keepNext: o.keepNext });
const bullet = t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: rich(t),
  spacing: { after: 70, line: BODY_LINE }, alignment: AlignmentType.JUSTIFIED });
const numbered = (t, ref) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: rich(t),
  spacing: { after: 70, line: BODY_LINE }, alignment: AlignmentType.JUSTIFIED });
const code = lines => lines.split("\n").map((l, i, a) => new Paragraph({ keepNext: i < a.length - 1, keepLines: true,
  spacing: { after: i === a.length - 1 ? 160 : 0, line: 240 }, shading: { fill: "F3F3F3", type: ShadingType.CLEAR, color: "auto" },
  children: [new TextRun({ text: l || " ", font: "Liberation Mono", size: 17 })] }));

// ---------------------------------------------------------------- numbering of chapters, figures, tables
const toc = [], figs = [], tabs = [];          // entries collected while the content is generated
let chap = 0, sec = 0, sub = 0, figN = 0, tabN = 0;
function chapter(title) {
  chap++; sec = 0; figN = 0; tabN = 0;
  toc.push({ level: 0, label: `${chap}.`, text: title.toUpperCase(), key: `CHAPTER ${chap}` });
  return [
    new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [run(`CHAPTER ${chap}`, { size: 32, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, keepNext: true,
      children: [run(title.toUpperCase(), { size: 32, bold: true })] }),
  ];
}
function H2(title) {
  sec++; sub = 0;
  const label = `${chap}.${sec}`;
  toc.push({ level: 1, text: `${label} ${title}`, key: `${label} ${title.toUpperCase()}` });
  return new Paragraph({ spacing: { before: 240, after: 120 }, keepNext: true,
    children: [run(`${label} ${title.toUpperCase()}`, { size: 28, bold: true })] });
}
function H3(title) {
  sub++;
  const label = `${chap}.${sec}.${sub}`;
  toc.push({ level: 2, text: `${label} ${title}`, key: `${label} ${title}` });
  return new Paragraph({ spacing: { before: 180, after: 100 }, keepNext: true,
    children: [run(`${label} ${title}`, { size: 24, bold: true })] });
}

function imageSize(buf) {
  if (buf[0] === 0x89) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;                              // JPEG: walk segments to SOF0/SOF2
  while (i < buf.length) {
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker === 0xC0 || marker === 0xC2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("unknown image size");
}
// file is relative to the project root; width as a share of the text width
function figure(file, caption, share = 1) {
  const buf = fs.readFileSync(path.join(D.ROOT, file));
  const { w, h } = imageSize(buf);
  let width = Math.round(CONTENT_PX * share), height = Math.round(width * h / w);
  if (height > 760) { height = 760; width = Math.round(height * w / h); }        // keep a figure on one page
  figN++;
  const label = `${chap}.${figN}`;
  figs.push({ label, text: caption.replace(/\*/g, "").split(". ")[0].replace(/\.$/, ""), key: `Figure ${label}` });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
      children: [new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: buf, transformation: { width, height },
        altText: { title: `Figure ${label}`, description: caption, name: `fig${label}` } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 },
      children: [run(`Figure ${label} `, { bold: true, size: 20 }), ...rich(caption, { size: 20 })] }),
  ];
}
const line = { style: BorderStyle.SINGLE, size: 4, color: "7F7F7F" };
const borders = { top: line, bottom: line, left: line, right: line };
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
function table(caption, header, rows, widths, o = {}) {
  tabN++;
  const label = `${chap}.${tabN}`;
  tabs.push({ label, text: caption, key: `Table ${label}` });
  const scale = CONTENT_DXA / widths.reduce((a, b) => a + b, 0);
  widths = widths.map(w => Math.floor(w * scale));
  // short tables stay on one page; long ones may break after the header and first two rows
  const cell = (t, i, head, ri = -1) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: head ? { fill: "D9E2EA", type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ alignment: (o.left || [0]).includes(i) ? AlignmentType.LEFT : AlignmentType.CENTER,
      keepNext: head || rows.length <= 6 || ri < 2, children: rich(String(t), { size: o.size || 21, bold: head }) })],
  });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
      children: [run(`Table ${label} `, { bold: true, size: 20 }), run(caption, { size: 20 })] }),
    new Table({ width: { size: CONTENT_DXA, type: WidthType.DXA }, columnWidths: widths,
      rows: [new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(h, i, true)) }),
        ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri)) }))] }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

const H = { run, rich, P, bullet, numbered, code, chapter, H2, H3, figure, table, CONTENT_PX };

// ---------------------------------------------------------------- front matter
const A = D.authors;
const listNames = xs => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs.join("");
const TITLE = "Smart Aerial Response: An Autonomous UAV Framework for Resilient Flood Emergency Management in Smart Cities";
const centre = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 120, line: o.line || 360 },
  children: Array.isArray(t) ? t : rich(t, o) });
const heading = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
  children: [run(t, { size: 32, bold: true })] });

function cover() {
  const logo = fs.readFileSync(path.join(HERE, "assets", "vit_logo.jpeg"));
  const reg = new Table({ alignment: AlignmentType.CENTER, width: { size: 6200, type: WidthType.DXA }, columnWidths: [1900, 4300],
    rows: A.students.map(s => new TableRow({ children: [
      new TableCell({ borders: noBorders, width: { size: 1900, type: WidthType.DXA }, children: [centre([run(s.reg, { bold: true })], { after: 60 })] }),
      new TableCell({ borders: noBorders, width: { size: 4300, type: WidthType.DXA }, children: [new Paragraph({ spacing: { after: 60, line: 360 }, children: [run(s.name.toUpperCase(), { bold: true })] })] }),
    ] })) });
  return [
    centre([run(`${A.course} – Course Project`, { bold: true, size: 28 })], { after: 480 }),
    centre([run(TITLE.toUpperCase(), { bold: true, size: 36 })], { after: 480 }),
    centre([run("Submitted in partial fulfilment of the requirements of the course", { italics: true })], { after: 120 }),
    centre([run(A.course, { bold: true, size: 28 })], { after: 120 }),
    centre([run("in", { italics: true })], { after: 120 }),
    centre([run(A.programme, { bold: true, size: 26 })], { after: 240 }),
    centre([run("by", { italics: true })], { after: 240 }),
    reg,
    centre([run("Under the supervision of", { bold: true })], { after: 120 }),
    centre([run(A.guide.name, { bold: true, size: 26 })], { after: 60 }),
    centre(A.guide.designation, { after: 60 }),
    centre("School of Computer Science and Engineering (SCOPE)", { after: 480 }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new ImageRun({ type: "jpg", data: logo, transformation: { width: 260, height: 72 },
        altText: { title: "VIT logo", description: "Vellore Institute of Technology logo", name: "logo" } })] }),
    centre("November 2026"),
  ];
}

function signature(lines) {
  return lines.map(t => new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0, line: 360 }, children: [run(t, { bold: true })] }));
}
function declaration() {
  const names = listNames(A.students.map(s => `${s.name} (${s.reg})`));
  return [
    heading("DECLARATION"),
    P(`We hereby declare that the project entitled **"${TITLE}"** submitted by us, ${names}, for the course ${A.course} of the ${A.programme} programme at VIT, is a record of bonafide work carried out by us under the supervision of ${A.guide.name}.`, { line: 360 }),
    P("We further declare that the work reported in this project has not been submitted and will not be submitted, either in part or in full, for any other course, degree or diploma in this institute or any other institute or university. Software used from earlier work, in particular the open-source A.D.A.P.T. planner, is acknowledged in the text and the references.", { line: 360, after: 720 }),
    P("Place : Vellore", { after: 60 }), P("Date :", { after: 600 }),
    ...signature(["Signature of the Candidates", ...A.students.map(s => s.name)]),
  ];
}
function certificate() {
  const names = listNames(A.students.map(s => `${s.name} (${s.reg})`));
  return [
    heading("CERTIFICATE"),
    P(`This is to certify that the project entitled **"${TITLE}"** submitted by **${names}**, School of Computer Science and Engineering, VIT, for the course ${A.course}, is a record of bonafide work carried out by them under my supervision during the ${A.semester}, as per the VIT code of academic and research ethics.`, { line: 360 }),
    P("The contents of this report have not been submitted and will not be submitted either in part or in full for any other course, degree or diploma in this institute or any other institute or university. The project fulfils the requirements of the course and in my opinion meets the necessary standards for submission.", { line: 360, after: 720 }),
    P("Place : Vellore", { after: 60 }), P("Date :", { after: 900 }),
    ...signature(["Signature of the Faculty", A.guide.name, A.guide.designation, "SCOPE, VIT"]),
  ];
}
function acknowledgements() {
  return [
    heading("ACKNOWLEDGEMENTS"),
    P("We are grateful to the management of Vellore Institute of Technology (VIT) for the opportunity, facilities and learning environment that made this project possible.", { line: 360 }),
    P("We thank Dr. Jaisankar N, Dean of the School of Computer Science and Engineering (SCOPE), for his support and encouragement of project-based learning in the school.", { line: 360 }),
    P(`We are especially thankful to our course faculty and guide, **${A.guide.name}**, ${A.guide.designation}, SCOPE, for her guidance throughout the ${A.course} course. Her feedback on how the work connects to smart-city services, and on how to present and test it, shaped both this report and the research paper that came out of it.`, { line: 360 }),
    P("We also thank the developers of the open-source A.D.A.P.T. planner, on which the swarm-planning part of this project is built, and the open-source communities behind OpenCV, NumPy, Matplotlib, paho-mqtt and amqtt.", { line: 360, after: 720 }),
    ...signature(A.students.map(s => s.name)),
  ];
}

// list pages: TOC, figures, tables; `pages` maps an entry key to its page number (empty on the first pass)
function listTable(header, rows, widths) {
  const cell = (t, i, o = {}) => new TableCell({ borders: noBorders, width: { size: widths[i], type: WidthType.DXA },
    children: [new Paragraph({ alignment: i === widths.length - 1 ? AlignmentType.RIGHT : i === 0 && widths.length === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 0, line: o.compact ? 276 : 360 }, indent: o.indent ? { left: o.indent } : undefined, children: [run(String(t), { bold: o.bold, size: 24 })] })] });
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, { bold: true })) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.cells.map((c, i) => cell(c, i, { ...(i === 1 ? r : {}), bold: i === 1 ? r.bold : r.bold && i === 0, compact: r.compact })) }))] });
}
function contentsPages(pages, front, back) {
  const pg = k => pages[k] ?? "00";
  const rows = [
    ...front.map(f => ({ cells: ["", f.text, pg(f.key)], bold: true })),
    ...toc.map(t => ({ cells: [t.level === 0 ? t.label : "", t.text, pg(t.key)], bold: t.level === 0, indent: t.level * 360 })),
    ...back.map(b => ({ cells: ["", b.text, pg(b.key)], bold: true })),
  ].map(r => ({ ...r, compact: true }));
  return [heading("TABLE OF CONTENTS"), listTable(["Sl. No.", "Contents", "Page No."], rows, [900, 6926, 1200])];
}
function figureList(pages) {
  return [heading("LIST OF FIGURES"), listTable(["Figure No.", "Title", "Page No."],
    figs.map(f => ({ cells: [f.label, f.text, pages[f.key] ?? "00"] })), [1500, 6326, 1200])];
}
function tableList(pages) {
  return [new Paragraph({ pageBreakBefore: true, children: [] }), heading("LIST OF TABLES"), listTable(["Table No.", "Title", "Page No."],
    tabs.map(f => ({ cells: [f.label, f.text, pages[f.key] ?? "00"] })), [1500, 6326, 1200])];
}
const ABBREV = [
  ["API", "Application Programming Interface"], ["D* Lite", "Dynamic incremental shortest-path search algorithm"],
  ["DFD", "Data Flow Diagram"], ["CWC", "Central Water Commission"], ["FR", "Functional Requirement"],
  ["GNSS", "Global Navigation Satellite System"], ["HSV", "Hue, Saturation, Value colour space"],
  ["ICCC", "Integrated Command and Control Centre"], ["IoT", "Internet of Things"], ["JSON", "JavaScript Object Notation"],
  ["LoRaWAN", "Long Range Wide Area Network"], ["MAVLink", "Micro Air Vehicle Link protocol"], ["MQTT", "Message Queuing Telemetry Transport"],
  ["NDRF", "National Disaster Response Force"], ["NFR", "Non-Functional Requirement"], ["QGC WPL", "QGroundControl Waypoint List file format"],
  ["SAR", "Synthetic Aperture Radar (also Smart Aerial Response in topic names)"], ["SDS", "Software Design Specification"],
  ["SLA", "Service-Level Agreement (here: drops served within 30 minutes)"], ["SRS", "Software Requirements Specification"],
  ["SSE", "Server-Sent Events"], ["TSP", "Travelling Salesman Problem"], ["UAV", "Unmanned Aerial Vehicle"], ["UML", "Unified Modeling Language"],
].sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));
function abbreviations() {
  return [new Paragraph({ pageBreakBefore: true, children: [] }), heading("LIST OF ABBREVIATIONS"),
    new Table({ width: { size: CONTENT_DXA, type: WidthType.DXA }, columnWidths: [2000, 7026],
      rows: ABBREV.map(([a, b]) => new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ spacing: { after: 0, line: 360 }, children: [run(a, { bold: true })] })] }),
        new TableCell({ borders: noBorders, width: { size: 7026, type: WidthType.DXA }, children: [new Paragraph({ spacing: { after: 0, line: 360 }, children: [run(b)] })] }),
      ] })) })];
}

// ---------------------------------------------------------------- assembly
const footer = (fmt) => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] });

function build(pages) {
  toc.length = figs.length = tabs.length = 0;
  chap = sec = sub = figN = tabN = 0;
  const content = require("./content")(H, D);     // fills toc, figs, tabs as a side effect
  const abstractPage = [heading("ABSTRACT"), ...require("./content").abstract(H, D)];
  const front = [{ text: "List of Figures", key: "LIST OF FIGURES" }, { text: "List of Tables", key: "LIST OF TABLES" },
    { text: "List of Abbreviations", key: "LIST OF ABBREVIATIONS" }, { text: "Abstract", key: "ABSTRACT" }];
  const back = [{ text: "REFERENCES", key: "REFERENCES" }, { text: "APPENDIX A – SAMPLE CODE", key: "APPENDIX A – SAMPLE CODE" }];
  const pageBreak = () => new Paragraph({ pageBreakBefore: true, children: [] });
  const frontMatter = [
    ...declaration(), pageBreak(), ...certificate(), pageBreak(), ...acknowledgements(), pageBreak(),
    ...contentsPages(pages, front, back), pageBreak(), ...figureList(pages), ...tableList(pages), ...abbreviations(), pageBreak(), ...abstractPage,
  ];
  const props = (fmt, start) => ({ page: { size: PAGE, margin: MARGIN, pageNumbers: start ? { start, formatType: fmt } : undefined } });
  return new Document({
    creator: [A.guide.name, ...A.students.map(s => s.name)].join("; "), title: TITLE,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      ...["n1", "n2", "n3", "n4", "n5", "n6"].map(r => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
    ] },
    sections: [
      { properties: props(), children: cover() },
      { properties: props(NumberFormat.LOWER_ROMAN, 1), footers: { default: footer() }, children: frontMatter },
      { properties: props(NumberFormat.DECIMAL, 1), footers: { default: footer() }, children: content },
    ],
  });
}

// page of every heading and caption, from a LibreOffice rendering
function readPages(docx) {
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "sar-report-"));
  execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", tmp, docx], { stdio: "ignore" });
  const pdf = path.join(tmp, path.basename(docx).replace(/\.docx$/, ".pdf"));
  const text = execFileSync("pdftotext", ["-layout", pdf, "-"]).toString().split("\f");
  const lines = text.map(t => t.split("\n").map(l => l.trim().replace(/\s+/g, " ")));
  const body = lines.findIndex(ls => ls.includes("CHAPTER 1"));
  const pages = {};
  const find = (key, from, to, offset, roman) => {
    for (let i = from; i < to; i++) if (lines[i].some(l => l === key || l.startsWith(key + " "))) {
      pages[key] = roman ? toRoman(i - offset + 1) : String(i - offset + 1);
      return;
    }
  };
  const tocPage = lines.findIndex(ls => ls.includes("TABLE OF CONTENTS"));
  for (const k of ["ABSTRACT", "LIST OF FIGURES", "LIST OF TABLES", "LIST OF ABBREVIATIONS"]) find(k, tocPage + 1, body, 1, true);
  for (const e of [...toc, ...figs, ...tabs, { key: "REFERENCES" }, { key: "APPENDIX A – SAMPLE CODE" }]) find(e.key, body, lines.length, body, false);
  return { pages, total: lines.length - 1, missing: [...toc, ...figs, ...tabs].filter(e => !pages[e.key]).map(e => e.key) };
}
function toRoman(n) {
  return [["x", 10], ["ix", 9], ["v", 5], ["iv", 4], ["i", 1]].reduce((s, [r, v]) => { while (n >= v) { s += r; n -= v; } return s; }, "");
}

(async () => {
  fs.writeFileSync(OUT, await Packer.toBuffer(build({})));
  const first = readPages(OUT);
  fs.writeFileSync(OUT, await Packer.toBuffer(build(first.pages)));
  const second = readPages(OUT);
  const moved = Object.keys(second.pages).filter(k => second.pages[k] !== first.pages[k]);
  if (moved.length) {                         // page numbers shifted the layout: one more pass
    fs.writeFileSync(OUT, await Packer.toBuffer(build(second.pages)));
  }
  console.log(`wrote ${OUT}: ${second.total} pages; ${toc.length} headings, ${figs.length} figures, ${tabs.length} tables`);
  if (second.missing.length) console.log("not found in rendering:", second.missing.join(" | "));
})();
