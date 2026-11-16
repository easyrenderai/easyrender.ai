"""The handler is checked through what its caller sees: the returned value and what lands in S3."""

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from botocore.exceptions import ClientError

import handler as handler_module


class FakeS3:
    """A folder standing in for the exports bucket."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.uploads: dict[str, dict[str, Any]] = {}

    def head_object(self, Bucket: str, Key: str) -> dict[str, Any]:
        path = self.root / Key
        if not path.is_file():
            raise ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject")
        return {"ContentLength": path.stat().st_size}

    def download_file(self, Bucket: str, Key: str, Filename: str) -> None:
        shutil.copy(self.root / Key, Filename)

    def upload_file(self, Filename: str, Bucket: str, Key: str, ExtraArgs: dict[str, Any]) -> None:
        target = self.root / Key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(Filename, target)
        self.uploads[Key] = {"bucket": Bucket, **ExtraArgs}


@pytest.fixture
def bucket(sample_glb: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> FakeS3:
    fake = FakeS3(tmp_path / "bucket")
    source = fake.root / "exports/abc/source.glb"
    source.parent.mkdir(parents=True)
    shutil.copy(sample_glb, source)
    monkeypatch.setattr(handler_module, "_client", lambda: fake)
    monkeypatch.setenv("EXPORTS_BUCKET", "exports-bucket")
    return fake


@pytest.mark.parametrize(
    ("fmt", "key", "content_type"),
    [
        ("obj", "exports/abc/model.zip", "application/zip"),
        ("fbx", "exports/abc/model.fbx", "application/octet-stream"),
        ("blend", "exports/abc/model.blend", "application/x-blender"),
    ],
)
def test_writes_the_converted_file_next_to_the_source(
    bucket: FakeS3, fmt: str, key: str, content_type: str
) -> None:
    result = handler_module.handler(
        {
            "sourceKey": "exports/abc/source.glb",
            "format": fmt,
            "outputKey": key,
            "downloadName": "Oak chair / v2",
        }
    )

    stored = bucket.root / key
    assert result["ok"] is True
    assert result["outputKey"] == key
    assert result["contentType"] == content_type
    assert result["bytes"] == stored.stat().st_size > 0
    extension = key.rsplit(".", 1)[1]
    assert bucket.uploads[key] == {
        "bucket": "exports-bucket",
        "ContentType": content_type,
        "ContentDisposition": f'attachment; filename="Oak-chair-v2.{extension}"',
    }


@pytest.mark.parametrize(
    "event",
    [
        {"sourceKey": "exports/abc/source.glb", "format": "stl", "outputKey": "exports/abc/m.stl"},
        {"sourceKey": "renders/models/a.glb", "format": "obj", "outputKey": "exports/abc/m.zip"},
        {
            "sourceKey": "exports/../renders/a.glb",
            "format": "obj",
            "outputKey": "exports/abc/m.zip",
        },
        {"sourceKey": "exports/abc/source.glb", "format": "obj", "outputKey": "renders/m.zip"},
        {"sourceKey": "exports/abc/source.glb", "format": "obj", "outputKey": "exports/abc/m.fbx"},
        {"sourceKey": "exports/abc/source.glb", "format": "fbx"},
        {},
    ],
)
def test_refuses_a_request_outside_the_exports_folder_or_format(
    bucket: FakeS3, event: dict[str, Any]
) -> None:
    result = handler_module.handler(event)

    assert result["ok"] is False
    assert result["error"]
    assert bucket.uploads == {}


def test_reports_a_missing_source_without_writing(bucket: FakeS3) -> None:
    result = handler_module.handler(
        {"sourceKey": "exports/gone/source.glb", "format": "obj", "outputKey": "exports/gone/m.zip"}
    )

    assert result == {"ok": False, "error": "Source model not found"}
    assert bucket.uploads == {}


def test_refuses_a_source_over_the_size_limit(
    bucket: FakeS3, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MAX_SOURCE_BYTES", "10")

    result = handler_module.handler(
        {"sourceKey": "exports/abc/source.glb", "format": "obj", "outputKey": "exports/abc/m.zip"}
    )

    assert result == {"ok": False, "error": "The model is too large to convert"}
    assert bucket.uploads == {}


def test_starting_the_container_does_not_load_blender() -> None:
    # AWS Lambda gives the start-up 10 seconds and Blender alone can take longer on a cold start.
    # The first real run on Lambda timed out there and took 26 seconds for a 1.5 second conversion.
    code = "import sys, handler; print('bpy' in sys.modules, 'convert' in sys.modules)"
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=True,
        cwd=Path(__file__).parent,
    )

    assert result.stdout.split() == ["False", "False"]


def test_a_refused_request_is_answered_without_loading_blender() -> None:
    code = (
        "import sys, handler; "
        "print(handler.handler({'format': 'stl'})['ok'], 'bpy' in sys.modules)"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=True,
        cwd=Path(__file__).parent,
    )

    assert result.stdout.split() == ["False", "False"]
