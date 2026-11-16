"""Convert one GLB into OBJ, FBX or BLEND with Blender's Python module (`bpy`).

One call converts one file and returns the path of the single file to hand to the customer:

- obj:   a zip with model.obj, model.mtl and textures/
- fbx:   model.fbx with the textures embedded
- blend: model.blend with the textures packed

No network and no AWS in this file, so it runs and is tested the same way on a laptop, in CI and
in the container.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

import bpy
import numpy as np

FORMATS = ("obj", "fbx", "blend")

# What the customer downloads for each format.
OUTPUT_EXTENSION = {"obj": "zip", "fbx": "fbx", "blend": "blend"}
OUTPUT_CONTENT_TYPE = {
    "obj": "application/zip",
    "fbx": "application/octet-stream",
    "blend": "application/x-blender",
}

_IMAGE_EXTENSION = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}


class ConversionError(Exception):
    """The input could not be converted. The message is safe to show to the caller."""


def convert(source: Path, fmt: str, work_dir: Path) -> Path:
    """Convert `source` (a .glb) to `fmt` inside `work_dir` and return the output file."""
    if fmt not in FORMATS:
        raise ConversionError(f"Unsupported format: {fmt}")
    if not source.is_file():
        raise ConversionError("Source model not found")

    out_dir = work_dir / fmt
    out_dir.mkdir(parents=True, exist_ok=True)

    _load(source)
    if fmt == "blend":
        return _export_blend(out_dir)
    if fmt == "fbx":
        return _export_fbx(out_dir)
    return _export_obj(out_dir)


def _load(source: Path) -> None:
    # Start from an empty file every time: a warm container must not carry the previous
    # customer's meshes into the next export.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=str(source))
    except RuntimeError as error:
        raise ConversionError("The model could not be read as GLB") from error
    if not any(obj.type == "MESH" for obj in bpy.data.objects):
        raise ConversionError("The model has no geometry")


def _bake_tints() -> None:
    """Multiply a material's colour tint into its texture, for OBJ and FBX.

    glTF stores a tint (baseColorFactor) next to the colour texture, and the app's material
    editor writes its colour change there. Blender shows that as a Multiply node between the
    texture and the shader. OBJ and FBX have no such pair: their exporters only follow a texture
    wired straight into Base Color, so a tinted material would leave with no texture at all.
    BLEND keeps the node, so this is not used there.
    """
    for material in bpy.data.materials:
        tree = material.node_tree
        if tree is None:
            continue
        shader = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if shader is None or not shader.inputs["Base Color"].is_linked:
            continue
        base_color = shader.inputs["Base Color"]
        mix = base_color.links[0].from_node
        if mix.type != "MIX" or mix.data_type != "RGBA" or mix.blend_type != "MULTIPLY":
            continue
        if mix.inputs[0].is_linked or mix.inputs[0].default_value < 0.999:
            continue
        colours = [socket for socket in mix.inputs if socket.type == "RGBA"]
        linked = [socket for socket in colours if socket.is_linked]
        constant = [socket for socket in colours if not socket.is_linked]
        if len(linked) != 1 or len(constant) != 1:
            continue
        texture = linked[0].links[0].from_node
        if texture.type != "TEX_IMAGE" or texture.image is None:
            continue

        original = texture.image
        texture.image = _tinted_copy(original, tuple(constant[0].default_value)[:3])
        tree.links.new(texture.outputs["Color"], base_color)
        tree.nodes.remove(mix)
        if original.users == 0:
            name = original.name
            bpy.data.images.remove(original)
            texture.image.name = name


def _tinted_copy(image: bpy.types.Image, tint: tuple[float, ...]) -> bpy.types.Image:
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = pixels.reshape(-1, 4)[:, :3]
    # The texture is stored sRGB-encoded and the tint is linear, as glTF defines it.
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    linear = linear * np.asarray(tint, dtype=np.float32)
    encoded = np.where(
        linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - 0.055
    )
    rgb[:] = np.clip(encoded, 0.0, 1.0)

    copy = bpy.data.images.new(f"{image.name} tinted", width, height, alpha=image.depth == 32)
    copy.colorspace_settings.name = image.colorspace_settings.name
    copy.alpha_mode = image.alpha_mode
    copy.pixels.foreach_set(pixels)
    copy.file_format = "PNG"
    copy.pack()
    return copy


def _write_textures(textures_dir: Path) -> None:
    """Write every texture to disk and point its image at the file.

    A GLB carries its textures inside the file, so after the import they only exist in memory.
    OBJ needs real files next to the .mtl. FBX embeds an in-memory texture too, but under a name
    with no extension, and other tools tell the image type from that name. The original encoded
    bytes are written as they are, so nothing is recompressed.
    """
    textures_dir.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    for image in bpy.data.images:
        if image.packed_file is None or image.users == 0:
            continue
        extension = _IMAGE_EXTENSION.get(image.file_format)
        name = _safe_name(image.name, used)
        if extension is None:
            # A format the other tools may not read: let Blender re-encode it as PNG.
            image.file_format = "PNG"
            image.filepath_raw = str(textures_dir / f"{name}.png")
            image.save()
            continue
        path = textures_dir / f"{name}.{extension}"
        path.write_bytes(image.packed_file.data)
        image.unpack(method="REMOVE")
        image.filepath = str(path)
        image.reload()


def _safe_name(raw: str, used: set[str]) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", Path(raw).stem).strip("_") or "texture"
    name = base
    count = 1
    while name in used:
        count += 1
        name = f"{base}_{count}"
    used.add(name)
    return name


def _export_obj(out_dir: Path) -> Path:
    _bake_tints()
    _write_textures(out_dir / "textures")
    obj_path = out_dir / "model.obj"
    bpy.ops.wm.obj_export(
        filepath=str(obj_path),
        export_materials=True,
        export_pbr_extensions=True,
        path_mode="RELATIVE",
    )
    zip_path = out_dir.parent / "model.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(out_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(out_dir).as_posix())
    return zip_path


def _export_fbx(out_dir: Path) -> Path:
    _bake_tints()
    _write_textures(out_dir / "textures")
    fbx_path = out_dir / "model.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(fbx_path),
        path_mode="COPY",
        embed_textures=True,
    )
    return fbx_path


def _export_blend(out_dir: Path) -> Path:
    blend_path = out_dir / "model.blend"
    # The importer already keeps the textures inside the file; pack_all covers anything it did not.
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True, copy=True)
    return blend_path


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 4:
        sys.exit("usage: python convert.py <model.glb> <obj|fbx|blend> <output folder>")
    print(convert(Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])))
