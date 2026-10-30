"""Run the IoT loop end to end: broker, LoRaWAN bridge, gauges, docks, trigger engine, ICCC listener.

    .venv/bin/python iot/run_iot_demo.py --city varanasi --weather heavy
    .venv/bin/python iot/run_iot_demo.py --city kanpur --no-planner      # fast: triggers only

The river starts 0.3 m below the warning mark and rises; every time the flood stage goes up, the engine
re-plans with the docks that still report dry. Runs stop once the river is 1.25 m above the danger mark.
"""
import argparse
import json
import socket
import threading
import time

import smartcity_iot as iot


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", choices=iot.CITIES, default="varanasi")
    ap.add_argument("--weather", choices=iot.WEATHER, default="heavy")
    ap.add_argument("--rise-cm-h", type=float, default=50.0, help="simulated rate of rise at the reference gauge")
    ap.add_argument("--hours-per-s", type=float, default=0.12, help="simulated hours per real second")
    ap.add_argument("--no-planner", action="store_true", help="publish triggers without running the planner")
    ap.add_argument("--port", type=int, default=0)
    a = ap.parse_args()

    cfg = iot.CITIES[a.city]
    port = a.port or free_port()
    out = iot.HERE / "runs" / f"{a.city}_{time.strftime('%Y%m%d_%H%M%S')}"
    docks = json.loads((iot.STUDY / "hubs" / f"{a.city}_robust6.json").read_text())
    t0 = time.time()
    log = lambda m: print(f"{time.time() - t0:6.1f}s  {m}", flush=True)

    iot.start_broker(port)
    log(f"[broker]  MQTT broker on 127.0.0.1:{port}")
    iot.lorawan_bridge(port, a.city)
    engine = iot.TriggerEngine(a.city, a.weather, port, out, len(docks), run_planner=not a.no_planner, log=log)
    iccc = iot.client(port, f"{cfg['code']}-iccc")
    iccc.on_message = lambda c, u, m: log(f"[iccc]    received {m.topic} ({len(m.payload)} bytes)")
    iccc.subscribe(f"sar/{a.city}/iccc/plan", qos=1)

    world = iot.World(a.city, a.weather, cfg["warning"] - 0.3, a.rise_cm_h, hours_per_s=a.hours_per_s)
    stop = threading.Event()
    threading.Thread(target=iot.run_gauges, args=(world, port), kwargs={"stop": stop}, daemon=True).start()
    threading.Thread(target=iot.run_docks, args=(world, port, docks), kwargs={"stop": stop}, daemon=True).start()
    log(f"[world]   {cfg['gauge']} gauge at {world.level():.2f} m, rising {a.rise_cm_h:g} cm/h "
        f"({a.hours_per_s:g} simulated h per s); {len(docks)} docks; weather {a.weather}")

    while world.level() < cfg["danger"] + 1.25:
        time.sleep(0.5)
    stop.set()
    while engine.busy:                          # let the last re-plan finish
        time.sleep(0.5)
    time.sleep(1.0)
    summary = {"city": a.city, "weather": a.weather, "port": port, "plans": engine.plans,
               "messages_seen": {"gauges": len(engine.levels), "docks": len(engine.docks)}}
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    log(f"[done]    {len(engine.plans)} re-plans; summary in {out.relative_to(iot.ROOT)}/summary.json")


if __name__ == "__main__":
    main()
