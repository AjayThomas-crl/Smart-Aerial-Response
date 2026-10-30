"""Turn the adaptive and fixed-dock runs into the paper's tables (results.json) and figures (PNG)."""
import json
import os
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt                     # noqa: E402

HERE = Path(__file__).resolve().parent
FIG = HERE.parent / "paper" / "figures"
CITIES = ("varanasi", "kanpur")
STAGES = (0, 3, 6, 9, 12)
TEST = (3, 9)
WEATHERS = ("calm", "moderate", "heavy")
STRATS = ["adaptive", "robust6", "event", "uniform6", "robust4", "robust8"]
LABEL = {"adaptive": "Adaptive (re-sited per event)", "robust6": "Robust docks (6)", "robust4": "Robust docks (4)",
         "robust8": "Robust docks (8)", "event": "Event-sited docks", "uniform6": "Uniform docks (6)"}
STYLE = {"adaptive": dict(color="#1d1d1d", ls="--", marker="o"), "robust6": dict(color="#0b7a75", ls="-", marker="s"),
         "event": dict(color="#c26a00", ls="-", marker="^"), "uniform6": dict(color="#7a7a7a", ls="-", marker="D"),
         "robust4": dict(color="#5fb3ae", ls=":", marker="s"), "robust8": dict(color="#064c49", ls=":", marker="s")}
SLA_S = 30 * 60
NOMINAL_MPP = 2.6                                   # display metres per pixel used by the planner


def load():
    runs = {}
    for f in (HERE / "runs").glob("**/result.json"):
        r = json.loads(f.read_text())
        parts = f.parent.relative_to(HERE / "runs").parts
        strat = "adaptive" if parts[0] == "adaptive" else parts[1]
        w = {0.0: "calm", 3.0: "moderate", 10.0: "heavy"}[r["weather"]["precipitation"]]
        runs[(strat, r["city"], r["grow"], w)] = r
    return runs


def served(r):
    return r["visited"] if r else 0


