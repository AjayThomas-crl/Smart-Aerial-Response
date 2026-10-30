"""Convert one A.D.A.P.T. multi-base session folder into the JSON + overlay images the
command-centre page animates.

The planner itself (adapt_core/main.py) is not modified. This script only reads what it wrote
(run_summary.json, baseN.route.json, baseN.waypoints) and re-creates the flood mask and the
forecast spread with the same adapt_core functions and the same sample points, so they can be
drawn as map layers.

    python3 demo/export_session.py <session_dir> <city> <out_dir> [--points "x,y;x,y"] [--horizon 2]
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
CORE = HERE.parent / "adapt_core"
sys.path.insert(0, str(CORE))

from src.vision.image_processing import ImageProcessor          # noqa: E402
from src.weather.flood_spread import predict_spread              # noqa: E402
from src.mission.constraints import sortie_battery_report, wind_kmh_to_mps  # noqa: E402
from config import settings                                      # noqa: E402

CITY_INFO = {
    "varanasi": {"name": "Varanasi", "region": "Varanasi / Chandauli districts, Uttar Pradesh",
                 "river": "Ganga"},
    "kanpur": {"name": "Kanpur", "region": "Kanpur Nagar / Kanpur Dehat districts, Uttar Pradesh",
               "river": "Ganga"},
}
DISPLAY_WIDTH = 750
DRONE_COLORS = ["#ffb000", "#00d1ff", "#ff4fa3", "#7cff6b", "#b78cff", "#ff7a45"]


def display_image(city):
    image = cv2.imread(str(CORE / "data" / "input" / f"{city}.png"))
    h, w = image.shape[:2]
    if w > DISPLAY_WIDTH:
        image = cv2.resize(image, (DISPLAY_WIDTH, int(round(h * DISPLAY_WIDTH / float(w)))),
                           interpolation=cv2.INTER_AREA)
    return image


def flood_layers(image, points, weather, horizon):
    """Same steps as main.py: HSV sampling -> mask -> weather spread forecast."""
    proc = ImageProcessor()
    proc.sample_points = points or proc.auto_sample_points(image)
    proc.image = image.copy()
    proc.compute_dynamic_hsv()
    mask = proc.mask_flood_areas(image)
    if mask.ndim == 3:
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    mask = ((mask > 0) * 255).astype(np.uint8)
    forecasts = predict_spread(mask, weather, horizon)
    pred = forecasts[max(forecasts)]
    return mask, pred, [list(map(int, p)) for p in proc.sample_points]


def rgba_layer(binary, rgba, min_px=40):
    """Transparent overlay. Specks under ``min_px`` are left out of the picture only (the planner
    still treats them as flood); they make the projected map look noisy."""
    n, labels, st, _ = cv2.connectedComponentsWithStats((binary > 0).astype(np.uint8), connectivity=8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= min_px
    out = np.zeros((*binary.shape, 4), np.uint8)
    out[keep[labels]] = rgba
    return out


def zone_outlines(layer, mask, min_area=200):
    """Outline the flood zones that get relief drops (area >= --min-area, as in main.py)."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    zones = [c for c in contours if cv2.contourArea(c) >= min_area]
    cv2.drawContours(layer, zones, -1, (255, 235, 200, 235), 1, cv2.LINE_AA)
    return layer


