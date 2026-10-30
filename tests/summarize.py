"""Turn tests/results/junit.xml into tests/results/summary.json for the report's testing chapter."""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
# test-case id -> (what is checked, expected result)
CASES = {
    "u01": ("Battery use per leg", "grows linearly with distance, more with payload and headwind; zero for zero distance"),
    "u02": ("Wind unit conversion", "36 km/h = 10 m/s; negative input clamps to 0"),
    "u03": ("Headwind component", "full headwind when wind blows from the heading, none from behind"),
    "u04": ("Payload sortie split", "5 kits at 0.25 kg with 0.5 kg capacity -> 3 sorties"),
    "u05": ("Tour construction", "tour starts and ends at the base and visits every drop once"),
    "u06": ("Route crossing detector", "crossing paths give one point, parallel paths none"),
    "u07": ("Pixel to latitude/longitude", "centre maps to centre; 100 m north = +0.0009 deg; bad scale rejected"),
    "u08": ("Weather input sanitising", "missing field becomes 0 and status becomes partial"),
    "u09": ("Mission file export", "generated QGC WPL 110 file validates; corrupted header is caught"),
    "u10": ("D* Lite routing around water", "route crosses no flooded pixel and detours around the river"),
    "u11": ("Flood segmentation (Varanasi)", "3-40% of the map detected as water"),
    "u12": ("Weather-driven flood spread", "heavy rain spreads further than calm; forecast never recedes"),
    "i01": ("LoRaWAN uplink codec", "12-byte packed payload round-trips exactly"),
    "i02": ("River level to flood stage", "warning -> 0, danger -> 6, danger + 1 m -> 12"),
    "i03": ("MQTT broker round trip", "subscriber receives the published dock status unchanged"),
    "i04": ("LoRaWAN-to-MQTT bridge", "uplink republished as JSON on sar/varanasi/gauge/VNS-RG02/level"),
    "i05": ("Trigger waits for all docks", "no re-plan until every dock has reported"),
    "i06": ("Trigger ignores normal levels", "no re-plan below the warning mark"),
    "i07": ("Trigger fires on stage rise only", "re-plans at stages 0 and 6, not for small rises within a stage"),
    "i08": ("Dry-dock selection", "flooded dock excluded; plan records 1 of 2 docks dry"),
    "i09": ("City IoT data-rate budget", "under 10 kbit/s for 6 drones, 6 docks, 20 gauges"),
    "s01": ("Dock sites shrink as water rises", "usable sites at each stage are a subset of the previous stage"),
    "s02": ("Robust dock separation", "6 docks, every pair at least the planner's base separation apart"),
    "s03": ("Robust docks on unseen stages", "coverage on held-out stages beats event-sited and uniform docks"),
    "s04": ("Study completeness", "all 180 planner runs present with exit code 0"),
    "t01": ("Server health check", "planner_ready is true"),
    "t02": ("Live plan via dashboard API", "Varanasi heavy run streams to done; drones > 0; 0 route crossings"),
    "t03": ("Input validation", "unknown city rejected with a fail event"),
}


def main():
    root = ET.parse(HERE / "results" / "junit.xml").getroot()
    suite = root if root.tag == "testsuite" else root.find("testsuite")
    cases = []
    for tc in suite.iter("testcase"):
        name = tc.get("name")
        key = re.match(r"test_([a-z]\d\d)", name).group(1)
        what, expected = CASES[key]
        status = "fail" if tc.find("failure") is not None or tc.find("error") is not None else \
                 "skipped" if tc.find("skipped") is not None else "pass"
        cases.append({"id": f"TC-{key[0].upper()}{key[1:]}", "name": name, "module": tc.get("classname"),
                      "what": what, "expected": expected, "status": status, "duration_s": round(float(tc.get("time")), 2)})
    out = {"total": len(cases), "passed": sum(c["status"] == "pass" for c in cases),
           "failed": sum(c["status"] == "fail" for c in cases), "skipped": sum(c["status"] == "skipped" for c in cases),
           "duration_s": round(float(suite.get("time")), 1), "run_at": suite.get("timestamp"), "cases": cases}
    (HERE / "results" / "summary.json").write_text(json.dumps(out, indent=1))
    print({k: out[k] for k in ("total", "passed", "failed", "skipped", "duration_s")})


if __name__ == "__main__":
    main()
