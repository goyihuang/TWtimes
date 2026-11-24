# Blender（bpy）建模共用工具：程式化材質貼圖、世界座標 UV、基本形體。
# 用法：python3 tools/blender/station1917.py  → public/models/station1917.glb
import bpy, bmesh, math, os, random
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter

TEX_DIR = os.path.join(os.path.dirname(__file__), '_tex')
os.makedirs(TEX_DIR, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# ── 貼圖（PIL 繪製）──
def tex_brick(name, base=(150, 66, 46), size=(512, 256), course=17, brick=59, mortar=(196, 184, 168), seed=1):
    r = random.Random(seed); W, H = size
    im = Image.new('RGB', size, mortar); d = ImageDraw.Draw(im)
    for j, y in enumerate(range(0, H, course)):
        off = (brick // 2) * (j % 2)
        for x in range(-brick, W + brick, brick):
            k = r.uniform(0.8, 1.15); c = tuple(max(0, min(255, int(v * k))) for v in base)
            d.rectangle([x + off + 1, y + 1, x + off + brick - 2, y + course - 2], fill=c)
    im = im.filter(ImageFilter.GaussianBlur(0.6)); p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

def tex_slate(name, base=(70, 70, 74), size=(512, 512), row=24, w=40, seed=2):
    r = random.Random(seed); im = Image.new('RGB', size, (35, 35, 38)); d = ImageDraw.Draw(im)
    for j, y in enumerate(range(0, size[1], row)):
        off = (w // 2) * (j % 2)
        for x in range(-w, size[0] + w, w):
            k = r.uniform(0.82, 1.12); c = tuple(int(v * k) for v in base)
            d.rectangle([x + off + 1, y + 2, x + off + w - 2, y + row - 1], fill=c)
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

def tex_stripes(name, base, size=(256, 256), period=16, dark=0.78):
    im = Image.new('RGB', size, base); d = ImageDraw.Draw(im)
    for x in range(0, size[0], period): d.rectangle([x, 0, x + period // 2, size[1]], fill=tuple(int(v * dark) for v in base))
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

def tex_blocks(name, base, size=(512, 512), bw=128, bh=64, seed=3):
    r = random.Random(seed); im = Image.new('RGB', size, tuple(int(v * 0.7) for v in base)); d = ImageDraw.Draw(im)
    for j, y in enumerate(range(0, size[1], bh)):
        off = (bw // 2) * (j % 2)
        for x in range(-bw, size[0] + bw, bw):
            k = r.uniform(0.9, 1.08); d.rectangle([x + off + 2, y + 2, x + off + bw - 2, y + bh - 2], fill=tuple(int(v * k) for v in base))
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

def tex_clock(name):
    S = 256; im = Image.new('RGB', (S, S), (235, 232, 222)); d = ImageDraw.Draw(im)
    d.ellipse([4, 4, S - 4, S - 4], outline=(40, 40, 40), width=10)
    for k in range(12):
        a = k / 12 * 2 * math.pi; x, y = S / 2 + math.sin(a) * 100, S / 2 - math.cos(a) * 100
        d.rectangle([x - 4, y - 8, x + 4, y + 8], fill=(30, 30, 30))
    d.line([S / 2, S / 2, S / 2, 50], fill=(20, 20, 20), width=7); d.line([S / 2, S / 2, S / 2 + 60, S / 2 + 20], fill=(20, 20, 20), width=8)
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

# ── 材質 ──
def mat(name, color=(0.8, 0.8, 0.8), tex=None, scale=(1, 1), rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if tex:
        t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex)
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    m['tile'] = scale  # 貼圖代表的實際公尺（u, v）
    return m

# ── 幾何 ──
def mesh_obj(name, verts, faces, material, uv=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob

def box(name, x0, x1, y0, y1, z0, z1, material):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh_obj(name, v, f, material)

def arch_outline(w, h, n=10, cx=0.0, z0=0.0, grow=0.0):
    """拱窗輪廓（x,z），底寬 w、直段高 h、上方半圓；grow 向外擴"""
    r = w / 2 + grow; pts = [(cx - r, z0 - grow), (cx + r, z0 - grow)]
    for i in range(n + 1):
        a = i / n * math.pi; pts.append((cx + r * math.cos(a), z0 + h + r * math.sin(a)))
    return pts

def rect_outline(w, h, cx=0.0, z0=0.0, grow=0.0):
    return [(cx - w / 2 - grow, z0 - grow), (cx + w / 2 + grow, z0 - grow), (cx + w / 2 + grow, z0 + h + grow), (cx - w / 2 - grow, z0 + h + grow)]

def prism_on_face(name, outline, plane, depth, material):
    """把 (u,z) 輪廓擠出成柱體。plane=(origin(x,y), dir_u(x,y), normal(x,y))：u 沿牆面，normal 朝外"""
    (ox, oy), (ux, uy), (nx, ny) = plane
    n = len(outline); verts = []
    for d in (0.0, depth):
        for (u, z) in outline: verts.append((ox + ux * u + nx * d, oy + uy * u + ny * d, z))
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    for i in range(n): j = (i + 1) % n; faces.append((i, j, n + j, n + i))
    ob = mesh_obj(name, verts, faces, material)
    fix_normals(ob); return ob

def frame_on_face(name, outer, inner, plane, depth, material):
    """窗框：outer 與 inner 輪廓（點數相同）之間的環，擠出 depth"""
    (ox, oy), (ux, uy), (nx, ny) = plane
    n = len(outer); verts = []
    for d in (0.0, depth):
        for ring in (outer, inner):
            for (u, z) in ring: verts.append((ox + ux * u + nx * d, oy + uy * u + ny * d, z))
    O0, I0, O1, I1 = 0, n, 2 * n, 3 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(O1 + i, O1 + j, I1 + j, I1 + i), (O0 + i, O1 + i, O1 + j, O0 + j), (I0 + i, I0 + j, I1 + j, I1 + i)]
    ob = mesh_obj(name, verts, faces, material); fix_normals(ob); return ob

def fix_normals(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()

def hip_roof(name, x0, x1, y0, y1, z, rise, material, overhang=0.5):
    x0 -= overhang; x1 += overhang; y0 -= overhang; y1 += overhang
    L, D = x1 - x0, y1 - y0; cy = (y0 + y1) / 2; cx = (x0 + x1) / 2
    if L >= D:
        h = (L - D) / 2; e, f = (cx - h, cy, z + rise), (cx + h, cy, z + rise)
        v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), e, f]
        faces = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)]
    else:
        h = (D - L) / 2; e, f = (cx, cy - h, z + rise), (cx, cy + h, z + rise)
        v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), e, f]
        faces = [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)]
    ob = mesh_obj(name, v, faces, material); fix_normals(ob); return ob

