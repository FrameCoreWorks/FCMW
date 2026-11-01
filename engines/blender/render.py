# FCWM runner for Blender films (bpy, the Blender Python module, GPL-3.0-or-later; FCWM only calls it).
#
#   uv run --python 3.13 --with bpy==<pinned> python render.py -- --film <dir> --format 9x16 \
#       --out <dir> [--frames 1,15,30 | --frames all] [--scale 0.5] [--samples 8]
#
# The film is <film>/scene.py with a function build(scene, film) that creates every object, material,
# light and camera from nothing and animates them with keyframes or drivers (Blender's own animation
# system), so any frame can be rendered on its own, in any order. This runner starts from an empty
# factory scene, applies the film's size, frame rate and render settings, calls build() and writes one
# PNG per requested frame: frame-00001.png (RGBA when the film is transparent).
import argparse
import importlib.util
import json
import pathlib
import struct
import sys

import bpy  # first: importing bpy puts Blender's own modules (addon_utils) on the path

import addon_utils  # noqa: E402

SIZES = {"9x16": (1080, 1920), "16x9": (1920, 1080), "1x1": (1080, 1080)}


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--film", required=True)
    p.add_argument("--format", required=True, choices=SIZES)
    p.add_argument("--out", required=True)
    p.add_argument("--frames", default="all")
    p.add_argument("--scale", type=float, default=1.0)
    p.add_argument("--samples", type=int, default=0)
    return p.parse_args(argv)


def strip_png_text(path):
    """Drop text and time chunks (Cycles writes its render time there) so equal pixels mean equal files."""
    data = path.read_bytes()
    out, i = [data[:8]], 8
    while i < len(data):
        (n,) = struct.unpack(">I", data[i:i + 4])
        if data[i + 4:i + 8] not in (b"tEXt", b"iTXt", b"zTXt", b"tIME"):
            out.append(data[i:i + 12 + n])
        i += 12 + n
    path.write_bytes(b"".join(out))


def gpu_device():
    """The first GPU backend Cycles can use here (Metal on Apple silicon, OptiX/CUDA/HIP/oneAPI), else None."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == kind]
        if devices:
            for d in prefs.devices:
                d.use = d.type == kind
            return kind
    return None


def main():
    a = args()
    film_dir = pathlib.Path(a.film).resolve()
    cfg = json.loads((film_dir / "film.json").read_text())
    fps = int(cfg.get("fps", 30))
    duration = float(cfg.get("duration", 10))
    last = max(1, round(duration * fps))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("cycles", default_set=True)
    scene = bpy.context.scene
    w, h = SIZES[a.format]
    r = scene.render
    r.resolution_x, r.resolution_y = round(w * a.scale), round(h * a.scale)
    r.resolution_percentage = 100
    r.fps, r.fps_base = fps, 1.0
    scene.frame_start, scene.frame_end = 1, last
    r.film_transparent = bool(cfg.get("alpha", False))
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA" if r.film_transparent else "RGB"
    r.image_settings.color_depth = "8"
    r.use_motion_blur = bool(cfg.get("motionBlur", False))
    # No metadata stamps: Blender writes the date and render time into each PNG, so two renders of the
    # same frame would differ byte for byte although every pixel matches.
    for prop in r.bl_rna.properties:
        if prop.identifier.startswith("use_stamp"):
            setattr(r, prop.identifier, False)

    # Cycles by default: it renders without a display (CI, servers) and is deterministic with a fixed seed.
    r.engine = "CYCLES"
    c = scene.cycles
    device = gpu_device() if cfg.get("gpu", True) else None
    c.device = "GPU" if device else "CPU"
    c.samples = a.samples or int(cfg.get("samples", 64))
    c.seed = int(cfg.get("seed", 1))
    c.use_animated_seed = False  # a fixed noise pattern; an animated seed is still per-frame deterministic
    c.use_denoising = bool(cfg.get("denoise", True))
    c.use_adaptive_sampling = False  # adaptive sampling stops on a noise threshold; keep the work fixed
    print(f"fcwm-blender: {r.resolution_x}x{r.resolution_y} {fps} fps, {c.samples} samples on {device or 'CPU'}", flush=True)

    spec = importlib.util.spec_from_file_location("film_scene", film_dir / "scene.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.build(scene, {**cfg, "format": a.format, "width": w, "height": h, "frames": last, "dir": str(film_dir)})

    frames = range(1, last + 1) if a.frames == "all" else sorted({min(last, max(1, int(f))) for f in a.frames.split(",")})
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for f in frames:
        scene.frame_set(f)
        r.filepath = str(out / f"frame-{f:05d}.png")
        bpy.ops.render.render(write_still=True)
        strip_png_text(pathlib.Path(r.filepath))
        print(f"fcwm-blender: frame {f}/{last}", flush=True)


main()
