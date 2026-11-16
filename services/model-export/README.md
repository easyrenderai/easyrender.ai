# model-export

Turns one GLB into the file a customer downloads in another 3D format. It is Blender, used as a
Python module (`bpy`), in a container that AWS Lambda starts for one export and stops again.
There is no server to keep running, no public endpoint and no shared token.

| Format | Download      | What is inside                                           |
| ------ | ------------- | -------------------------------------------------------- |
| obj    | `model.zip`   | `model.obj`, `model.mtl` and the textures in `textures/` |
| fbx    | `model.fbx`   | the model with its textures embedded                     |
| blend  | `model.blend` | the Blender file with its textures packed                |

## Files

- `convert.py`: the conversion. No network and no AWS, so it runs the same on a laptop.
- `formats.py`: the format names and the refusal error. It loads no Blender, so the container
  starts fast and loads Blender on the first conversion.
- `handler.py`: the Lambda entry point. Reads the GLB from the private exports bucket, converts
  it and writes the result back.
- `Dockerfile`: the image Lambda runs.
- `test_convert.py`, `test_handler.py`: tests. Each one opens the download from an empty folder,
  the way a customer would.

## The request

The web app starts one run per export with its AWS role. The bucket comes from the
`EXPORTS_BUCKET` variable, never from the request, and both keys must sit under `exports/`.

```json
{
  "sourceKey": "exports/<id>/source.glb",
  "format": "obj",
  "outputKey": "exports/<id>/model.zip",
  "downloadName": "oak-chair"
}
```

It answers `{"ok": true, "outputKey", "bytes", "contentType", "seconds"}`. When the input is the
problem (unknown format, a key outside `exports/`, a missing or oversized source, a file that is
not a GLB) it answers `{"ok": false, "error": "..."}` and writes nothing. Anything else raises,
so the caller sees a failed run.

`MAX_SOURCE_BYTES` caps the source size (default 200 MB). The time limit is the Lambda timeout.

## The first run of a new image

Lambda fetches a new image piece by piece as files are first read, and Blender is most of it.
Measured on 2026-11-16 with a 623 KB model: 53 seconds for the first export on a new image,
about 3 seconds for a fresh container after that, under half a second on a warm one. The deploy
workflow therefore sends `{"warm": true}` once after it ships an image. That request converts a
small generated model to every format, touches no bucket and answers
`{"ok": true, "warm": true, "seconds"}`.

## Material edits

The app's material editor stores a colour tint next to the texture, as glTF does
(`baseColorFactor`). OBJ and FBX have no such pair and would lose the texture, so for those two
the tint is multiplied into the texture. BLEND keeps the tint as its own node. Roughness and
metalness carry over in all three. The source GLB must be the edited one: the app writes the
model it serves, not the stored original.

## Run it

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # Python 3.13
.venv/bin/python -m pytest
.venv/bin/python convert.py model.glb fbx ./out

docker build -t model-export .
```

CI (`.github/workflows/model-export.yml`) builds the image and runs the tests inside it on every
PR that touches this folder. On `main` it then pushes the image and points the Lambda function at
it.

## Measured

On 2026-11-16, in the image, with 2 vCPU and a read-only filesystem, on a real 5.7 MB render
(2048 px texture): Blender starts in 0.6 s, a conversion takes 0.1 to 1.3 s, and peak memory is
355 MB, or 607 MB when a colour edit is baked into the texture. The image is about 750 MB
compressed. The first start after idle on Lambda itself is not measured yet.

## Not here yet

The app side: export routes, buttons and signed links. The function, its roles and the image
registry are `infra/aws/exports.yml`; the private bucket and the signed download path are
`infra/aws/storage.yml`. See `infra/aws/README.md`.
