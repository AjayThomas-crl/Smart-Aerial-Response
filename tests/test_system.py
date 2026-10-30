"""End to end through the demo server: health check, live planner run streamed over SSE, input validation (TC-T01 ... TC-T03)."""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
pytestmark = pytest.mark.system


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def server():
    env = {**os.environ, "SAR_PORT": str(free_port()), "PYTHONUNBUFFERED": "1"}
    proc = subprocess.Popen([sys.executable, str(ROOT / "demo" / "server.py"), "--no-browser"], env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    url = None
    for line in proc.stdout:                      # the server may move to the next port if this one is busy
        m = re.search(r"running at (http://\S+)", line)
        if m:
            url = m.group(1)
            break
    assert url, "demo server did not start"
    time.sleep(0.3)
    yield url
    proc.terminate()
    proc.wait(10)


def sse(url, timeout):
    """Read a Server-Sent Events stream until a done or fail event; returns (event, data, log lines)."""
    lines, event = [], None
    with urllib.request.urlopen(url, timeout=timeout) as r:
        for raw in r:
            line = raw.decode().rstrip("\n")
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                if event in ("done", "fail"):
                    return event, data, lines
                lines.append(data.get("line", ""))
    return None, None, lines


def test_t01_health_reports_planner_ready(server):
    health = json.loads(urllib.request.urlopen(server + "/api/health", timeout=10).read())
    assert health["ok"] and health["planner_ready"], health


def test_t02_live_plan_for_varanasi_streams_to_done(server):
    event, data, log = sse(server + "/api/plan?city=varanasi&weather=heavy", timeout=240)
    assert event == "done", (data, log[-10:])
    stats = data["stats"]
    assert stats["bases"] > 0 and stats["visited"] > 0
    assert stats["crossings"] == 0


def test_t03_unknown_city_is_rejected(server):
    event, data, _ = sse(server + "/api/plan?city=paris", timeout=30)
    assert event == "fail" and data["message"] == "bad request"
