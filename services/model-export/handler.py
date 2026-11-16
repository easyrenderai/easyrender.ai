"""Run one export: read a GLB from the exports bucket, convert it, write the result back.

This is the entry point of the container (AWS Lambda calls `handler`). There is no HTTP server,
no public endpoint and no shared token: the web app starts one run per export with its AWS role,
and this code can only reach the one private bucket named in EXPORTS_BUCKET.

Event:    {"sourceKey": "exports/<id>/source.glb", "format": "obj" | "fbx" | "blend",
           "outputKey": "exports/<id>/model.zip" | ".fbx" | ".blend", "downloadName"?: "chair"}
Returns:  {"ok": true, "outputKey", "bytes", "contentType", "seconds"}
          {"ok": false, "error": "..."} when the input is the problem (nothing to retry)
Anything else (S3 down, out of memory) raises, so the caller sees a failed run and can retry.

{"warm": true} converts a small generated model and touches no bucket. The deploy workflow sends
it once per new image, because the first run of a new image is slow (see convert.warm_up).
"""

from __future__ import annotations

import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

from formats import (
    FORMATS,
    OUTPUT_CONTENT_TYPE,
    OUTPUT_EXTENSION,
    ConversionError,
)

PREFIX = "exports/"
DEFAULT_MAX_SOURCE_BYTES = 200 * 1024 * 1024

_KEY = re.compile(r"^exports/[A-Za-z0-9_\-./]+$")
_s3 = None


def _client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def _checked_key(value: Any, extension: str, field: str) -> str:
    if (
        not isinstance(value, str)
        or len(value) > 512
        or not _KEY.match(value)
        or ".." in value
        or "//" in value
        or not value.endswith(f".{extension}")
    ):
        raise ConversionError(f"{field} must be a .{extension} key under {PREFIX}")
    return value


def _download_name(value: Any, extension: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-")[:80] if isinstance(value, str) else ""
    return f"{stem or 'model'}.{extension}"


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    started = time.monotonic()
    if event.get("warm") is True:
        # Sent by the deploy workflow after it ships an image. Reads and writes nothing in S3.
        from convert import warm_up

        with tempfile.TemporaryDirectory(prefix="warm-") as work:
            warm_up(Path(work))
        return {"ok": True, "warm": True, "seconds": round(time.monotonic() - started, 2)}
    try:
        fmt = event.get("format")
        if fmt not in FORMATS:
            raise ConversionError(f"format must be one of: {', '.join(FORMATS)}")
        extension = OUTPUT_EXTENSION[fmt]
        source_key = _checked_key(event.get("sourceKey"), "glb", "sourceKey")
        output_key = _checked_key(event.get("outputKey"), extension, "outputKey")
        bucket = os.environ["EXPORTS_BUCKET"]
        max_bytes = int(os.environ.get("MAX_SOURCE_BYTES", DEFAULT_MAX_SOURCE_BYTES))

        with tempfile.TemporaryDirectory(prefix="export-") as work:
            work_dir = Path(work)
            source = work_dir / "source.glb"
            try:
                size = _client().head_object(Bucket=bucket, Key=source_key)["ContentLength"]
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                    raise ConversionError("Source model not found") from error
                raise
            if size > max_bytes:
                raise ConversionError("The model is too large to convert")
            _client().download_file(bucket, source_key, str(source))

            # Blender loads here, on the first conversion, not when the container starts: see
            # formats.py. A refused request never loads it.
            from convert import convert

            output = convert(source, fmt, work_dir)
            output_bytes = output.stat().st_size
            name = _download_name(event.get("downloadName"), extension)
            _client().upload_file(
                str(output),
                bucket,
                output_key,
                ExtraArgs={
                    "ContentType": OUTPUT_CONTENT_TYPE[fmt],
                    "ContentDisposition": f'attachment; filename="{name}"',
                },
            )
    except ConversionError as error:
        return {"ok": False, "error": str(error)}

    return {
        "ok": True,
        "outputKey": output_key,
        "bytes": output_bytes,
        "contentType": OUTPUT_CONTENT_TYPE[fmt],
        "seconds": round(time.monotonic() - started, 2),
    }
