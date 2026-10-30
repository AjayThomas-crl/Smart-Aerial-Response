"""Run a batch of scenarios in parallel and collect their result.json files.

    python run_batch.py adaptive            # phase A: planner chooses bases freely, every scenario
    python run_batch.py fixed               # phase B: every dock strategy in hubs/*.json, every scenario
"""
import itertools
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = str(HERE.parent.parent / ".venv" / "bin" / "python")
RUNS = HERE / "runs"
CITIES = ("varanasi", "kanpur")
STAGES = (0, 3, 6, 9, 12)                                   # flood grown by this many display px
WEATHER = {"calm": (0.0, 0.0), "moderate": (3.0, 12.0), "heavy": (10.0, 30.0)}   # rain mm/h, wind km/h
WORKERS = int(os.environ.get("WORKERS", "8"))


def scenarios():
    for city, stage, (wname, (rain, wind)) in itertools.product(CITIES, STAGES, WEATHER.items()):
        yield city, stage, wname, rain, wind


def job(args):
    tag, cmd = args
    out = RUNS / tag
    if (out / "result.json").exists():
        return tag, "cached"
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "log.txt", "w") as log:
        subprocess.run(cmd + ["--out", str(out)], stdout=log, stderr=subprocess.STDOUT,
                       env={**os.environ, "MPLBACKEND": "Agg", "OMP_NUM_THREADS": "2"})
    return tag, "ok" if (out / "result.json").exists() else "FAILED"


def main():
    phase = sys.argv[1]
    jobs = []
    for city, stage, wname, rain, wind in scenarios():
        base = [PY, str(HERE / "run_scenario.py"), "--city", city, "--grow", str(stage),
                "--rain", str(rain), "--wind", str(wind)]
        if phase == "adaptive":
            jobs.append((f"adaptive/{city}_g{stage}_{wname}", base + ["--max-bases", "6"]))
        else:
            for hub_file in sorted((HERE / "hubs").glob(f"{city}_*.json")):
                strategy = hub_file.stem.split("_", 1)[1]
                n = len(json.loads(hub_file.read_text()))
                jobs.append((f"fixed/{strategy}/{city}_g{stage}_{wname}",
                             base + ["--max-bases", str(n), "--hubs", str(hub_file)]))
    print(f"{len(jobs)} runs, {WORKERS} at a time", flush=True)
    with ThreadPoolExecutor(WORKERS) as pool:
        for i, (tag, status) in enumerate(pool.map(job, jobs), 1):
            print(f"[{i}/{len(jobs)}] {tag}: {status}", flush=True)


if __name__ == "__main__":
    main()
