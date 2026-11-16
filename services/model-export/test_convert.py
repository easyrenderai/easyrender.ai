"""Each format is checked the way a customer would: open the download somewhere else.

Every test copies the output to an empty folder first, so a texture that only works because the
converter's own working files are still next to it fails the test.
"""

import shutil
import zipfile
from pathlib import Path

import bpy
import pytest

from conftest import (
    EDIT_METALNESS,
    EDIT_ROUGHNESS,
    EDIT_TINT,
    TEXTURE_COLOUR,
    TEXTURE_SIZE,
)
from convert import ConversionError, convert


def _triangles() -> int:
    total = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
    return total


def _base_colour_images() -> list[bpy.types.Image]:
    """Images wired into a material, loaded from wherever the opened file says they are."""
    images = []
    for material in bpy.data.materials:
        if material.node_tree is None:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                images.append(node.image)
    return images


def _empty_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def _srgb(value: float) -> float:
    return value * 12.92 if value <= 0.0031308 else 1.055 * value ** (1 / 2.4) - 0.055


# The colour a viewer shows for the edited sample: tint times texture, in linear light.
TINTED_COLOUR = tuple(
    _srgb(_linear(channel) * tint) for channel, tint in zip(TEXTURE_COLOUR, EDIT_TINT, strict=True)
)


def _shader() -> bpy.types.Node:
    (material,) = bpy.data.materials
    return next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")


def _texture_colour() -> tuple[float, ...]:
    """The first pixel of the texture wired straight into the shader's Base Color."""
    source = _shader().inputs["Base Color"].links[0].from_node
    assert source.type == "TEX_IMAGE"
    return tuple(source.image.pixels[0:3])


def test_obj_zip_opens_with_its_material_and_texture(sample_glb: Path, tmp_path: Path) -> None:
    output = convert(sample_glb, "obj", tmp_path / "work")

    assert output.suffix == ".zip"
    elsewhere = tmp_path / "customer"
    with zipfile.ZipFile(output) as archive:
        names = sorted(archive.namelist())
        archive.extractall(elsewhere)
    assert names == ["model.mtl", "model.obj", "textures/Base_Colour.png"]
    assert "map_Kd textures/Base_Colour.png" in (elsewhere / "model.mtl").read_text()

    shutil.rmtree(tmp_path / "work")
    _empty_scene()
    bpy.ops.wm.obj_import(filepath=str(elsewhere / "model.obj"))
    assert _triangles() == 12
    images = _base_colour_images()
    assert [tuple(image.size) for image in images] == [(TEXTURE_SIZE, TEXTURE_SIZE)]


def test_fbx_carries_its_texture_inside_the_file(sample_glb: Path, tmp_path: Path) -> None:
    output = convert(sample_glb, "fbx", tmp_path / "work")

    assert output.name == "model.fbx"
    elsewhere = tmp_path / "customer"
    elsewhere.mkdir()
    shutil.copy(output, elsewhere / "model.fbx")
    shutil.rmtree(tmp_path / "work")

    _empty_scene()
    bpy.ops.import_scene.fbx(filepath=str(elsewhere / "model.fbx"))
    assert _triangles() == 12
    images = _base_colour_images()
    assert [tuple(image.size) for image in images] == [(TEXTURE_SIZE, TEXTURE_SIZE)]
    # Other tools tell the image type from the embedded file's name, so it keeps its extension.
    assert [Path(image.filepath).name for image in images] == ["Base_Colour.png"]


def test_blend_opens_with_packed_textures(sample_glb: Path, tmp_path: Path) -> None:
    output = convert(sample_glb, "blend", tmp_path / "work")

    assert output.name == "model.blend"
    elsewhere = tmp_path / "customer"
    elsewhere.mkdir()
    shutil.copy(output, elsewhere / "model.blend")
    shutil.rmtree(tmp_path / "work")

    bpy.ops.wm.open_mainfile(filepath=str(elsewhere / "model.blend"))
    assert _triangles() == 12
    images = _base_colour_images()
    assert [tuple(image.size) for image in images] == [(TEXTURE_SIZE, TEXTURE_SIZE)]
    assert all(image.packed_file is not None for image in images)
    assert bpy.data.materials["Oak"] is not None


