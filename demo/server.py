#!/usr/bin/env python3
"""Smart Aerial Response - live demo server.

Serves the command-centre page and, when "Plan swarm" is pressed, runs the real A.D.A.P.T.
planner (adapt_core/main.py, multi-UAV mode, headless) as a subprocess. Its log is streamed to
the page line by line (Server-Sent Events); when it finishes, the new session is exported and
the page replays the swarm.

    python3 demo/server.py            # then open http://localhost:8765

The server itself needs only the standard library. The planner needs OpenCV and friends, so it is
run with the project's .venv Python when there is one (demo/start_demo.sh creates it), otherwise
with the Python that started the server.
"""
import json
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
CORE = HERE.parent / "adapt_core"
STATIC = HERE / "static"
RUNS = HERE / "runs"
LIVE = STATIC / "live"
PORT = int(os.environ.get("SAR_PORT", "8765"))
CITIES = ("varanasi", "kanpur")
RUN_LOCK = threading.Lock()
PLANNER_MODULES = ("cv2", "numpy", "matplotlib", "dotenv", "requests")
FIX_HINT = "run demo/start_demo.sh (or: python3 -m venv .venv && .venv/bin/pip install -r demo/requirements.txt)"


def find_planner_python():
    """First interpreter that can import the planner's dependencies: (path, None) or (None, problem)."""
    root = HERE.parent
    candidates = [root / ".venv" / "bin" / "python", root / ".venv" / "Scripts" / "python.exe", Path(sys.executable)]
    tried = []
    for py in candidates:
        if not py.exists():
            continue
        check = subprocess.run([str(py), "-c", f"import {', '.join(PLANNER_MODULES)}"],
                               capture_output=True, text=True)
        if check.returncode == 0:
            return str(py), None
        missing = (check.stderr.strip().splitlines() or ["import failed"])[-1]
        tried.append(f"{py}: {missing}")
    return None, "no Python with the planner's packages found (" + "; ".join(tried) + ")"


PLANNER_PY, PLANNER_PROBLEM = find_planner_python()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC), **kw)

    def log_message(self, fmt, *args):
        if "/api/" in str(args[0] if args else ""):
            sys.stderr.write("[demo] " + fmt % args + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/plan":
            return self.plan(parse_qs(url.query))
        if url.path == "/api/health":
            body = json.dumps({"ok": True, "core": str(CORE), "planner_ready": PLANNER_PY is not None,
                               "python": PLANNER_PY, "problem": PLANNER_PROBLEM, "fix": FIX_HINT}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            return self.wfile.write(body)
        return super().do_GET()

    # ---- Server-Sent Events -------------------------------------------------
    def sse(self, event, data):
        payload = f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()
        self.wfile.write(payload)
        self.wfile.flush()

    def plan(self, q):
        city = q.get("city", ["varanasi"])[0]
        weather = q.get("weather", ["heavy"])[0]
        max_bases = q.get("max_bases", ["6"])[0]
        points = q.get("points", [""])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()

        if city not in CITIES or weather not in ("heavy", "moderate", "live") \
                or not max_bases.isdigit() or not 1 <= int(max_bases) <= 8 \
                or (points and not re.fullmatch(r"\d+,\d+(;\d+,\d+)*", points)):
            return self.sse("fail", {"message": "bad request"})
        if not RUN_LOCK.acquire(blocking=False):
            return self.sse("fail", {"message": "a planner run is already in progress"})
        try:
            self.run_planner(city, weather, int(max_bases), points)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            RUN_LOCK.release()

    def run_planner(self, city, weather, max_bases, points):
        if PLANNER_PY is None:
            self.sse("log", {"line": PLANNER_PROBLEM, "kind": "err"})
            self.sse("log", {"line": "fix: " + FIX_HINT + ", then restart the server", "kind": "warn"})
            return self.sse("fail", {"message": "planner packages missing - see console"})
        RUNS.mkdir(exist_ok=True)
        cmd = [PLANNER_PY, "-u", "main.py", f"data/input/{city}.png", "--mode", "multi", "--no-gui",
               "--max-bases", str(max_bases), "--session-root", str(RUNS / city)]
        if weather == "heavy":
            cmd.append("--dummy-weather")
        elif weather == "moderate":
            cmd.append("--dummy-weather-moderate")
        if points:
            cmd += ["--sample-points", points]
        shown = " ".join(c if not c.startswith("/") else os.path.relpath(c, CORE) for c in cmd[2:])
        self.sse("log", {"line": f"$ python {shown}", "kind": "cmd"})

        started = time.time()
        proc = subprocess.Popen(cmd, cwd=CORE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, bufsize=1, env={**os.environ, "PYTHONUNBUFFERED": "1",
                                                           "MPLBACKEND": "Agg"})
        session = None
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            m = re.search(r"SESSION OUTPUT: (.+)$", line)
            if m:
                session = Path(m.group(1).strip())
            kind = "err" if "[ERROR]" in line or "Traceback" in line else \
                   "warn" if "[WARNING]" in line else "info"
            self.sse("log", {"line": line, "kind": kind})
        code = proc.wait()
        elapsed = time.time() - started
        if code != 0 or session is None or not (session / "run_summary.json").exists():
            return self.sse("fail", {"message": f"planner exited with code {code}", "code": code})

        self.sse("log", {"line": f"planner finished in {elapsed:.1f} s - exporting swarm for replay...",
                         "kind": "cmd"})
        # The exporter needs OpenCV too, so it runs with the planner's Python, not in this process.
        export = [PLANNER_PY, str(HERE / "export_session.py"), str(session), city, str(LIVE), "--tag", f"{city}_live"]
        if points:
            export += ["--points", points]
        done = subprocess.run(export, capture_output=True, text=True)
        if done.returncode != 0:
            for line in (done.stdout + done.stderr).strip().splitlines()[-15:]:
                self.sse("log", {"line": line, "kind": "err"})
            return self.sse("fail", {"message": f"export failed with code {done.returncode}"})
        data = json.loads((LIVE / f"{city}_live.json").read_text())
        self.sse("done", {"url": f"live/{city}_live.json", "seconds": round(elapsed, 1),
                          "stats": data["stats"]})


def main():
    LIVE.mkdir(parents=True, exist_ok=True)
    # Another copy of the demo (or anything else) may already hold the port: take the next free one.
    for port in range(PORT, PORT + 10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            print(f"port {port} is busy (is the demo already running?), trying {port + 1}...")
    else:
        sys.exit(f"no free port between {PORT} and {PORT + 9}; set SAR_PORT to another port")
    url = f"http://localhost:{port}"
    print(f"Smart Aerial Response demo running at {url}  (Ctrl+C to stop)")
    if PLANNER_PY:
        print(f"planner Python: {PLANNER_PY}")
    else:
        print(f"WARNING: live planning is off - {PLANNER_PROBLEM}\n  fix: {FIX_HINT}")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
