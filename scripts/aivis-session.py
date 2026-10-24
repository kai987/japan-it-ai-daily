"""Serialize local recording batches and request ordinary background app shutdown.

Both repositories use this same OS lock. Credentials, source text and recordings
are never stored here. A save confirmation or busy engine is retained as pending.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import time
import urllib.error
import urllib.request

ENGINE = "http://127.0.0.1:10101"
STATE = Path.home() / "Library/Application Support/AivisSpeech Automation"
PREFIX = "AIVIS_LIFECYCLE_JSON="
RECORDERS = ("generate-audio.py", "generate-japanese-audio.mjs",
             "generate-interview-audio.mjs", "audio-worker.ts", "repair-audio.ts")


def ready():
    try:
        with urllib.request.urlopen(ENGINE + "/version", timeout=3) as response:
            return response.status == 200
    except urllib.error.URLError:
        return False


def start_engine():
    if ready():
        return
    subprocess.run(["open", "-g", "-a", "AivisSpeech"], check=True, timeout=15)
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if ready():
            return
        time.sleep(2)
    raise RuntimeError("AivisSpeech engine did not become ready")


def processes():
    output = subprocess.check_output(["ps", "-axo", "pid=,ppid=,args="], text=True, timeout=5)
    rows = []
    for line in output.splitlines():
        fields = line.split(None, 2)
        if len(fields) == 3:
            rows.append((int(fields[0]), int(fields[1]), fields[2]))
    return rows


def other_recorders(rows):
    parents = {pid: parent for pid, parent, _ in rows}
    own = {os.getpid()}
    parent = os.getppid()
    while parent > 1 and parent not in own:
        own.add(parent)
        parent = parents.get(parent, 0)
    return [pid for pid, _, args in rows if pid not in own
            and any(name in args for name in RECORDERS)
            and args.startswith(("/", "node ", "python"))]


def connections_busy():
    result = subprocess.run(["lsof", "-nP", "-iTCP:10101", "-sTCP:ESTABLISHED", "-Fp"],
                            capture_output=True, text=True, timeout=5)
    if result.returncode not in (0, 1) or result.stderr.strip():
        raise RuntimeError("Unable to inspect engine connections")
    return bool(result.stdout.strip())


def screen_locked():
    try:
        data = plistlib.loads(subprocess.check_output(
            ["/usr/sbin/ioreg", "-a", "-n", "Root", "-d", "1"], timeout=5))
        value = data.get("IOConsoleLocked") if isinstance(data, dict) else None
        return value if isinstance(value, bool) else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def native_quit(state):
    source = Path(__file__).with_name("quit-aivisspeech.swift")
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    binary = state / "bin" / ("quit-aivisspeech-" + digest)
    if not binary.exists():
        binary.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = binary.with_suffix(".partial")
        try:
            subprocess.run(["xcrun", "swiftc", "-O", str(source), "-o", str(temporary)],
                           check=True, capture_output=True, timeout=60)
            temporary.chmod(0o700)
            temporary.replace(binary)
        finally:
            temporary.unlink(missing_ok=True)
    # Compilation may have taken time. Reinspect before sending the request.
    if other_recorders(processes()) or connections_busy():
        return {"status": "deferred", "reason": "recording_started_before_quit"}
    result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=20)
    value = json.loads(result.stdout)
    if result.returncode != 0:
        return {"status": "deferred", "reason": value["status"]}
    return {"status": "requested", "nativeResult": value["status"]}


def core_processes(rows):
    return [pid for pid, _, args in rows if args.startswith((
        "/Applications/AivisSpeech.app/Contents/MacOS/AivisSpeech",
        "/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/"))]


def shutdown(state):
    proof = {"status": "deferred", "appExited": False, "engineExited": False,
             "screenLocked": screen_locked(), "forced": False}
    try:
        if other_recorders(processes()):
            return {**proof, "reason": "another_recording_process"}
        # Freshly finished clients and the app's startup probes can retain idle
        # HTTP connections briefly. Wait boundedly, without terminating them.
        idle_deadline = time.monotonic() + 8
        while connections_busy():
            if time.monotonic() >= idle_deadline:
                return {**proof, "reason": "engine_connections_active"}
            if other_recorders(processes()):
                return {**proof, "reason": "another_recording_process"}
            time.sleep(0.25)
        result = native_quit(state)
        if result["status"] != "requested":
            return {**proof, **result}
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if not core_processes(processes()) and not ready():
                return {**proof, "status": "closed", "appExited": True,
                        "engineExited": True, "nativeResult": result["nativeResult"]}
            time.sleep(0.2)
        return {**proof, "reason": "app_or_engine_still_running"}
    except (OSError, subprocess.SubprocessError, RuntimeError, ValueError) as error:
        return {**proof, "reason": "shutdown_inspection_failed", "errorType": type(error).__name__}


def save_proof(state, proof):
    proof = {**proof, "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    temporary = state / "last-shutdown.partial.json"
    with open(temporary, "w", encoding="utf-8") as stream:
        os.chmod(temporary, 0o600)
        json.dump(proof, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(state / "last-shutdown.json")
    print(PREFIX + json.dumps(proof, ensure_ascii=False), flush=True)


def execute(commands, inherited_fd=None):
    for command in commands:
        # Keep the kernel lock alive in synthesis if its wrapper is interrupted.
        result = subprocess.run(command, check=False,
                                pass_fds=() if inherited_fd is None else (inherited_fd,))
        if result.returncode:
            return result.returncode if result.returncode > 0 else 128 - result.returncode
    return 0


def session(commands, state=STATE):
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(state / "recording.lock", "a+") as lock:
        os.chmod(state / "recording.lock", 0o600)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(PREFIX + json.dumps({"status": "busy", "reason": "another_recording_batch"}), flush=True)
            return 75
        if sys.platform != "darwin":
            # Preserve existing non-macOS engine setup; AppKit is macOS-only.
            return execute(commands, lock.fileno())
        child_finished = False
        try:
            if commands:
                start_engine()
            code = execute(commands, lock.fileno())
            child_finished = True
            return code
        finally:
            proof = shutdown(state) if child_finished else {
                "status": "deferred", "reason": "batch_interrupted_or_startup_failed",
                "appExited": False, "engineExited": False, "forced": False}
            save_proof(state, proof)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commands-json")
    parser.add_argument("--quit-only", action="store_true")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if sum([bool(args.commands_json), args.quit_only, bool(args.command)]) != 1:
        parser.error("Choose --commands-json, --quit-only, or -- COMMAND ARGS")
    if args.commands_json:
        commands = json.loads(args.commands_json)
    elif args.quit_only:
        commands = []
    else:
        command = args.command[1:] if args.command[0] == "--" else args.command
        commands = [command]
    if not isinstance(commands, list) or (not commands and not args.quit_only) or any(
        not isinstance(c, list) or not c or any(not isinstance(a, str) or not a or "\0" in a for a in c)
        for c in commands):
        parser.error("Commands must be nonempty argument arrays")
    return session(commands)


if __name__ == "__main__":
    raise SystemExit(main())
