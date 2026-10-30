"""Choose fixed drone-dock sites from the adaptive runs (phase A) and write hubs/<city>_<strategy>.json.

Strategies (all docks are planner grid points, at least MIN_BASE_SEPARATION_PX apart):
  robustH  - H sites scored by the drops served by nearby adaptive bases in the TRAINING scenarios
             (stages 0, 6, 12; all weathers), times the share of training scenarios in which the
             site stays dry with flood clearance. Stages 3 and 9 are held out for testing.
  event    - the bases the planner chose for one event only (stage 0, moderate weather).
  uniform6 - six sites spread evenly over dry land (k-means on stage-0 dry grid points).
Also writes availability.json: for every scenario, the set of usable (dry, clear) grid points.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CORE = HERE.parent.parent / "adapt_core"
sys.path.insert(0, str(CORE))
sys.path.insert(0, str(HERE))
os.chdir(CORE)
import cv2                                                   # noqa: E402
from config import settings                                  # noqa: E402
from src.vision.image_processing import ImageProcessor       # noqa: E402
from src.weather.flood_spread import predict_spread          # noqa: E402
from run_batch import CITIES, STAGES, WEATHER                # noqa: E402

TRAIN_STAGES = (0, 6, 12)
MERGE_PX = 45                     # adaptive bases within this distance support the same dock site
SEP = settings.MIN_BASE_SEPARATION_PX


def display_image(city):
    image = cv2.imread(f"data/input/{city}.png")
    h, w = image.shape[:2]
    if w > 750:
        image = cv2.resize(image, (750, int(round(h * 750 / float(w)))), interpolation=cv2.INTER_AREA)
    return image


def usable_sites(image, grow, rain, wind):
    """Same test as the multi-base planner: dry under current + forecast flood, with clearance."""
    proc = ImageProcessor()
    proc.sample_points = proc.auto_sample_points(image)
    proc.image = image.copy()
    proc.compute_dynamic_hsv()
    mask = proc.mask_flood_areas(image)
    if grow > 0:
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    if mask.ndim == 3:
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    forecasts = predict_spread(mask, {"precipitation": rain, "wind_speed_10m": wind, "wind_direction_10m": 270.0}, 2.0)
    obstacle = cv2.bitwise_or(mask, forecasts[max(forecasts)])
    stride = max(1, int(max(image.shape[:2]) / 60))
    gy, gx = np.mgrid[stride // 2:image.shape[0]:stride, stride // 2:image.shape[1]:stride]
    clearance = cv2.distanceTransform((obstacle == 0).astype(np.uint8), cv2.DIST_L2, 5)
    return {(int(x), int(y)) for x, y in zip(gx.ravel(), gy.ravel())
            if obstacle[y, x] == 0 and clearance[y, x] >= settings.HOME_CLEARANCE_PX}


def served_per_base(result):
    summary = json.loads((Path(result["session"]) / "run_summary.json").read_text())
    return [(tuple(b["home"]), b["visited"]) for b in summary.get("bases", [])]


def pick_separated(scored, n):
    chosen = []
    for site, score in sorted(scored.items(), key=lambda kv: -kv[1]):
        if score <= 0:
            break
        if all(np.hypot(site[0] - c[0], site[1] - c[1]) >= SEP for c in chosen):
            chosen.append(site)
        if len(chosen) == n:
            break
    return chosen


def main():
    (HERE / "hubs").mkdir(exist_ok=True)
    availability = {}
    for city in CITIES:
        image = display_image(city)
        avail = {}
        for g in STAGES:
            for wname, (rain, wind) in WEATHER.items():
                avail[(g, wname)] = usable_sites(image, g, rain, wind)
        availability[city] = {f"g{g}_{w}": sorted(map(list, s)) for (g, w), s in avail.items()}

        results = {}
        for g in STAGES:
            for wname in WEATHER:
                p = HERE / "runs" / "adaptive" / f"{city}_g{g}_{wname}" / "result.json"
                if p.exists():
                    results[(g, wname)] = json.loads(p.read_text())

        train = [k for k in results if k[0] in TRAIN_STAGES and results[k].get("session")]
        support = []                                  # (site, drops served) from training plans
        for k in train:
            support += served_per_base(results[k])
        candidates = {s for s, _ in support}
        scored = {}
        for c in candidates:
            weight = sum(v for s, v in support if np.hypot(s[0] - c[0], s[1] - c[1]) <= MERGE_PX)
            dry_share = np.mean([c in avail[k] for k in train])
            scored[c] = weight * dry_share
        for n in (4, 6, 8):
            hubs = pick_separated(scored, n)
            (HERE / "hubs" / f"{city}_robust{n}.json").write_text(json.dumps([list(h) for h in hubs]))
            print(city, f"robust{n}", len(hubs), hubs)

        event = results[(0, "moderate")]["bases"]
        (HERE / "hubs" / f"{city}_event.json").write_text(json.dumps(event))
        print(city, "event", len(event), event)

        dry0 = np.array(sorted(avail[(0, "calm")]), np.float32)
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.5)
        cv2.setRNGSeed(7)
        _, _, centres = cv2.kmeans(dry0, 6, None, crit, 10, cv2.KMEANS_PP_CENTERS)
        uniform = []
        for cx, cy in centres:                        # snap each centre to the nearest usable grid point
            d = np.hypot(dry0[:, 0] - cx, dry0[:, 1] - cy)
            uniform.append([int(v) for v in dry0[int(np.argmin(d))]])
        (HERE / "hubs" / f"{city}_uniform6.json").write_text(json.dumps(uniform))
        print(city, "uniform6", uniform)
    (HERE / "availability.json").write_text(json.dumps(availability))


if __name__ == "__main__":
    main()
