# FCWM starter for the Blender engine (bpy). Brand-neutral: the shapes, materials, colours and words are
# placeholders; replace them with the film's own. `fcwm render <film>` runs this file through FCWM's
# runner (engines/blender/render.py), which calls build(scene, film) on an empty scene.
#
# Render contract in Blender terms: build everything from nothing here and animate only with keyframes
# or drivers, so Blender computes any frame from the frame number alone. No reading the clock, no
# handlers that keep state between frames, no unseeded randomness (use random.Random(seed)).
import json
import math
import pathlib

import bpy

GROUND = (0.067, 0.067, 0.067, 1)  # placeholders, linear RGBA (what Blender materials take)
INK = (0.9, 0.9, 0.9, 1)
ACCENT = (0.26, 0.26, 0.26, 1)


def linear(hex_colour):
    """#rrggbb (sRGB, as designers write it) to the linear RGBA Blender materials expect."""
    c = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1,)


# A brand kit (fcwm new --brand <kit>) replaces the placeholder colours it sets.
_BRAND = pathlib.Path(__file__).parent / "brand" / "brand.json"
if _BRAND.exists():
    _c = json.loads(_BRAND.read_text()).get("colors", {})
    GROUND = linear(_c["ground"]) if _c.get("ground") else GROUND
    INK = linear(_c["ink"]) if _c.get("ink") else INK
    ACCENT = linear(_c["accent"]) if _c.get("accent") else ACCENT


def material(name, color, roughness=0.4, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m


def key(obj, path, frame, value):
    """One keyframe (Blender's default Bezier ease between keys)."""
    setattr(obj, path, value)
    obj.keyframe_insert(data_path=path, frame=frame)


def build(scene, film):
    end = film["frames"]
    portrait = film["height"] > film["width"]

    # World: a flat dark ground colour (ignored when the film is transparent)
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = GROUND
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
    scene.world = world

    # Floor: catches shadows; on a transparent film it becomes a shadow catcher
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(material("floor", GROUND, roughness=0.6))
    floor.is_shadow_catcher = bool(film.get("alpha"))

    # Hero: a bevelled cube that settles and turns
    bpy.ops.mesh.primitive_cube_add(size=1.2, location=(0, 0, 0.6))
    hero = bpy.context.object
    bevel = hero.modifiers.new("bevel", "BEVEL")
    bevel.width, bevel.segments = 0.12, 6
    bpy.ops.object.shade_smooth()
    hero.data.materials.append(material("hero", INK, roughness=0.25))
    key(hero, "location", 1, (0, 0, 2.2))
    key(hero, "location", min(end, 24), (0, 0, 0.6))
    key(hero, "rotation_euler", 1, (0, 0, math.radians(-30)))
    key(hero, "rotation_euler", end, (0, 0, math.radians(60)))

    # Satellite: a metal sphere on a circular path, keyed on the frame
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, segments=48, ring_count=24)
    ball = bpy.context.object
    bpy.ops.object.shade_smooth()
    ball.data.materials.append(material("ball", ACCENT, roughness=0.15, metallic=1.0))
    steps = 8
    for i in range(steps + 1):
        f = 1 + round(i * (end - 1) / steps)
        a = i / steps * math.tau
        key(ball, "location", f, (1.6 * math.cos(a), 1.6 * math.sin(a), 0.32))

    # Light: one soft area key and a dim fill
    for name, energy, loc, size in (("key", 900, (3, -3, 5), 3), ("fill", 150, (-4, -2, 2), 5)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size = energy, size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = (math.radians(45), 0, math.atan2(loc[0], -loc[1]))
        scene.collection.objects.link(obj)
        obj.constraints.new("TRACK_TO").target = hero

    # Camera: a slow push in, framed for the film's aspect
    cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 35 if portrait else 50
    track = cam.constraints.new("TRACK_TO")
    track.target = hero
    dist = 9 if portrait else 7
    key(cam, "location", 1, (0, -dist, 2.6))
    key(cam, "location", end, (0, -dist * 0.8, 2.0))
