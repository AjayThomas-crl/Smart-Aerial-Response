import sys
from pathlib import Path

import cv2
import pytest

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / "adapt_core"
for p in (CORE, ROOT / "iot", ROOT / "research" / "hub_study", ROOT / "demo"):
    sys.path.insert(0, str(p))


def pytest_configure(config):
    config.addinivalue_line("markers", "system: end-to-end tests that run the planner (about a minute each)")


@pytest.fixture(scope="session")
def city_image():
    """Flood maps scaled to the planner's display width, as the planner and the study use them."""
    def load(city):
        img = cv2.imread(str(CORE / "data" / "input" / f"{city}.png"))
        h, w = img.shape[:2]
        return cv2.resize(img, (750, int(round(h * 750 / float(w)))), interpolation=cv2.INTER_AREA)
    return load
