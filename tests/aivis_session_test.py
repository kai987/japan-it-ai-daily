import contextlib
import fcntl
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "aivis_session", Path(__file__).resolve().parents[1] / "scripts/aivis-session.py")
session = importlib.util.module_from_spec(spec)
spec.loader.exec_module(session)


class ShutdownTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(session, "screen_locked", return_value=True))
        self.stack.enter_context(patch.object(session, "processes", return_value=[]))
        self.stack.enter_context(patch.object(session, "other_recorders", return_value=[]))
        self.stack.enter_context(patch.object(session, "connections_busy", return_value=False))
        self.stack.enter_context(patch.object(session, "ready", return_value=False))
        self.native = self.stack.enter_context(patch.object(session, "native_quit", return_value={
            "status": "requested", "nativeResult": "quit_requested_and_exited"}))

    def test_locked_screen_still_uses_normal_request_and_verifies_both_exits(self):
        proof = session.shutdown(self.state)
        self.assertEqual(proof["status"], "closed")
        self.assertTrue(proof["screenLocked"])
        self.assertTrue(proof["appExited"] and proof["engineExited"])
        self.assertFalse(proof["forced"])
        self.native.assert_called_once_with(self.state)

    def test_other_recording_process_defers_without_a_quit_request(self):
        with patch.object(session, "other_recorders", return_value=[123]):
            self.assertEqual(session.shutdown(self.state)["reason"], "another_recording_process")
        self.native.assert_not_called()

    def test_existing_engine_connection_defers_without_a_quit_request(self):
        with patch.object(session, "connections_busy", return_value=True), \
                patch.object(session.time, "monotonic", side_effect=[0, 9]):
            self.assertEqual(session.shutdown(self.state)["reason"], "engine_connections_active")
        self.native.assert_not_called()

    def test_transient_keepalive_is_allowed_to_close_before_normal_quit(self):
        with patch.object(session, "connections_busy", side_effect=[True, False]), \
                patch.object(session.time, "sleep"):
            self.assertEqual(session.shutdown(self.state)["status"], "closed")
        self.native.assert_called_once()

    def test_unreadable_connection_state_never_means_idle(self):
        with patch.object(session, "connections_busy", side_effect=RuntimeError("inspection failed")):
            self.assertEqual(session.shutdown(self.state)["reason"], "shutdown_inspection_failed")
        self.native.assert_not_called()

    def test_app_confirmation_is_retained_and_never_forced(self):
        self.native.return_value = {"status": "deferred", "reason": "awaiting_app_confirmation"}
        proof = session.shutdown(self.state)
        self.assertEqual(proof["reason"], "awaiting_app_confirmation")
        self.assertFalse(proof["appExited"] or proof["engineExited"] or proof["forced"])

    def test_responding_engine_prevents_false_completion_after_app_exit(self):
        with patch.object(session, "ready", return_value=True), \
                patch.object(session.time, "monotonic", side_effect=[0, 1, 2, 18]), \
                patch.object(session.time, "sleep"):
            proof = session.shutdown(self.state)
        self.assertEqual(proof["reason"], "app_or_engine_still_running")
        self.assertFalse(proof["engineExited"])


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)

    def test_another_batch_os_lock_prevents_start_or_shutdown(self):
        with open(self.state / "recording.lock", "a+") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with patch.object(session, "start_engine") as start, \
                    patch.object(session, "shutdown") as stop, \
                    contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(session.session([["unused"]], self.state), 75)
            start.assert_not_called()
            stop.assert_not_called()

    def test_lock_remains_held_through_batch_and_normal_shutdown(self):
        def assert_locked(*_):
            with open(self.state / "recording.lock", "a+") as other:
                with self.assertRaises(BlockingIOError):
                    fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return 0
        def closed(_):
            assert_locked()
            return {"status": "closed", "appExited": True, "engineExited": True}
        with patch.object(session.sys, "platform", "darwin"), \
                patch.object(session, "start_engine"), \
                patch.object(session, "execute", side_effect=assert_locked), \
                patch.object(session, "shutdown", side_effect=closed), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(session.session([["unused"]], self.state), 0)
        self.assertEqual(json.loads((self.state / "last-shutdown.json").read_text())["status"], "closed")

    def test_failed_completed_batch_preserves_exit_and_records_cleanup(self):
        with patch.object(session.sys, "platform", "darwin"), \
                patch.object(session, "start_engine"), \
                patch.object(session, "execute", return_value=7), \
                patch.object(session, "shutdown", return_value={"status": "closed"}) as stop, \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(session.session([["unused"]], self.state), 7)
        stop.assert_called_once()

    def test_interrupted_batch_does_not_quit_potentially_active_synthesis(self):
        with patch.object(session.sys, "platform", "darwin"), \
                patch.object(session, "start_engine"), \
                patch.object(session, "execute", side_effect=KeyboardInterrupt), \
                patch.object(session, "shutdown") as stop, \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt):
                session.session([["unused"]], self.state)
        stop.assert_not_called()
        self.assertEqual(json.loads((self.state / "last-shutdown.json").read_text())["status"], "deferred")

    def test_ancestors_are_not_mistaken_for_another_recording_job(self):
        rows = [(10, 9, "python aivis-session.py"), (9, 1, "node audio-worker.ts"),
                (20, 1, "node generate-japanese-audio.mjs")]
        with patch.object(session.os, "getpid", return_value=10), \
                patch.object(session.os, "getppid", return_value=9):
            self.assertEqual(session.other_recorders(rows), [20])

    def test_batch_commands_run_in_order_and_stop_on_failure(self):
        with patch.object(session.subprocess, "run") as run:
            run.side_effect = [type("Result", (), {"returncode": 0})(),
                               type("Result", (), {"returncode": 4})()]
            self.assertEqual(session.execute([["first"], ["second"], ["third"]]), 4)
            self.assertEqual([call.args[0] for call in run.call_args_list], [["first"], ["second"]])

    def test_synthesis_child_inherits_the_kernel_lock_descriptor(self):
        path = self.state / "inherited.lock"
        with open(path, "a+") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code = "import os,sys;assert os.fstat(int(sys.argv[1])).st_ino==os.stat(sys.argv[2]).st_ino"
            self.assertEqual(session.execute([[sys.executable, "-c", code, str(held.fileno()), str(path)]], held.fileno()), 0)


if __name__ == "__main__":
    unittest.main()
