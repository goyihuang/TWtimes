"""Tainan station study meshes. Metres, front +Y, pavement at Z=0.
Dimensions are visual estimates; these layers complement the procedural shells.
"""
import bpy, math, pathlib
from mathutils import Vector
root = pathlib.Path(__file__).resolve().parents[2]
def material(name, rgb):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    return m
def beam(name,a,b,width,depth,mat):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object
    o.name=name
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    o.scale=(width,depth,(b-a).length)
    o.data.materials.append(mat)
def export(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
    bpy.ops.object.join()
    bpy.ops.export_scene.gltf(filepath=str(root/'public/models'/name),export_format='GLB')
bpy.ops.wm.read_factory_settings(use_empty=True)
oak=material('Weathered timber',(.23,.15,.09))
for x in (-15,-10,-5,5,10,15):
    beam('Porch post',(x,9,0),(x,9,4.5),.18,.18,oak)
    for side in (-1,1):
        beam('Knee brace',(x,9,3.5),(x+side*.8,9,4.4),.13,.14,oak)
beam('Eaves plate',(-16,9,4.4),(16,9,4.4),.24,.24,oak)
export('tainan-timber-porch.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
stone=material('Warm washed aggregate',(.62,.55,.41))
dark=material('Recessed joinery',(.19,.20,.17))
for x in (-12,-6,6,12):
    beam('Gallery pier',(x,15,0),(x,15,5),.53,.63,stone)
    beam('Capital',(x,15,4.65),(x,15,5.0),.83,.93,stone)
    beam('Plinth',(x,15,0),(x,15,.48),.80,.84,stone)
beam('Gallery floor',(-14,14,5.05),(14,14,5.05),.34,3.4,stone)
for x in range(-13,14):
    beam('Baluster',(x,15.5,5.22),(x,15.5,6.06),.14,.17,stone)
beam('Handrail',(-14,15.5,6.1),(14,15.5,6.1),.19,.22,stone)
for x in (-9,0,9):
    beam('Recessed threshold',(x-2,13,.14),(x+2,13,.14),.2,.65,dark)
export('tainan-hotel-gallery.glb')
