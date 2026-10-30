"""Unit tests of the planner building blocks the system relies on (TC-U01 ... TC-U12)."""
import numpy as np
import pytest

from src.mission import constraints
from src.mission.coordinates import pixel_to_latlon
from src.mission.mission_output import generate_mission_file, validate_waypoints_file
from src.routing.pathfinding import compute_full_path, nearest_neighbor_tsp, polyline_flood_pixels, polyline_intersections
from src.vision.image_processing import ImageProcessor
from src.weather.flood_spread import predict_spread
from src.weather.weather_api import sanitize_weather


def test_u01_battery_grows_with_distance_payload_and_headwind():
    base = constraints.leg_battery_fraction(1000)
    assert constraints.leg_battery_fraction(0) == 0
    assert constraints.leg_battery_fraction(2000) == pytest.approx(2 * base)
    assert constraints.leg_battery_fraction(1000, payload_kg=1.0) > base
    assert constraints.leg_battery_fraction(1000, headwind_mps=5.0) > base


def test_u02_wind_unit_conversion():
    assert constraints.wind_kmh_to_mps(36) == pytest.approx(10.0)
    assert constraints.wind_kmh_to_mps(-5) == 0.0


def test_u03_headwind_component_uses_wind_from_bearing():
    north = ((0, 10), (0, 0))                   # image y grows south, so this leg flies north
    assert constraints.headwind_component_mps(10, 0, *north) == pytest.approx(10.0)
    assert constraints.headwind_component_mps(10, 180, *north) == 0.0


def test_u04_payload_splits_into_sorties():
    assert constraints.split_sorties(5, 0.25, 0.5) == [[0, 1], [2, 3], [4]]
    assert constraints.split_sorties(0, 0.25, 0.5) == []


def test_u05_tsp_tour_starts_and_ends_at_base_and_visits_every_drop():
    drops = [(10, 0), (0, 10), (5, 5), (20, 20)]
    order, tour = nearest_neighbor_tsp(drops, home=(0, 0))
    assert tour[0] == tour[-1] == (0, 0)
    assert sorted(order) == list(range(len(drops)))


def test_u06_crossing_detector():
    assert polyline_intersections([(0, 0), (10, 10)], [(0, 10), (10, 0)]) == [(5.0, 5.0)]
    assert polyline_intersections([(0, 0), (10, 0)], [(0, 5), (10, 5)]) == []


def test_u07_pixel_to_latlon():
    centre = (25.3176, 82.9739)
    assert pixel_to_latlon(100, 100, (100, 100), centre, 2.0) == pytest.approx(centre)
    lat, lon = pixel_to_latlon(100, 50, (100, 100), centre, 2.0)       # 100 m north
    assert lat - centre[0] == pytest.approx(100 / 111_320, rel=0.01)
    with pytest.raises(ValueError):
        pixel_to_latlon(0, 0, (100, 100), centre, 0)


def test_u08_weather_sanitised():
    w = sanitize_weather({"status": "success", "precipitation": None, "wind_speed_10m": 12})
    assert w["precipitation"] == 0.0 and w["wind_speed_10m"] == 12.0 and w["status"] == "partial"


def test_u09_mission_file_is_valid_qgc_wpl(tmp_path):
    f = tmp_path / "m.waypoints"
    path = [(100, 100), (150, 100), (150, 150), (100, 100)]
    generate_mission_file(path, [1, 2], (100, 100), (100, 100), (25.3176, 82.9739), 2.0, filename=str(f))
    assert validate_waypoints_file(str(f)) == []
    f.write_text(f.read_text().replace("QGC WPL 110", "QGC WPL 100"))
    assert validate_waypoints_file(str(f)) != []


def test_u10_dstar_route_avoids_water():
    mask = np.zeros((200, 200), np.uint8)
    mask[0:160, 95:105] = 255                    # a river with a crossing point only at the bottom
    path, stops, legs = compute_full_path([(40, 40), (160, 40)], mask, downsample_factor=5)[:3]
    assert polyline_flood_pixels(path, mask) == 0
    assert legs[0] > 120 * 2.0                   # longer than the straight 120 px line (2 m per px)


def test_u11_flood_segmentation_on_varanasi(city_image):
    img = city_image("varanasi")
    proc = ImageProcessor()
    proc.sample_points = proc.auto_sample_points(img)
    proc.image = img.copy()
    proc.compute_dynamic_hsv()
    share = (proc.mask_flood_areas(img) > 0).mean()
    assert 0.03 < share < 0.4


def test_u12_heavy_weather_spreads_further_and_never_recedes():
    mask = np.zeros((300, 300), np.uint8)
    mask[140:160, 140:160] = 255
    calm = predict_spread(mask, {"precipitation": 0, "wind_speed_10m": 0}, 2.0)
    heavy = predict_spread(mask, {"precipitation": 10, "wind_speed_10m": 30, "wind_direction_10m": 270}, 2.0)
    last = max(heavy)
    assert (heavy[last] > 0).sum() > (calm[max(calm)] > 0).sum()
    assert np.all(heavy[last][mask > 0] > 0)
