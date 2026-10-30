"""IoT layer for Smart Aerial Response: sensors -> LoRaWAN/MQTT -> trigger engine -> swarm re-plan.

A software-in-the-loop version of the five-layer architecture in the report and paper:

  Perception   GaugeSim (river-level gauges) and DockSim (drone docks) driven by a simulated flood hydrograph
  Network      gauges send packed 12-byte LoRaWAN uplinks (lorawan/<dev>/up); docks publish JSON over MQTT
  Middleware   an MQTT broker (amqtt, in-process) and a LoRaWAN codec that turns uplinks into JSON topics
  Decision     TriggerEngine: gauge level over the warning mark rising -> new flood stage -> re-plan the swarm
               with the unmodified planner, bases restricted to docks that report dry
  Application  plan summaries on sar/<city>/iccc/plan for the ICCC dashboard

Thresholds are the Central Water Commission marks for each city's reference gauge. How a river level becomes a
flood stage (how far the mapped water spreads) is an assumption of this simulation, not a hydraulic model.
"""
import asyncio
import json
import struct
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import paho.mqtt.client as mqtt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
STUDY = ROOT / "research" / "hub_study"
PLANNER_PY = str(ROOT / ".venv" / "bin" / "python") if (ROOT / ".venv" / "bin" / "python").exists() else sys.executable

CITIES = {
    # CWC reference gauges: Varanasi at Rajghat, Kanpur at the Ganga Barrage (metres above mean sea level)
    "varanasi": {"code": "VNS", "gauge": "Rajghat", "warning": 70.262, "danger": 71.262},
    "kanpur": {"code": "KNP", "gauge": "Ganga Barrage", "warning": 114.0, "danger": 115.0},
}
WEATHER = {"calm": (0.0, 0.0), "moderate": (3.0, 12.0), "heavy": (10.0, 30.0)}     # rain mm/h, wind km/h
STAGES = (0, 3, 6, 9, 12)                       # flood mask growth (display px) the dock study has data for
UPLINK = struct.Struct(">HIHhH")               # dev id, unix time, level cm, rate cm/h, battery mV: 12 bytes


def flood_stage(level_m, warning, danger):
    """River level -> flood stage: warning mark = stage 0, danger mark = 6, one metre above danger = 12."""
    raw = 6.0 * (level_m - warning) / (danger - warning)
    return max(s for s in STAGES if s <= max(0.0, raw))


# ---------------------------------------------------------------- network: LoRaWAN codec
def encode_uplink(dev, t, level_m, rate_cm_h, battery_v):
    return UPLINK.pack(dev, int(t), round(level_m * 100), round(rate_cm_h), round(battery_v * 1000))


def decode_uplink(payload):
    dev, t, level_cm, rate, mv = UPLINK.unpack(payload)
    return {"dev": dev, "t": t, "level_m": level_cm / 100, "rate_cm_h": rate, "batt_v": mv / 1000}


# ---------------------------------------------------------------- middleware: broker
def start_broker(port):
    """Run an amqtt broker on 127.0.0.1:port in a daemon thread; returns once it accepts connections."""
    from amqtt.broker import Broker
    loop = asyncio.new_event_loop()
    ready = threading.Event()

    def run():
        asyncio.set_event_loop(loop)
        broker = Broker({"listeners": {"default": {"type": "tcp", "bind": f"127.0.0.1:{port}"}}}, loop=loop)
        loop.run_until_complete(broker.start())
        ready.set()
        loop.run_forever()

    threading.Thread(target=run, daemon=True, name="mqtt-broker").start()
    if not ready.wait(10):
        raise RuntimeError("MQTT broker did not start")
    return loop


def client(port, name):
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=name)
    c.connect("127.0.0.1", port)
    c.loop_start()
    return c


def lorawan_bridge(port, city):
    """Network-server role: decode gauge uplinks and republish them as JSON on the city's gauge topics."""
    code = CITIES[city]["code"]
    c = client(port, f"{code}-lns")

    def on_message(cl, userdata, msg):
        d = decode_uplink(msg.payload)
        gid = f"{code}-RG{d['dev']:02d}"
        cl.publish(f"sar/{city}/gauge/{gid}/level", json.dumps({"id": gid, **d}), qos=1)

    c.on_message = on_message
    c.subscribe("lorawan/+/up", qos=1)
    return c


# ---------------------------------------------------------------- perception: simulated devices
@dataclass
class World:
    """Ground truth of the simulation: the river level at the reference gauge over simulated time."""
    city: str
    weather: str
    start_m: float
    rise_cm_h: float
    t0: float = field(default_factory=time.time)
    hours_per_s: float = 0.5                    # simulated hours per real second

    def hours(self):
        return (time.time() - self.t0) * self.hours_per_s

    def level(self, offset_m=0.0):
        return self.start_m + offset_m + self.rise_cm_h / 100 * self.hours()

    def stage(self):
        c = CITIES[self.city]
        return flood_stage(self.level(), c["warning"], c["danger"])


def run_gauges(world, port, n=4, period_s=0.5, stop=None):
    """River gauges along the reach; gauge 1 is the CWC reference, the others read a little lower."""
    c = client(port, f"{CITIES[world.city]['code']}-gauges")
    while not stop.is_set():
        for dev in range(1, n + 1):
            level = world.level(-0.04 * (dev - 1))
            c.publish(f"lorawan/{dev:04x}/up", encode_uplink(dev, time.time(), level, world.rise_cm_h, 3.7), qos=1)
        stop.wait(period_s)
    c.disconnect()