def cylinder(name, x, y, z0, z1, r, material, seg=12):
    v = []; 
    for z in (z0, z1):
        for i in range(seg): a = i / seg * 2 * math.pi; v.append((x + r * math.cos(a), y + r * math.sin(a), z))
    f = [tuple(range(seg - 1, -1, -1)), tuple(range(seg, 2 * seg))]
    for i in range(seg): j = (i + 1) % seg; f.append((i, j, seg + j, seg + i))
    ob = mesh_obj(name, v, f, material); return ob

def lathe_square(name, x, y, profile, material):
    """方形斷面沿高度變化（尖頂）：profile=[(z, half_size)...]"""
    v = []; f = []
    for (z, s) in profile: v += [(x - s, y - s, z), (x + s, y - s, z), (x + s, y + s, z), (x - s, y + s, z)]
    for k in range(len(profile) - 1):
        a = k * 4; b = a + 4
        for i in range(4): j = (i + 1) % 4; f.append((a + i, a + j, b + j, b + i))
    f.append((3, 2, 1, 0)); ob = mesh_obj(name, v, f, material); fix_normals(ob); return ob

def sphere(name, x, y, z, r, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=r, location=(x, y, z))
    ob = bpy.context.active_object; ob.name = name; ob.data.materials.append(material); return ob

def boolean_cut(target, cutters):
    if not cutters: return
    for c in cutters[1:]: c.select_set(True)
    bpy.ops.object.select_all(action='DESELECT')
    for c in cutters: c.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]; bpy.ops.object.join()
    cut = bpy.context.active_object
    mod = target.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.solver = 'EXACT'; mod.object = cut
    bpy.context.view_layer.objects.active = target; bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(cut, do_unlink=True)

def world_uv():
    """依每個面的法線方向投影世界座標成 UV（材質 tile 尺寸決定比例）"""
    for ob in bpy.data.objects:
        if ob.type != 'MESH': continue
        me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
        uvl = bm.loops.layers.uv.verify(); mw = ob.matrix_world
        for f in bm.faces:
            m = me.materials[f.material_index] if me.materials else None
            tu, tv = (m['tile'] if m and 'tile' in m else (1, 1))
            n = (mw.to_3x3() @ f.normal).normalized(); ax = max(range(3), key=lambda i: abs(n[i]))
            for l in f.loops:
                p = mw @ l.vert.co
                if ax == 2: u, v = p.x, p.y
                elif ax == 0: u, v = p.y * (1 if n.x > 0 else -1), p.z
                else: u, v = p.x * (-1 if n.y > 0 else 1), p.z
                l[uvl].uv = (u / tu, v / tv)
        bm.to_mesh(me); bm.free()

def export(path):
    world_uv()
    # 合併成一個物件（glTF 每種材質一個 primitive），網頁繪製較省
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_image_format='JPEG', export_jpeg_quality=85)
