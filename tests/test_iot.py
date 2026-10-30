"""IoT layer: LoRaWAN codec, flood-stage mapping, MQTT broker, bridge, trigger engine, data-rate budget (TC-I01 ... TC-I09)."""
import json
import socket
import time
from types import SimpleNamespace

import pytest

import smartcity_iot as iot

VNS = iot.CITIES["varanasi"]


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for(cond, timeout=5.0):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.05)
    return False


@pytest.fixture(scope="module")
def broker():
    port = free_port()
    iot.start_broker(port)
    return port


def msg(topic, payload):
    return SimpleNamespace(topic=topic, payload=json.dumps(payload).encode())


def test_i01_lorawan_uplink_is_12_bytes_and_round_trips():
    raw = iot.encode_uplink(4, 1793180000, 71.42, 6, 3.71)
    assert len(raw) == 12
    assert iot.decode_uplink(raw) == {"dev": 4, "t": 1793180000, "level_m": 71.42, "rate_cm_h": 6, "batt_v": 3.71}


def test_i02_river_level_maps_to_flood_stage():
    w, d = VNS["warning"], VNS["danger"]
    assert iot.flood_stage(w - 0.5, w, d) == 0
    assert iot.flood_stage(w, w, d) == 0
    assert iot.flood_stage(d, w, d) == 6
    assert iot.flood_stage(d + 1.0, w, d) == 12
    assert iot.flood_stage(d + 3.0, w, d) == 12


def test_i03_mqtt_publish_subscribe_round_trip(broker):
    got = []
    sub = iot.client(broker, "t-sub")
    sub.on_message = lambda c, u, m: got.append((m.topic, m.payload))
    sub.subscribe("sar/#", qos=1)
    time.sleep(0.3)
    iot.client(broker, "t-pub").publish("sar/varanasi/dock/VNS-H1/status", b'{"water_cm":0}', qos=1)
    assert wait_for(lambda: got)
    assert got[0] == ("sar/varanasi/dock/VNS-H1/status", b'{"water_cm":0}')


def test_i04_lorawan_bridge_republishes_decoded_json(broker):
    got = []
    sub = iot.client(broker, "t-bridge-sub")
    sub.on_message = lambda c, u, m: got.append((m.topic, json.loads(m.payload)))
    sub.subscribe("sar/varanasi/gauge/+/level", qos=1)
    iot.lorawan_bridge(broker, "varanasi")
    time.sleep(0.3)
    iot.client(broker, "t-gauge").publish("lorawan/0002/up", iot.encode_uplink(2, 1793180000, 70.9, 5, 3.6), qos=1)
    assert wait_for(lambda: got)
    topic, d = got[0]
    assert topic == "sar/varanasi/gauge/VNS-RG02/level"
    assert d["id"] == "VNS-RG02" and d["level_m"] == 70.9


@pytest.fixture
def engine(broker, tmp_path):
    return iot.TriggerEngine("varanasi", "heavy", broker, tmp_path, n_docks=2, run_planner=False, log=lambda m: None)


def dock(e, i, water):
    e.on_message(None, None, msg(f"sar/varanasi/dock/VNS-H{i}/status",
                                 {"id": f"VNS-H{i}", "site": [i * 100, 100], "water_cm": water, "online": 1}))


def level(e, metres):
    e.on_message(None, None, msg("sar/varanasi/gauge/VNS-RG01/level", {"id": "VNS-RG01", "level_m": metres}))


def test_i05_engine_waits_for_every_dock(engine):
    dock(engine, 1, 0)
    level(engine, VNS["danger"])
    time.sleep(0.3)
    assert engine.plans == []


def test_i06_engine_ignores_levels_below_warning(engine):
    dock(engine, 1, 0), dock(engine, 2, 0)
    level(engine, VNS["warning"] - 0.1)
    time.sleep(0.3)
    assert engine.plans == []


def test_i07_engine_replans_only_when_the_stage_rises(engine):
    dock(engine, 1, 0), dock(engine, 2, 0)
    for metres in (VNS["warning"], VNS["warning"] + 0.1, VNS["danger"], VNS["danger"] + 0.05):
        level(engine, metres)
        assert wait_for(lambda: not engine.busy)
    assert [p["stage"] for p in engine.plans] == [0, 6]


def test_i08_engine_counts_dry_docks_from_status(engine):
    dock(engine, 1, 0), dock(engine, 2, 15)
    level(engine, VNS["danger"])
    assert wait_for(lambda: engine.plans)
    assert engine.dry_docks() == [[100, 100]]
    assert engine.plans[0]["docks_dry"] == 1 and engine.plans[0]["docks_total"] == 2


def test_i09_city_data_rate_budget_under_10_kbit_s():
    import iot_messages as m
    total = sum((len(json.dumps(p, separators=(",", ":")).encode()) + m.MQTT_OVERHEAD) * 8
                * m.RATES[t.rsplit("/", 1)[1]] * m.COUNTS[t.rsplit("/", 1)[1]] for t, p in m.MESSAGES.items())
    assert total / 1000 < 10