def main():
    runs = load()
    plt.rcParams.update({"font.family": "Liberation Sans", "font.size": 7.5, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.linewidth": 0.8, "legend.frameon": False})
    out = {"per_strategy": {}, "per_stage": {}, "displacement": {}, "latency": {}, "hubs": {}}
    for city in CITIES:
        for s in STRATS:
            p = HERE / "hubs" / f"{city}_{s}.json"
            if p.exists():
                out["hubs"].setdefault(city, {})[s] = json.loads(p.read_text())

    # ---------- per strategy summary ----------
    for city in CITIES:
        for s in STRATS:
            rows = [(g, w, runs.get((s, city, g, w)), runs.get(("adaptive", city, g, w))) for g in STAGES for w in WEATHERS]
            rows = [x for x in rows if x[3] is not None]
            if not any(x[2] for x in rows):
                continue
            def agg(sel):
                cov = [served(r) / a["drop_points"] for g, w, r, a in sel if a["drop_points"]]
                regret = [(served(a) - served(r)) / served(a) for g, w, r, a in sel if served(a)]
                sla = [sum(t <= SLA_S for t in (r or {}).get("deliveries_s", [])) / a["drop_points"]
                       for g, w, r, a in sel if a["drop_points"]]
                lost = [((r or {}).get("hubs_given") or 0) - ((r or {}).get("hubs_available") or 0) for g, w, r, a in sel] if s != "adaptive" else []
                return {"coverage": float(np.mean(cov)), "regret": float(np.mean(regret)), "sla30": float(np.mean(sla)),
                        "docks_lost_mean": float(np.mean(lost)) if lost else None,
                        "docks_lost_max": int(max(lost)) if lost else None,
                        "served_total": int(sum(served(r) for g, w, r, a in sel)),
                        "infeasible": int(sum(1 for g, w, r, a in sel if not r or r["exit_code"] != 0)),
                        "n": len(sel)}
            out["per_strategy"].setdefault(city, {})[s] = {
                "all": agg(rows), "test": agg([x for x in rows if x[0] in TEST]),
                "train": agg([x for x in rows if x[0] not in TEST]),
                "docks": len(out["hubs"].get(city, {}).get(s, [])) if s != "adaptive" else None}
            out["per_stage"].setdefault(city, {})[s] = {
                str(g): {"coverage": [served(runs.get((s, city, g, w))) / runs[("adaptive", city, g, w)]["drop_points"]
                                      for w in WEATHERS if ("adaptive", city, g, w) in runs],
                         "available": [runs[(s, city, g, w)].get("hubs_available") for w in WEATHERS if (s, city, g, w) in runs]}
                for g in STAGES}

    # ---------- adaptive base displacement between consecutive stages ----------
    for city in CITIES:
        moves = []
        for w in WEATHERS:
            for g0, g1 in zip(STAGES, STAGES[1:]):
                a, b = runs.get(("adaptive", city, g0, w)), runs.get(("adaptive", city, g1, w))
                if not a or not b or not a["bases"] or not b["bases"]:
                    continue
                A, B = np.array(a["bases"], float), np.array(b["bases"], float)
                d = np.hypot(A[:, None, 0] - B[None, :, 0], A[:, None, 1] - B[None, :, 1])
                nearest = d.min(axis=1)                    # how far each old base is from any new base
                moves.append({"weather": w, "from": g0, "to": g1, "mean_px": float(nearest.mean()),
                              "moved_share": float(np.mean(nearest > 45)), "n_old": len(A), "n_new": len(B)})
        out["displacement"][city] = moves

    # ---------- planning latency ----------
    walls = {s: [r["wall_s"] for k, r in runs.items() if k[0] == s and r["exit_code"] == 0] for s in STRATS}
    out["latency"] = {s: {"median": float(np.median(v)), "p90": float(np.percentile(v, 90)), "max": float(max(v)), "n": len(v)}
                      for s, v in walls.items() if v}
    (HERE / "results.json").write_text(json.dumps(out, indent=1))

    # ---------- Fig. 4: coverage vs flood stage ----------
    fig, axes = plt.subplots(2, 1, figsize=(3.45, 3.9), sharex=True)   # one IEEE column, cities stacked
    for ax, city in zip(axes, CITIES):
        for s in ["adaptive", "robust6", "event", "uniform6"]:
            ps = out["per_stage"].get(city, {}).get(s)
            if not ps:
                continue
            m = [100 * np.mean(ps[str(g)]["coverage"]) for g in STAGES]
            lo = [100 * min(ps[str(g)]["coverage"]) for g in STAGES]
            hi = [100 * max(ps[str(g)]["coverage"]) for g in STAGES]
            ax.errorbar(STAGES, m, yerr=[np.subtract(m, lo), np.subtract(hi, m)], capsize=1.5, lw=1.1, ms=3,
                        label=LABEL[s], **STYLE[s])
        for g in TEST:
            ax.axvspan(g - 0.9, g + 0.9, color="#eeeeee", zorder=0)
        ax.set_title(city.title(), fontsize=8, fontweight="bold", loc="left", pad=2)
        ax.set_ylabel("Drop points served (%)")
        ax.set_xticks(STAGES)
        ax.set_ylim(0, 105)
        ax.grid(axis="y", color="#e2e2e2", lw=0.6)
    axes[1].set_xlabel("Flood stage: mask grown by (px)")
    handles, labels = axes[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=2, fontsize=6.5, columnspacing=1.0, bbox_to_anchor=(0.5, 0.035))
    fig.text(0.5, 0.008, "grey bands: held-out stages; bars: range over 3 weathers", ha="center", fontsize=6.3, color="#555")
    fig.tight_layout(rect=(0, 0.13, 1, 1), h_pad=0.6)
    fig.savefig(FIG / "fig4_coverage_stage.png", dpi=300)
    plt.close(fig)

    # ---------- Fig. 5: docks lost to water and 30-min service level ----------
    fig, axes = plt.subplots(2, 1, figsize=(3.45, 4.1))                  # one IEEE column, panels stacked
    strat_bar = ["robust6", "event", "uniform6"]
    x = np.arange(len(STAGES))
    for i, s in enumerate(strat_bar):
        for city, hatch in zip(CITIES, ("", "///")):
            ps = out["per_stage"].get(city, {}).get(s)
            if not ps:
                continue
            given = len(out["hubs"][city][s])
            lost = [given - np.mean([v for v in ps[str(g)]["available"] if v is not None]) for g in STAGES]
            axes[0].bar(x + (i - 1) * 0.27 + (0.065 if hatch else -0.065), lost, 0.13, color=STYLE[s]["color"],
                        hatch=hatch, edgecolor="white", lw=0.3, label=LABEL[s] if not hatch else None)
    axes[0].set_xticks(x, [str(g) for g in STAGES])
    axes[0].set_xlabel("Flood stage (px)")
    axes[0].set_ylabel("Docks unusable (mean)")
    axes[0].legend(fontsize=6.3, loc="upper left")
    axes[0].text(0.99, 0.97, "solid: Varanasi   hatched: Kanpur", transform=axes[0].transAxes, ha="right", va="top", fontsize=6.3)
    axes[0].set_ylim(0, 5.6)
    axes[0].grid(axis="y", color="#e2e2e2", lw=0.6)
    cats = ["adaptive", "robust6", "event", "uniform6"]
    for j, city in enumerate(CITIES):
        vals = [100 * out["per_strategy"][city][s]["all"]["sla30"] if s in out["per_strategy"].get(city, {}) else 0 for s in cats]
        axes[1].bar(np.arange(len(cats)) + (j - 0.5) * 0.38, vals, 0.36, color=[STYLE[s]["color"] for s in cats],
                    hatch="///" if j else "", edgecolor="white", lw=0.3)
        for k, v in enumerate(vals):
            axes[1].text(k + (j - 0.5) * 0.38, v + 1.5, f"{v:.0f}", ha="center", fontsize=6.3)
    axes[1].set_xticks(range(len(cats)), ["Adaptive", "Robust 6", "Event", "Uniform 6"])
    axes[1].set_ylabel("Served within 30 min (%)")
    axes[1].set_ylim(0, 108)
    axes[1].text(0.99, 0.97, "solid: Varanasi   hatched: Kanpur", transform=axes[1].transAxes, ha="right", va="top", fontsize=6.3)
    axes[1].grid(axis="y", color="#e2e2e2", lw=0.6)
    fig.tight_layout()
    fig.savefig(FIG / "fig5_docks_sla.png", dpi=300)
    plt.close(fig)
    print(json.dumps({c: {s: {k: (round(v, 3) if isinstance(v, float) else v) for k, v in d["all"].items()}
                          for s, d in out["per_strategy"][c].items()} for c in out["per_strategy"]}, indent=1))
    print(json.dumps(out["latency"], indent=1))


if __name__ == "__main__":
    os.chdir(HERE)
    main()
