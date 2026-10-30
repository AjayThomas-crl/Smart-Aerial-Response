"""Dock-siting study: site availability, dock separation, held-out coverage, run completeness (TC-S01 ... TC-S04)."""
import itertools
import json
import math
from pathlib import Path

import pytest

STUDY = Path(__file__).resolve().parent.parent / "research" / "hub_study"
CITIES = ("varanasi", "kanpur")


@pytest.mark.parametrize("city", CITIES)
@pytest.mark.parametrize("weather", ("calm", "heavy"))
def test_s01_usable_sites_shrink_as_the_flood_rises(city, weather, city_image):
    from select_hubs import usable_sites, WEATHER, STAGES
    rain, wind = WEATHER[weather]
    sites = [usable_sites(city_image(city), g, rain, wind) for g in STAGES]
    assert all(later <= earlier for earlier, later in zip(sites, sites[1:]))
    assert len(sites[-1]) < len(sites[0])


@pytest.mark.parametrize("city", CITIES)
def test_s02_robust_docks_respect_base_separation(city):
    from config import settings
    docks = json.loads((STUDY / "hubs" / f"{city}_robust6.json").read_text())
    assert len(docks) == 6
    assert min(math.dist(a, b) for a, b in itertools.combinations(docks, 2)) >= settings.MIN_BASE_SEPARATION_PX


@pytest.mark.parametrize("city", CITIES)
def test_s03_robust_docks_beat_event_sited_on_held_out_stages(city):
    s = json.loads((STUDY / "results.json").read_text())["per_strategy"][city]
    assert s["robust6"]["test"]["coverage"] > s["event"]["test"]["coverage"]
    assert s["robust6"]["test"]["coverage"] > s["uniform6"]["test"]["coverage"]


def test_s04_all_180_planner_runs_completed():
    results = [json.loads(f.read_text()) for f in (STUDY / "runs").glob("**/result.json")]
    assert len(results) == 180
    assert all(r["exit_code"] == 0 for r in results)
