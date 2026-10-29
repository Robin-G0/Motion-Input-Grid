"""Exercise actual ctypes/native ownership, validation, events and optional capture."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "bindings/python"))
sys.path.insert(0, str(ROOT / "examples/python-tkinter/support"))
sys.path.insert(0, str(ROOT / "examples/python-tkinter"))
from mig import Packet, Tracker
from example_usage import synthetic_packet


def run(library):
    profile = (ROOT / "configs/default.json").read_text(encoding="utf-8")
    with Tracker(library, profile) as tracker:
        assert tracker.camera_image() is None
        actions = []
        for sequence in range(1, 91):
            actions.extend(tracker.update(synthetic_packet(sequence)))
        assert [action for action, _ in actions] == ["left_raise"]
        assert tracker.coordinate(15) is not None
        assert tracker.coordinate(15, 1) is None
        assert tracker.hand_coordinate(0, 0) is None
        original = tracker.export_json()
        try:
            tracker.import_json("{}")
            raise AssertionError("Invalid import accepted")
        except RuntimeError:
            pass
        assert tracker.export_json() == original
        for field in ('id', 'name', 'action'):
            invalid = json.loads(profile)
            invalid['inputs'][0][field] = 'visible\0hidden'
            try:
                tracker.import_json(json.dumps(invalid))
            except RuntimeError:
                pass
            else:
                raise AssertionError(f'Embedded NUL accepted in {field}')
            assert tracker.export_json() == original, 'Failed import replaced the profile'
        for keyboard in ([{'keys': [1]}], [{'keys': [17, 17]}],
                         [{'text': 'x' * 16385}], [{'keys': [32]}] * 257,
                         [{'keys': [65, 66, 67, 68]}] * 255 + [{'keys': [65, 66, 67, 68, 69]}]):
            invalid = json.loads(profile)
            invalid['inputs'][0]['keyboard'] = keyboard
            try:
                tracker.import_json(json.dumps(invalid))
            except RuntimeError:
                pass
            else:
                raise AssertionError('Invalid/oversized keyboard import accepted')
            assert tracker.export_json() == original, 'Failed import partially replaced the profile'
        packet = Packet()
        packet.aspect = float("nan")
        try:
            tracker.update(packet)
            raise AssertionError("Invalid frame accepted")
        except RuntimeError:
            pass
        assert tracker.coordinate(15) is None
        tracker.import_json('{"schema_version":2,"inputs":[]}')
        assert json.loads(tracker.export_json())["inputs"] == []
        for _ in range(3):
            try:
                tracker.start_camera(ROOT / "build/missing-runtime")
                raise AssertionError("Missing runtime accepted")
            except RuntimeError:
                pass
            tracker.stop_camera()
    tracker.close()
    try:
        tracker.coordinate(15)
        raise AssertionError("Closed tracker accepted")
    except RuntimeError:
        pass
    print("Python native integration passed")


if __name__ == "__main__":
    run(sys.argv[1])