def run_docks(world, port, docks, period_s=1.0, stop=None):
    """Dock controllers: report water at the pad when the dock site is not usable at the current flood stage."""
    avail = json.loads((STUDY / "availability.json").read_text())[world.city]
    code = CITIES[world.city]["code"]
    c = client(port, f"{code}-docks")
    rain, wind = WEATHER[world.weather]
    while not stop.is_set():
        usable = {tuple(p) for p in avail[f"g{world.stage()}_{world.weather}"]}
        for i, site in enumerate(docks, 1):
            dry = tuple(site) in usable
            c.publish(f"sar/{world.city}/dock/{code}-H{i}/status", json.dumps({
                "id": f"{code}-H{i}", "t": int(time.time()), "site": list(site), "water_cm": 0 if dry else 15,
                "batt_ready": 3, "kits": 28, "wind_kmh": wind, "rain_mmh": rain, "online": 1}), qos=1)
        stop.wait(period_s)
    c.disconnect()


# ---------------------------------------------------------------- decision: trigger engine
class TriggerEngine:
    """Subscribes to gauges and docks; re-plans the swarm whenever the flood stage rises."""

    def __init__(self, city, weather, port, out_dir, n_docks, run_planner=True, log=print):
        self.city, self.weather, self.port, self.out = city, weather, port, Path(out_dir)
        self.n_docks = n_docks
        self.cfg, self.run_planner, self.log = CITIES[city], run_planner, log
        self.levels, self.docks = {}, {}
        self.stage, self.pending, self.busy = None, None, False
        self.plans, self.lock = [], threading.Lock()
        self.out.mkdir(parents=True, exist_ok=True)
        self.c = client(port, f"{self.cfg['code']}-trigger")
        self.c.on_message = self.on_message
        self.c.subscribe(f"sar/{city}/gauge/+/level", qos=1)
        self.c.subscribe(f"sar/{city}/dock/+/status", qos=1)

    def on_message(self, cl, userdata, msg):
        d = json.loads(msg.payload)
        if "/dock/" in msg.topic:
            self.docks[d["id"]] = d
            return
        self.levels[d["id"]] = d
        ref = self.levels.get(f"{self.cfg['code']}-RG01")
        # act only once every dock has reported and the reference gauge is at or above the warning mark
        if not ref or len(self.docks) < self.n_docks or ref["level_m"] < self.cfg["warning"]:
            return
        stage = flood_stage(ref["level_m"], self.cfg["warning"], self.cfg["danger"])
        with self.lock:
            if self.stage is None or stage > self.stage:
                reason = (f"{ref['id']} {ref['level_m']:.2f} m (warning {self.cfg['warning']}, danger "
                          f"{self.cfg['danger']}) -> flood stage {stage}")
                self.stage = stage
                self.pending = {"stage": stage, "reason": reason, "t": time.time()}
                if not self.busy:
                    self.busy = True
                    threading.Thread(target=self.worker, daemon=True).start()

    def dry_docks(self):
        return [d["site"] for d in sorted(self.docks.values(), key=lambda d: d["id"]) if d["online"] and d["water_cm"] == 0]

    def worker(self):
        while True:
            with self.lock:
                job, self.pending = self.pending, None
                if job is None:
                    self.busy = False
                    return
            self.replan(job)

    def replan(self, job):
        docks = self.dry_docks()
        n = len(self.plans) + 1
        self.log(f"[trigger] {job['reason']}; {len(docks)} of {len(self.docks)} docks dry -> re-plan #{n}")
        rec = {"n": n, "stage": job["stage"], "reason": job["reason"], "docks_dry": len(docks),
               "docks_total": len(self.docks)}
        if self.run_planner and docks:
            hubs = self.out / f"dry_docks_{n}.json"
            hubs.write_text(json.dumps(docks))
            rain, wind = WEATHER[self.weather]
            run_dir = self.out / f"plan_{n}"
            cmd = [PLANNER_PY, str(STUDY / "run_scenario.py"), "--city", self.city, "--grow", str(job["stage"]),
                   "--rain", str(rain), "--wind", str(wind), "--max-bases", "6", "--hubs", str(hubs),
                   "--out", str(run_dir)]
            subprocess.run(cmd, capture_output=True, text=True)
            res = json.loads((run_dir / "result.json").read_text()) if (run_dir / "result.json").exists() else {}
            rec.update({"exit_code": res.get("exit_code"), "drop_points": res.get("drop_points"),
                        "served": res.get("visited"), "bases": len(res.get("bases") or []),
                        "planner_s": res.get("wall_s")})
        rec["trigger_to_plan_s"] = round(time.time() - job["t"], 1)
        self.plans.append(rec)
        self.c.publish(f"sar/{self.city}/iccc/plan", json.dumps(rec), qos=1)
        with open(self.out / "plans.jsonl", "a") as f:
            f.write(json.dumps(rec) + "\n")
        self.log(f"[plan]    #{n}: " + ", ".join(f"{k}={v}" for k, v in rec.items() if k not in ("n", "reason")))
