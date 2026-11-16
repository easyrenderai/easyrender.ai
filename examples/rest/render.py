#!/usr/bin/env python3
"""Dependency-free REST workflow. See README.md; never place API keys in this file."""
import argparse
import hashlib
import http.client
import json
import math
import os
from pathlib import Path
import queue
import re
import secrets
import struct
import threading
import time
from urllib.parse import quote, urlsplit

MAX_IMAGE = 4 * 1024 * 1024
MAX_MODEL = 128 * 1024 * 1024


class WorkflowError(Exception):
    pass


def integer(value, name):
    if type(value) is not int or value < 0 or value > 9007199254740991:
        raise WorkflowError(name + " must be a non-negative safe integer")
    return value


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", value):
        raise WorkflowError("Invalid resource identifier")
    return value


def save(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + ".tmp-" + secrets.token_hex(6))
    try:
        with open(temporary, "x", encoding="utf-8") as target:
            os.chmod(temporary, 0o600)
            json.dump(value, target, allow_nan=False)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://easyrender.ai")
    parser.add_argument("--allow-local-http", action="store_true")
    parser.add_argument(
        "--state", required=True, help="Private local checkpoint; reuse to resume"
    )
    parser.add_argument("--image")
    parser.add_argument("--idempotency-key")
    parser.add_argument("--render-id")
    parser.add_argument("--approve-build", action="store_true")
    parser.add_argument("--max-credits", type=int)
    parser.add_argument("--output", default="model.glb")
    parser.add_argument("--receipt")
    parser.add_argument("--poll-seconds", type=float, default=5)
    parser.add_argument("--timeout-seconds", type=float, default=600)
    parser.add_argument("--request-timeout-seconds", type=float, default=30)
    return parser.parse_args()


