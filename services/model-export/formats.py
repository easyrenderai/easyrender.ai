"""What the converter makes and how it says no. Nothing here loads Blender.

`handler.py` imports this file when the container starts and `convert.py` only when a conversion
runs: Blender takes seconds to load on a cold start, and AWS Lambda stops a start-up that runs
past 10 seconds and then starts it a second time.
"""

from __future__ import annotations

FORMATS = ("obj", "fbx", "blend")

# What the customer downloads for each format.
OUTPUT_EXTENSION = {"obj": "zip", "fbx": "fbx", "blend": "blend"}
OUTPUT_CONTENT_TYPE = {
    "obj": "application/zip",
    "fbx": "application/octet-stream",
    "blend": "application/x-blender",
}


class ConversionError(Exception):
    """The input could not be converted. The message is safe to show to the caller."""
