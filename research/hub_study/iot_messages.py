"""Message schemas of the proposed IoT layer and their measured sizes.

Each device publishes compact JSON on an MQTT topic; sizes are measured on representative messages
(UTF-8, no whitespace) and turned into a data-rate budget for one city.
"""
import json

MESSAGES = {
    # topic: example payload
    "sar/<city>/drone/<id>/telemetry": {
        "id": "VNS-D3", "t": 1793180000, "lat": 25.31761, "lon": 82.97391, "alt": 100.0, "spd": 5.0,
        "hdg": 271, "bat": 0.64, "kg": 0.75, "sortie": 2, "wp": 118, "state": "ENROUTE"},
    "sar/<city>/drone/<id>/event": {
        "id": "VNS-D3", "t": 1793180042, "ev": "DROP", "drop": 14, "lat": 25.31812, "lon": 82.97120},
    "sar/<city>/dock/<id>/status": {
        "id": "VNS-H2", "t": 1793180000, "water_cm": 0, "batt_ready": 3, "kits": 28, "door": "OPEN",
        "wind_kmh": 18.4, "rain_mmh": 6.2, "online": 1},
    "sar/<city>/gauge/<id>/level": {
        "id": "GNG-RG04", "t": 1793180000, "level_m": 71.42, "rate_cm_h": 6.5, "batt_v": 3.71},
    "sar/<city>/iccc/plan": {
        "plan": "20261028_224737", "trigger": "GNG-RG04>71.26", "docks": 5, "drones": 5, "drops": 28,
        "unreachable": 1, "missions": ["VNS-D1.waypoints", "VNS-D2.waypoints", "VNS-D3.waypoints",
                                       "VNS-D4.waypoints", "VNS-D5.waypoints"]},
}

# publication rates per device (messages per second)
RATES = {"telemetry": 1.0, "event": 1 / 120, "status": 1 / 60, "level": 1 / 300, "plan": 1 / 1800}
# devices per city in the budget: 6 drones, 6 docks, 20 river/rain gauges, one ICCC planner
COUNTS = {"telemetry": 6, "event": 6, "status": 6, "level": 20, "plan": 1}
MQTT_OVERHEAD = 2 + 2 + 40        # fixed header + packet id + typical topic length, bytes


def main():
    rows, total = [], 0.0
    for topic, payload in MESSAGES.items():
        kind = topic.rsplit("/", 1)[1]
        size = len(json.dumps(payload, separators=(",", ":")).encode())
        bps = (size + MQTT_OVERHEAD) * 8 * RATES[kind] * COUNTS[kind]
        total += bps
        rows.append({"topic": topic, "payload_bytes": size, "rate_hz": RATES[kind], "devices": COUNTS[kind],
                     "kbit_s": round(bps / 1000, 3)})
    out = {"messages": rows, "total_kbit_s": round(total / 1000, 2)}
    print(json.dumps(out, indent=1))
    with open(__file__.replace("iot_messages.py", "iot_budget.json"), "w") as f:
        json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
