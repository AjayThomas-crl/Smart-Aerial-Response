"""One planner run for the drone-dock siting study.

Runs the unmodified A.D.A.P.T. planner (adapt_core/main.py, multi-UAV mode) on one scenario:
  - flood stage: the detected flood mask grown by `--grow` display pixels (rising water),
  - weather: rain / wind given on the command line instead of the live API,
  - bases: either chosen freely by the planner ("adaptive") or restricted to a fixed set of
    dock sites (`--hubs file.json`); a dock that is flooded or too close to water in this
    scenario is unavailable.
Writes result.json in the session folder with coverage, base sites, timing and wall time.

    python run_scenario.py --city varanasi --grow 8 --rain 3 --wind 12 --max-bases 6 --out DIR [--hubs hubs.json]
"""
import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORE = HERE.parent.parent / "adapt_core"

# Mission timing for the service-level metric (not used by the planner's own battery check).
# Vertical speeds follow ArduCopter defaults: climb 2.5 m/s, descend 1.5 m/s, final landing 0.5 m/s.
CRUISE_ALT, DROP_ALT, LOITER = 100.0, 10.0, 5.0
CLIMB, DESCEND, LAND_FINAL = 2.5, 1.5, 0.5
TAKEOFF_S = CRUISE_ALT / CLIMB                                      # 40 s
LAND_S = (CRUISE_ALT - 10) / DESCEND + 10 / LAND_FINAL              # 80 s
DROP_S = LOITER + (CRUISE_ALT - DROP_ALT) * (1 / DESCEND + 1 / CLIMB)   # 101 s
SWAP_S = 120.0                                                      # battery swap and reload at the dock


def timeline(route, mpp, speed):
    """Delivery times (s after dispatch) of every drop on one drone's routed path."""
    path, drops, reloads = route["full_path"], set(route["drop_indices"]), set(route["reload_indices"])
    t, times = TAKEOFF_S, []
    for i in range(len(path) - 1):
        t += math.dist(path[i], path[i + 1]) * mpp / speed
        j = i + 1
        if j in drops:
            t += DROP_S
            times.append(t)
        if j in reloads and j < len(path) - 1:
            t += LAND_S + SWAP_S + TAKEOFF_S
    return times, t + LAND_S


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--grow", type=int, default=0)
    ap.add_argument("--rain", type=float, default=0.0)
    ap.add_argument("--wind", type=float, default=0.0)
    ap.add_argument("--wind-from", type=float, default=270.0)
    ap.add_argument("--max-bases", type=int, default=6)
    ap.add_argument("--hubs", default=None)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    hubs = json.loads(Path(a.hubs).read_text()) if a.hubs else None

    sys.path.insert(0, str(CORE))
    os.chdir(CORE)
    import cv2
    import numpy as np
    import main as planner
    from src.vision.image_processing import ImageProcessor
    import src.pipeline.multi_base_planner as mbp
    from config import settings

    weather = {"precipitation": a.rain, "wind_speed_10m": a.wind, "wind_direction_10m": a.wind_from}
    planner.get_weather_data = lambda lat, lon: dict(weather)

    info = {"grow": a.grow, "mask_coverage": None, "hubs_given": len(hubs) if hubs else None, "hubs_available": None}
    original_mask = ImageProcessor.mask_flood_areas

    def grown_mask(self, image):
        mask = original_mask(self, image)
        if a.grow > 0:
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * a.grow + 1, 2 * a.grow + 1))
            mask = cv2.dilate(mask, k)
        m = mask if mask.ndim == 2 else mask[..., 0]
        info["mask_coverage"] = float(np.count_nonzero(m)) / m.size
        return mask
    ImageProcessor.mask_flood_areas = grown_mask

    if hubs is not None:
        original_select = mbp.select_bases

        def select_from_hubs(candidates, *args, **kwargs):
            usable = set(map(tuple, candidates))          # dry grid points with flood clearance, this scenario
            available = [tuple(h) for h in hubs if tuple(h) in usable]
            info["hubs_available"] = len(available)
            info["hubs_flooded"] = [list(h) for h in hubs if tuple(h) not in usable]
            return original_select(available, *args, **kwargs)
        mbp.select_bases = select_from_hubs

    sys.argv = ["main.py", f"data/input/{a.city}.png", "--mode", "multi", "--no-gui",
                "--max-bases", str(a.max_bases), "--session-root", str(out)]
    started = time.time()
    code = 0
    try:
        planner.main()
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    wall = time.time() - started

    sessions = sorted(out.glob("session_*"))
    result = {"city": a.city, "grow": a.grow, "weather": weather, "max_bases": a.max_bases,
              "mode": "fixed" if hubs else "adaptive", "exit_code": code, "wall_s": wall, **info,
              "drop_points": 0, "visited": 0, "bases": [], "sorties": 0, "deliveries_s": [], "makespan_s": None}
    if sessions and (sessions[-1] / "run_summary.json").exists():
        s = json.loads((sessions[-1] / "run_summary.json").read_text())
        result.update({"drop_points": len(s.get("drop_points", [])), "visited": s.get("drops_visited", 0),
                       "unreachable": len(s.get("unreachable_by_any_base", {}) or {}),
                       "bases": [b["home"] for b in s.get("bases", [])],
                       "sorties": len(s.get("routed_sortie_battery", [])),
                       "max_battery": max(s.get("routed_sortie_battery", []) or [0]),
                       "crossings": len(s.get("path_overlaps", []) or []),
                       "outcome": s.get("outcome"), "selection_coverable": (s.get("selection") or {}).get("coverable"),
                       "best_single_reach": (s.get("selection") or {}).get("best_single_reach")})
        if not result["drop_points"]:
            result["drop_points"] = len(s.get("drop_points", []))
        times, ends = [], []
        for b in s.get("bases", []):
            route = json.loads((sessions[-1] / f"base{b['base']}.route.json").read_text())
            t, end = timeline(route, s["meters_per_pixel"], settings.DRONE_SPEED_MPS)
            times += t
            ends.append(end)
        result["deliveries_s"] = sorted(times)
        result["makespan_s"] = max(ends) if ends else None
        result["session"] = str(sessions[-1])
    (out / "result.json").write_text(json.dumps(result, indent=1))
    print(json.dumps({k: result[k] for k in ("city", "grow", "mode", "exit_code", "visited", "drop_points", "wall_s")}))


if __name__ == "__main__":
    main()
