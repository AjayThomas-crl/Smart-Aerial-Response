// Every number quoted in the course report, read from the files the code and experiments produced.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const J = p => JSON.parse(fs.readFileSync(path.join(ROOT, p)));

const authors = J("research/authors.json");
const demo = { varanasi: J("demo/static/data/varanasi.json"), kanpur: J("demo/static/data/kanpur.json") };
const study = J("research/hub_study/results.json");
const budget = J("research/hub_study/iot_budget.json");
const latency = J("research/hub_study/latency_isolated.json");
// SAR_DRAFT=1 lets the text be built for checking before the test run has finished
const tests = fs.existsSync(path.join(ROOT, "tests/results/summary.json")) || !process.env.SAR_DRAFT
  ? J("tests/results/summary.json") : { total: 0, passed: 0, failed: 0, duration_s: 0, run_at: "draft", cases: [] };

// latest full IoT loop run (with the planner) per city
function iotRun(city) {
  const dir = path.join(ROOT, "iot", "runs");
  const runs = fs.readdirSync(dir).filter(d => d.startsWith(city + "_")).sort().reverse();
  for (const d of runs) {
    const f = path.join(dir, d, "summary.json");
    if (!fs.existsSync(f)) continue;
    const s = JSON.parse(fs.readFileSync(f));
    if (s.plans.length && s.plans.every(p => p.served !== undefined)) return { ...s, dir: `iot/runs/${d}` };
  }
  throw new Error(`no full IoT run for ${city} in iot/runs`);
}
const iot = { varanasi: iotRun("varanasi"), kanpur: iotRun("kanpur") };

const pct = v => Math.round(100 * v);
const st = (c, s, part = "all") => study.per_strategy[c][s][part];

module.exports = { ROOT, authors, demo, study, budget, latency, tests, iot, pct, st };