def run(args):
    started = time.monotonic()
    for field in ["poll_seconds", "timeout_seconds", "request_timeout_seconds"]:
        value = getattr(args, field)
        if not math.isfinite(value) or value <= 0:
            raise WorkflowError(field + " must be finite and positive")
    if args.max_credits is not None:
        integer(args.max_credits, "max-credits")
    if args.approve_build and args.max_credits is None:
        raise WorkflowError(
            "--approve-build requires an explicit --max-credits ceiling"
        )
    paths = [Path(args.state).resolve(), Path(args.output).resolve()]
    if args.receipt:
        paths.append(Path(args.receipt).resolve())
    if len(set(paths)) != len(paths):
        raise WorkflowError("Checkpoint, output and receipt paths must differ")
    if Path(args.output).exists() or (args.receipt and Path(args.receipt).exists()):
        raise WorkflowError(
            "Output or receipt already exists; choose a new path before starting"
        )
    endpoint = urlsplit(args.base_url)
    if (
        endpoint.username
        or endpoint.password
        or endpoint.query
        or endpoint.fragment
        or endpoint.path not in ["", "/"]
        or not endpoint.hostname
    ):
        raise WorkflowError(
            "base-url must be a trusted API origin, without credentials or a path"
        )
    if endpoint.scheme != "https" and not (
        args.allow_local_http
        and endpoint.scheme == "http"
        and endpoint.hostname in ["127.0.0.1", "localhost", "::1"]
    ):
        raise WorkflowError("HTTPS required; local HTTP requires --allow-local-http")
    origin = args.base_url.rstrip("/")
    token = os.environ.get("EASYRENDER_API_KEY", "")
    if not token or any(ord(c) <= 32 or ord(c) >= 127 for c in token):
        raise WorkflowError("Set EASYRENDER_API_KEY in the environment")
    deadline = started + args.timeout_seconds

    def remaining():
        value = deadline - time.monotonic()
        if value <= 0:
            raise WorkflowError("Workflow timeout; resume the saved render ID")
        return value

    def pause(seconds):
        if seconds >= remaining():
            raise WorkflowError(
                "Retry/poll delay exceeds workflow deadline; resume later"
            )
        time.sleep(seconds)

    def request(method, path, body=None, content_type=None, headers=None, model=False):
        if not path.startswith("/api/") or path.startswith("//"):
            raise WorkflowError("Refusing an untrusted API path")
        for attempt in range(3):
            timeout = min(args.request_timeout_seconds, remaining())
            result = queue.Queue(maxsize=1)

            # A daemon bounds the entire operation, including a server trickling response bytes.
            # It never writes files or retries mutations; only the main thread persists results.
            def perform():
                connection = None
                try:
                    connection_type = (
                        http.client.HTTPSConnection
                        if endpoint.scheme == "https"
                        else http.client.HTTPConnection
                    )
                    connection = connection_type(
                        endpoint.hostname, endpoint.port, timeout=timeout
                    )
                    outgoing = {
                        "Authorization": "Bearer " + token,
                        "Accept": "model/gltf-binary" if model else "application/json",
                        **(headers or {}),
                    }
                    if content_type:
                        outgoing["Content-Type"] = content_type
                    connection.request(method, path, body=body, headers=outgoing)
                    response = connection.getresponse()
                    chunks = bytearray()
                    limit = MAX_MODEL if model else 1024 * 1024
                    while True:
                        chunk = response.read1(64 * 1024)
                        if not chunk:
                            break
                        chunks.extend(chunk)
                        if len(chunks) > limit:
                            raise WorkflowError("Response exceeded the size limit")
                    result.put(
                        (response.status, dict(response.getheaders()), bytes(chunks))
                    )
                except Exception:
                    result.put(None)
                finally:
                    if connection:
                        connection.close()

            threading.Thread(target=perform, daemon=True).start()
            try:
                received = result.get(timeout=timeout)
            except queue.Empty:
                received = None
            if received is None:
                raise WorkflowError(
                    "Request failed or timed out; no mutation was retried. Resume the saved ID"
                )
            status, response_headers, data = received
            if 300 <= status < 400:
                raise WorkflowError("Redirect refused; credentials are never forwarded")
            if method == "GET" and status in [429, 502, 503, 504] and attempt < 2:
                retry = next(
                    (
                        v
                        for k, v in response_headers.items()
                        if k.lower() == "retry-after"
                    ),
                    str(2**attempt),
                )
                try:
                    delay = float(retry)
                except ValueError:
                    raise WorkflowError("Non-numeric Retry-After; stop and retry later")
                if not math.isfinite(delay) or delay < 0:
                    raise WorkflowError("Invalid Retry-After")
                pause(delay)
                continue
            if not 200 <= status < 300:
                correlation = next(
                    (
                        v
                        for k, v in response_headers.items()
                        if k.lower() == "x-request-id"
                    ),
                    "",
                )
                suffix = (
                    " (request_id=" + correlation + ")"
                    if re.fullmatch(r"[0-9a-fA-F-]{36}", correlation)
                    else ""
                )
                raise WorkflowError(
                    f"HTTP {status}{suffix}; inspect the saved job before retrying any mutation"
                )
            if model:
                content = next(
                    (
                        v
                        for k, v in response_headers.items()
                        if k.lower() == "content-type"
                    ),
                    "",
                )
                if content.split(";")[0].lower() != "model/gltf-binary":
                    raise WorkflowError("Expected a GLB response")
                return data
            try:
                value = json.loads(
                    data, parse_constant=lambda _: (_ for _ in ()).throw(ValueError())
                )
            except (ValueError, UnicodeError):
                raise WorkflowError("Invalid JSON response") from None
            if not isinstance(value, dict):
                raise WorkflowError("Expected a JSON object")
            return value
        raise WorkflowError("Read retry limit reached")

    def post(path, value, headers=None):
        return request(
            "POST", path, json.dumps(value).encode(), "application/json", headers
        )

    state_path = Path(args.state)
    lock_path = state_path.with_name(state_path.name + ".lock")
    try:
        lock = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise WorkflowError(
            "Checkpoint locked by another run; inspect before removing a stale .lock"
        ) from None
    os.close(lock)
    try:
        is_resumed = state_path.exists() or args.render_id is not None
        state = (
            json.loads(state_path.read_text())
            if state_path.exists()
            else {"version": 1, "origin": origin}
        )
        if (
            not isinstance(state, dict)
            or state.get("version") != 1
            or state.get("origin") != origin
        ):
            raise WorkflowError("Checkpoint belongs to another API origin or format")
        if args.render_id:
            if state.get("renderId") and state["renderId"] != args.render_id:
                raise WorkflowError("Render ID differs from checkpoint")
            state["renderId"] = identifier(args.render_id)
        if not state.get("renderId"):
            key = args.idempotency_key or state.get("idempotencyKey")
            if not isinstance(key, str) or not re.fullmatch(r"[!-~]{1,128}", key):
                raise WorkflowError(
                    "A stable --idempotency-key is required for one preview"
                )
            if state.get("idempotencyKey") and state["idempotencyKey"] != key:
                raise WorkflowError("Do not change a checkpoint idempotency key")
            if not args.image:
                raise WorkflowError("--image is required until a render ID is saved")
            photo = Path(args.image)
            mime = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
            }.get(photo.suffix.lower())
            if not mime or not 0 < photo.stat().st_size <= MAX_IMAGE:
                raise WorkflowError("Use one JPEG, PNG or WebP photo of at most 4 MiB")
            data = photo.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if state.get("imageSha256") and state["imageSha256"] != digest:
                raise WorkflowError(
                    "Photo differs from the checkpoint; do not reuse its creation key"
                )
            state.update(idempotencyKey=key, imageSha256=digest)
            save(state_path, state)
            if not state.get("uploadId"):
                boundary = "easyrender-" + secrets.token_hex(16)
                body = (
                    f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="photo{photo.suffix.lower()}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
                    + data
                    + f"\r\n--{boundary}--\r\n".encode()
                )
                state["uploadId"] = identifier(
                    request(
                        "POST",
                        "/api/uploads",
                        body,
                        "multipart/form-data; boundary=" + boundary,
                    )["id"]
                )
                save(state_path, state)
            preview = post(
                "/api/renders",
                {"upload_id": identifier(state["uploadId"]), "isPublic": False},
                {"Idempotency-Key": key},
            )
            state["renderId"] = identifier(preview.get("id"))
        identifier(state["renderId"])
        save(state_path, state)
        path = "/api/renders/" + quote(state["renderId"], safe="")
        print(
            json.dumps({"renderId": state["renderId"], "checkpoint": str(state_path)}),
            flush=True,
        )
        while True:
            render = request("GET", path)
            if render.get("id") != state["renderId"]:
                raise WorkflowError("Render ID mismatch")
            status = render.get("status")
            if status == "ready":
                if render.get("hasModel") is not True:
                    raise WorkflowError(
                        "Ready render has no model; inspect the existing ID"
                    )
                break
            if status == "failed":
                raise WorkflowError(
                    "Render failed; this example will not create a replacement"
                )
            if status == "preview_ready":
                total = integer(render.get("renderCredits"), "renderCredits")
                paid = integer(render.get("credits"), "credits")
                pending = max(0, total - paid)
                pricing = request("GET", "/api/credits")
                balance = integer(pricing.get("balance"), "balance")
                if pricing.get("currency") not in ["usd", "eur"]:
                    raise WorkflowError("Unsupported quote currency")
                print(
                    json.dumps(
                        {
                            "pendingCredits": pending,
                            "balance": balance,
                            "currency": pricing["currency"],
                        }
                    ),
                    flush=True,
                )
                if not args.approve_build:
                    print(
                        "Preview ready. Inspect it in your account; rerun this checkpoint with --approve-build --max-credits N to authorize a build."
                    )
                    return
                if pending > args.max_credits or pending > balance:
                    raise WorkflowError(
                        "Budget or balance is below the quoted pending debit; no build submitted"
                    )
                if state.get("buildAttempted"):
                    raise WorkflowError(
                        "A build was already attempted. Its outcome must be resolved; this example will not resubmit"
                    )
                state.update(
                    buildAttempted=True,
                    authorizedMaxCredits=args.max_credits,
                    quotedPendingCredits=pending,
                )
                save(
                    state_path, state
                )  # Persist intent BEFORE the paid request; an ambiguous result cannot trigger a retry.
                post(path + "/render", {"maxCredits": args.max_credits})
            elif status not in ["drafting", "rendering"]:
                raise WorkflowError("Unknown render status; stopping without spending")
            pause(args.poll_seconds)
        observed_credits = integer(render.get("credits"), "credits")
        data = request(
            "GET", path + "/model", model=True
        )  # Ignore response-provided URLs; never forward the key elsewhere.
        if len(data) < 12 or struct.unpack("<4sII", data[:12]) != (
            b"glTF",
            2,
            len(data),
        ):
            raise WorkflowError("Downloaded body is not a complete GLB 2.0 file")
        with open(args.output, "xb") as output:
            os.chmod(args.output, 0o600)
            output.write(data)
        receipt = {
            "renderId": state["renderId"],
            "status": "ready",
            "glbBytes": len(data),
            "observedRenderCredits": observed_credits,
            "authorizedMaxCredits": state.get("authorizedMaxCredits"),
            "quotedPendingCredits": state.get("quotedPendingCredits"),
            "invocationSeconds": round(time.monotonic() - started, 3),
            "isResumed": is_resumed,
            "timingScope": "this_invocation",
        }
        if args.receipt:
            with open(args.receipt, "x", encoding="utf-8") as target:
                os.chmod(args.receipt, 0o600)
                json.dump(receipt, target, allow_nan=False)
        print(json.dumps(receipt))
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        run(arguments())
    except (WorkflowError, OSError, ValueError, KeyError) as error:
        # No raw server bodies, headers, authentication values or traceback in CLI output.
        message = (
            str(error)
            if isinstance(error, WorkflowError)
            else "Local file/checkpoint or response error; inspect the saved ID"
        )
        print(message, file=__import__("sys").stderr)
        raise SystemExit(1)