def test_obj_keeps_a_material_edit(edited_glb: Path, tmp_path: Path) -> None:
    output = convert(edited_glb, "obj", tmp_path / "work")

    elsewhere = tmp_path / "customer"
    with zipfile.ZipFile(output) as archive:
        archive.extractall(elsewhere)
    shutil.rmtree(tmp_path / "work")
    _empty_scene()
    bpy.ops.wm.obj_import(filepath=str(elsewhere / "model.obj"))

    assert _texture_colour() == pytest.approx(TINTED_COLOUR, abs=2 / 255)
    assert _shader().inputs["Roughness"].default_value == pytest.approx(EDIT_ROUGHNESS, abs=0.01)
    assert _shader().inputs["Metallic"].default_value == pytest.approx(EDIT_METALNESS, abs=0.01)


def test_fbx_keeps_a_material_edit(edited_glb: Path, tmp_path: Path) -> None:
    output = convert(edited_glb, "fbx", tmp_path / "work")

    elsewhere = tmp_path / "customer"
    elsewhere.mkdir()
    shutil.copy(output, elsewhere / "model.fbx")
    shutil.rmtree(tmp_path / "work")
    _empty_scene()
    bpy.ops.import_scene.fbx(filepath=str(elsewhere / "model.fbx"))

    assert _texture_colour() == pytest.approx(TINTED_COLOUR, abs=2 / 255)
    assert _shader().inputs["Roughness"].default_value == pytest.approx(EDIT_ROUGHNESS, abs=0.01)
    assert _shader().inputs["Metallic"].default_value == pytest.approx(EDIT_METALNESS, abs=0.01)


def test_blend_keeps_a_material_edit_editable(edited_glb: Path, tmp_path: Path) -> None:
    output = convert(edited_glb, "blend", tmp_path / "work")

    bpy.ops.wm.open_mainfile(filepath=str(output))

    # In Blender the tint stays a separate Multiply node over the untouched texture.
    mix = _shader().inputs["Base Color"].links[0].from_node
    assert (mix.type, mix.blend_type) == ("MIX", "MULTIPLY")
    constants = [s for s in mix.inputs if s.type == "RGBA" and not s.is_linked]
    assert tuple(constants[0].default_value)[:3] == pytest.approx(EDIT_TINT, abs=0.001)
    (texture,) = [s.links[0].from_node for s in mix.inputs if s.type == "RGBA" and s.is_linked]
    assert tuple(texture.image.pixels[0:3]) == pytest.approx(TEXTURE_COLOUR, abs=2 / 255)
    assert _shader().inputs["Roughness"].default_value == pytest.approx(EDIT_ROUGHNESS, abs=0.01)
    assert _shader().inputs["Metallic"].default_value == pytest.approx(EDIT_METALNESS, abs=0.01)


def test_one_export_does_not_leak_into_the_next(sample_glb: Path, tmp_path: Path) -> None:
    convert(sample_glb, "blend", tmp_path / "first")
    output = convert(sample_glb, "blend", tmp_path / "second")

    bpy.ops.wm.open_mainfile(filepath=str(output))
    assert _triangles() == 12
    assert len(bpy.data.materials) == 1


def test_a_file_that_is_not_a_glb_is_refused(tmp_path: Path) -> None:
    broken = tmp_path / "broken.glb"
    broken.write_bytes(b"this is not a model")

    with pytest.raises(ConversionError):
        convert(broken, "obj", tmp_path / "work")


def test_an_unknown_format_is_refused(sample_glb: Path, tmp_path: Path) -> None:
    with pytest.raises(ConversionError, match="Unsupported format"):
        convert(sample_glb, "stl", tmp_path / "work")
