"""Shared test fixture: a small textured GLB made with Blender itself, so no binary is committed."""

import json
import struct
from pathlib import Path

import bpy
import pytest

TEXTURE_SIZE = 64
TEXTURE_COLOUR = (0.8, 0.2, 0.1)

# What the app's material editor writes into the GLB it serves: a colour tint that multiplies
# the texture, and new roughness and metalness values.
EDIT_TINT = (0.5, 0.7, 1.0)
EDIT_ROUGHNESS = 0.4
EDIT_METALNESS = 0.2


@pytest.fixture(scope="session")
def sample_glb(tmp_path_factory: pytest.TempPathFactory) -> Path:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=1)
    cube = bpy.context.active_object

    image = bpy.data.images.new("Base Colour", TEXTURE_SIZE, TEXTURE_SIZE)
    image.pixels = [*TEXTURE_COLOUR, 1.0] * (TEXTURE_SIZE * TEXTURE_SIZE)
    image.pack()

    material = bpy.data.materials.new("Oak")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    shader = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Roughness"].default_value = 0.35
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    cube.data.materials.append(material)

    path = tmp_path_factory.mktemp("fixture") / "sample.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB")
    return path


@pytest.fixture(scope="session")
def edited_glb(sample_glb: Path, tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The sample with a material edit applied the way the app does it: in the GLB's JSON."""
    data = sample_glb.read_bytes()
    magic, version, _ = struct.unpack("<III", data[:12])
    json_length, json_type = struct.unpack("<II", data[12:20])
    document = json.loads(data[20 : 20 + json_length])
    rest = data[20 + json_length :]

    pbr = document["materials"][0].setdefault("pbrMetallicRoughness", {})
    pbr["baseColorFactor"] = [*EDIT_TINT, 1.0]
    pbr["roughnessFactor"] = EDIT_ROUGHNESS
    pbr["metallicFactor"] = EDIT_METALNESS

    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    header = struct.pack("<III", magic, version, 20 + len(encoded) + len(rest))
    path = tmp_path_factory.mktemp("fixture") / "edited.glb"
    path.write_bytes(header + struct.pack("<II", len(encoded), json_type) + encoded + rest)
    return path