def build(session_dir, city, out_dir, points=None, horizon=2.0, tag=None):
    session_dir, out_dir = Path(session_dir), Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = tag or city
    summary = json.loads((session_dir / "run_summary.json").read_text())
    weather = summary["weather"]
    mpp = float(summary["meters_per_pixel"])
    headwind = wind_kmh_to_mps(weather.get("wind_speed_10m", 0.0))

    image = display_image(city)
    mask, pred, used_points = flood_layers(image, points, weather, horizon)
    spread = cv2.bitwise_and(pred, cv2.bitwise_not(mask))
    cv2.imwrite(str(out_dir / f"{tag}_map.jpg"), image, [cv2.IMWRITE_JPEG_QUALITY, 88])
    # BGRA order for OpenCV: flood = blue, forecast spread = amber
    cv2.imwrite(str(out_dir / f"{tag}_flood.png"), zone_outlines(rgba_layer(mask, (255, 110, 25, 150)), mask))
    cv2.imwrite(str(out_dir / f"{tag}_spread.png"), rgba_layer(spread, (0, 150, 255, 95), min_px=80))
    planner_map = session_dir / "mission_route_map.png"
    if planner_map.exists():
        shutil.copyfile(planner_map, out_dir / f"{tag}_planner_map.png")

    drop_points = [list(map(int, p)) for p in summary.get("drop_points", [])]
    assignment = {int(k): v for k, v in summary.get("assignment", {}).items()}
    unreachable = sorted(int(k) for k in summary.get("unreachable_by_any_base", {}))

    drones = []
    for base in summary.get("bases", []):
        n = base["base"]
        route = json.loads((session_dir / f"base{n}.route.json").read_text())
        path = [[round(x, 1), round(y, 1)] for x, y in route["full_path"]]
        sorties = sortie_battery_report(route["full_path"], route["drop_indices"], route["reload_indices"],
                                        meters_per_pixel=mpp, headwind_mps=headwind)
        wp_lines = (session_dir / f"base{n}.waypoints").read_text().strip().splitlines()
        drones.append({
            "id": n, "color": DRONE_COLORS[(n - 1) % len(DRONE_COLORS)],
            "home": list(map(float, route["home"])), "path": path,
            "drops": route["drop_indices"], "reloads": route["reload_indices"],
            "sorties": [{"start": s["start_index"], "end": s["end_index"], "drops": s["drops"],
                         "distance_m": round(s["distance_m"]), "battery": round(s["battery_fraction"], 4)}
                        for s in sorties],
            "assigned": base["assigned"], "visited": base["visited"],
            "legs": base["legs"], "waypoint_count": len(wp_lines) - 1,
            "distance_m": round(sum(s["distance_m"] for s in sorties)),
        })

    data = {
        "city": city, **CITY_INFO.get(city, {"name": city.title(), "region": "", "river": ""}),
        "session": session_dir.name, "weather": weather, "horizon_h": horizon,
        "image": {"w": int(image.shape[1]), "h": int(image.shape[0]),
                  "map": f"{tag}_map.jpg", "flood": f"{tag}_flood.png", "spread": f"{tag}_spread.png",
                  "planner": f"{tag}_planner_map.png" if planner_map.exists() else None},
        "sample_points": used_points, "meters_per_pixel": mpp, "geo_anchor": summary["geo_anchor"],
        "vehicle": {"model": settings.DRONE_MODEL_REFERENCE, "speed_mps": settings.DRONE_SPEED_MPS,
                    "payload_per_drop_kg": settings.PAYLOAD_PER_DROP_KG,
                    "capacity_kg": settings.PAYLOAD_CAPACITY_KG,
                    "endurance_min": settings.DRONE_LOADED_ENDURANCE_MIN,
                    "reserve": settings.BATTERY_RESERVE_FRACTION},
        "drop_points": drop_points,
        "assignment": {str(k): v for k, v in assignment.items()},
        "unreachable": unreachable,
        "stats": {
            "drop_points": len(drop_points), "visited": summary.get("drops_visited", 0),
            "unreachable": len(unreachable), "bases": len(drones),
            "sorties": sum(len(d["sorties"]) for d in drones), "reloads": summary.get("reloads", 0),
            "crossings": len(summary.get("path_overlaps", [])),
            "legs": summary.get("legs", {}),
            "best_single_reach": (summary.get("selection") or {}).get("best_single_reach"),
            "coverable": (summary.get("selection") or {}).get("coverable"),
            "max_battery": round(max((s["battery"] for d in drones for s in d["sorties"]), default=0), 4),
            "flood_coverage": round(float(np.count_nonzero(mask)) / mask.size, 4),
            "outcome": summary.get("outcome"),
        },
        "drones": drones,
    }
    (out_dir / f"{tag}.json").write_text(json.dumps(data))
    # file:// fallback: the page can load this with a <script> tag when no server is running
    (out_dir / f"{tag}.js").write_text(
        f"window.SAR_DATA=window.SAR_DATA||{{}};window.SAR_DATA[{json.dumps(tag)}]={json.dumps(data)};\n")
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("session_dir")
    ap.add_argument("city")
    ap.add_argument("out_dir")
    ap.add_argument("--points", default=None, help="x,y;x,y sample points used for the run")
    ap.add_argument("--horizon", type=float, default=2.0)
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    a.session_dir, a.out_dir = os.path.abspath(a.session_dir), os.path.abspath(a.out_dir)
    os.chdir(CORE)   # config/.env and data paths are relative to the planner folder
    pts = [tuple(map(int, s.split(","))) for s in a.points.split(";") if s.strip()] if a.points else None
    d = build(a.session_dir, a.city, a.out_dir, pts, a.horizon, a.tag)
    print(json.dumps(d["stats"], indent=1))


if __name__ == "__main__":
    main()
