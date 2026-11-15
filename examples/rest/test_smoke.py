"""Run both standalone clients against local fake HTTP only: python3 examples/rest/test_smoke.py."""

import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
GLB = struct.pack("<4sII", b"glTF", 2, 12)


class Smoke(unittest.TestCase):
    def run_client(
        self,
        language,
        scenario="happy",
        extra=(),
        resume=False,
        approve=True,
        rerun=False,
    ):
        records = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                self.handle_api()

            def do_GET(self):
                self.handle_api()

            def handle_api(self):
                body = self.rfile.read(int(self.headers.get("content-length", "0")))
                records.append(
                    (self.command, self.path, body, self.headers.get("authorization"))
                )
                if scenario == "timeout":
                    time.sleep(0.3)
                if scenario == "auth":
                    return self.reply(401, {"code": "unauthorized"})
                if self.path == "/api/uploads":
                    return self.reply(201, {"id": "upload1"})
                if self.path == "/api/renders":
                    if scenario == "create_error":
                        return self.reply(503, {"code": "upstream_unavailable"})
                    self.server.created = True
                    return self.reply(201, self.render("drafting"))
                if self.path == "/api/credits":
                    return self.reply(
                        200,
                        {
                            "balance": "100" if scenario == "bad_balance" else 100,
                            "currency": "eur",
                            "render_credits": 8,
                        },
                    )
                if self.path == "/api/renders/r1/render":
                    if scenario == "build_error":
                        return self.reply(503, {"code": "upstream_unavailable"})
                    self.server.built = True
                    return self.reply(200, self.render("rendering"))
                if self.path == "/api/renders/r1":
                    if scenario == "rate" and not getattr(
                        self.server, "limited", False
                    ):
                        self.server.limited = True
                        return self.reply(
                            429, {"code": "rate_limit"}, {"Retry-After": "0"}
                        )
                    status = (
                        "ready"
                        if resume or getattr(self.server, "built", False)
                        else "preview_ready"
                    )
                    if scenario == "failed":
                        status = "failed"
                    if scenario == "unknown":
                        status = "new_unknown_state"
                    if scenario == "stuck":
                        status = "rendering"
                    if scenario == "ready_missing":
                        status = "ready"
                    return self.reply(200, self.render(status))
                if self.path == "/api/renders/r1/model":
                    if scenario == "redirect":
                        return self.reply(
                            302,
                            {},
                            {
                                "Location": self.server.base.replace(
                                    "127.0.0.1", "localhost"
                                )
                                + "/stolen"
                            },
                        )
                    return self.reply(
                        200,
                        b"not a GLB" if scenario == "bad_glb" else GLB,
                        {"Content-Type": "model/gltf-binary"},
                    )
                return self.reply(500, {"code": "unexpected_route"})

            def render(self, status):
                return {
                    "id": "r1",
                    "status": status,
                    "hasModel": status == "ready" and scenario != "ready_missing",
                    "hasSheet": True,
                    "renderCredits": 8,
                    "credits": 8 if status in ["ready", "rendering"] else 2,
                    "links": {"model_glb": "https://untrusted.example/steal"},
                }

            def reply(self, code, value, headers=None):
                data = value if isinstance(value, bytes) else json.dumps(value).encode()
                self.send_response(code)
                for key, val in (headers or {}).items():
                    self.send_header(key, val)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                try:
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            server.base = f"http://127.0.0.1:{server.server_port}"
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            image = base / "photo.png"
            image.write_bytes(b"fake-photo")
            output = base / "model.glb"
            state = base / "job.json"
            receipt = base / "receipt.json"
            command = (
                [shutil.which("python3"), str(ROOT / "render.py")]
                if language == "python"
                else [shutil.which("node"), str(ROOT / "render.ts")]
            )
            command += [
                "--base-url",
                server.base,
                "--allow-local-http",
                "--state",
                str(state),
                "--output",
                str(output),
                "--receipt",
                str(receipt),
                "--poll-seconds",
                "0.01",
                "--timeout-seconds",
                "3",
                "--request-timeout-seconds",
                "0.1",
            ]
            command += (
                ["--render-id", "r1"]
                if resume
                else ["--image", str(image), "--idempotency-key", "stable-preview-key"]
            )
            if approve:
                command += ["--approve-build", "--max-credits", "6"]
            command += list(extra)
            env = {**os.environ, "EASYRENDER_API_KEY": "local-test-key"}
            try:
                result = subprocess.run(
                    command, env=env, capture_output=True, text=True, timeout=8
                )
                if rerun:
                    result = subprocess.run(
                        command, env=env, capture_output=True, text=True, timeout=8
                    )
                content = output.read_bytes() if output.exists() else None
                saved = json.loads(state.read_text()) if state.exists() else {}
                if receipt.exists():
                    saved["_receipt"] = json.loads(receipt.read_text())
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
        self.assertNotIn("local-test-key", result.stdout + result.stderr)
        self.assertNotIn("local-test-key", json.dumps(saved))
        return result, records, content, saved

    def test_full_workflow_and_resume(self):
        for language in ["python", "typescript"]:
            with self.subTest(language=language):
                result, records, content, saved = self.run_client(language)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(content, GLB)
                self.assertEqual(saved["renderId"], "r1")
                self.assertEqual(saved["_receipt"]["timingScope"], "this_invocation")
                self.assertFalse(saved["_receipt"]["isResumed"])
                self.assertEqual(saved["_receipt"]["quotedPendingCredits"], 6)
                builds = [
                    r for r in records if r[0] == "POST" and r[1].endswith("/render")
                ]
                self.assertEqual(len(builds), 1)
                self.assertEqual(json.loads(builds[0][2]), {"maxCredits": 6})
                self.assertTrue(all(r[3] == "Bearer local-test-key" for r in records))
                result, records, content, _ = self.run_client(language, resume=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(any(r[0] == "POST" for r in records))
                self.assertEqual(content, GLB)

    def test_preview_is_default_and_cap_prevents_spend(self):
        for language in ["python", "typescript"]:
            with self.subTest(language=language):
                result, records, _, _ = self.run_client(language, approve=False)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(any(r[1].endswith("/render") for r in records))
                result, records, _, _ = self.run_client(
                    language, extra=["--max-credits", "5"]
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(r[1].endswith("/render") for r in records))

    def test_errors_timeouts_redirects_and_mutations_are_not_retried(self):
        for language in ["python", "typescript"]:
            for scenario in [
                "bad_balance",
                "failed",
                "unknown",
                "auth",
                "timeout",
                "redirect",
                "create_error",
                "build_error",
                "ready_missing",
                "bad_glb",
            ]:
                with self.subTest(language=language, scenario=scenario):
                    result, records, content, _ = self.run_client(language, scenario)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIsNone(content)
                    self.assertFalse(any(r[1] == "/stolen" for r in records))
                    for path in [
                        "/api/uploads",
                        "/api/renders",
                        "/api/renders/r1/render",
                    ]:
                        self.assertLessEqual(
                            sum(r[0] == "POST" and r[1] == path for r in records), 1
                        )

    def test_saved_uncertain_build_is_not_repeated_and_polling_is_bounded(self):
        for language in ["python", "typescript"]:
            result, records, _, saved = self.run_client(
                language, "build_error", rerun=True
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(saved["buildAttempted"])
            self.assertEqual(
                sum(r[0] == "POST" and r[1].endswith("/render") for r in records), 1
            )
            result, records, _, _ = self.run_client(
                language, "stuck", extra=["--timeout-seconds", "0.2"]
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertLess(len(records), 30)

    def test_invalid_ceilings_are_refused_before_requests(self):
        for language in ["python", "typescript"]:
            for value in ["-1", "NaN", "1.5", "9007199254740992"]:
                result, records, _, _ = self.run_client(
                    language, extra=["--max-credits", value]
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(records, [])

    def test_safe_get_rate_limit_recovers(self):
        for language in ["python", "typescript"]:
            result, _, content, _ = self.run_client(language, "rate")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(content, GLB)


if __name__ == "__main__":
    unittest.main()
