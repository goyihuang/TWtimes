# 臺南停車場（1900 第一代木造站房）與月臺鋼軌雨棚單元。
# 執行：python3 tools/blender/tainan_station_1900.py
#   → public/models/tainan-1900.glb、public/models/tainan-canopy.glb
# 座標同 tainan_station_1936.py（網頁站區本地座標；Blender X=x、Y=-z、Z=y）。
#
# 1900 站房依館藏「第一代木造站房（玄關迴廊未擴建／已擴建）」與 1931 朝日新聞正面照：
# 單層木構、日式寄棟瓦頂、屋脊飾件、中央玄關山牆（破風板飾緣）、正面連續迴廊（木柱、斜撐）。
# 原址與 1936 站房大致相同但確切位置與長寬未查得，長度 44 m 為照片比例推估。
# 雨棚依 1936 落成照與現存國定古蹟「鋼軌構築第一月臺候車棚」：中柱、雙向曲線托臂、雙坡鋼浪板。
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
from common import reset, mat, mesh_obj, box, rect_outline, prism_on_face, frame_on_face, fix_normals, hip_roof, export, TEX_DIR
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(__file__); MODELS = os.path.join(HERE, '../../public/models')

def save(im, name):
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p
def tex_kawara(name, size=256, seed=11):
    r = random.Random(seed); im = Image.new('RGB', (size, size), (58, 60, 62)); d = ImageDraw.Draw(im)
    for x in range(0, size, 32):
        k = r.uniform(0.85, 1.1); c = tuple(int(v * k) for v in (92, 95, 98))
        d.rectangle([x + 3, 0, x + 26, size], fill=c); d.line([x + 14, 0, x + 14, size], fill=tuple(int(v * 1.25) for v in c), width=3)
    for y in range(0, size, 42): d.line([0, y, size, y], fill=(40, 42, 44), width=3)
    return save(im, name)
def tex_siding(name, base=(168, 150, 118), size=256):
    im = Image.new('RGB', (size, size), base); d = ImageDraw.Draw(im)
    for y in range(0, size, 16): d.rectangle([0, y + 12, size, y + 16], fill=tuple(int(v * 0.66) for v in base))
    return save(im.filter(ImageFilter.GaussianBlur(0.5)), name)
def tex_glass(name, size=128):
    im = Image.new('RGB', (size, size), (40, 46, 50)); d = ImageDraw.Draw(im)
    for k in (0, size // 2, size): d.rectangle([k - 4, 0, k + 4, size], fill=(205, 196, 170)); d.rectangle([0, k - 4, size, k + 4], fill=(205, 196, 170))
    return save(im, name)
def tex_corrugated(name, size=128):
    im = Image.new('RGB', (size, size)); d = ImageDraw.Draw(im)
    for x in range(size): v = int(118 + 28 * math.sin(x / size * 2 * math.pi * 4)); d.line([x, 0, x, size], fill=(v, v + 2, v - 4))
    return save(im, name)

def L(x0, x1, y0, y1, z0, z1, m, name='b'):
    return box(name, min(x0, x1), max(x0, x1), -max(z0, z1), -min(z0, z1), min(y0, y1), max(y0, y1), m)
def beam(a, b, w, m):
    """局部座標 a=(x,y,z) 到 b 的方形斷面桿件"""
    import bpy
    from mathutils import Vector
    A, B = Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1]))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(A + B) / 2); o = bpy.context.active_object
    o.rotation_euler = (B - A).to_track_quat('Z', 'Y').to_euler(); o.scale = (w, w, (B - A).length); o.data.materials.append(m)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); return o

# ═════ 1900 木造站房 ═════
reset()
ROOF = mat('tn_kawara', tex=tex_kawara('tn_kawara'), scale=(0.9, 0.9), rough=0.7)
WALL = mat('tn_siding', tex=tex_siding('tn_siding'), scale=(1.2, 1.2), rough=0.9)
TIMBER = mat('tn_timber', color=(0.27, 0.19, 0.12), rough=0.85)
TRIM = mat('tn_trim_wood', color=(0.80, 0.75, 0.64), rough=0.8)
GLASS = mat('tn_glass', tex=tex_glass('tn_glass_wood'), scale=(0.9, 0.9), rough=0.2)
STONE = mat('tn_plinth', color=(0.45, 0.42, 0.38), rough=0.9)
VOID = mat('tn_void', color=(0.03, 0.03, 0.03), rough=1)

X0, X1, ZB, ZF, H = -28.0, 18.0, -12.0, 1.5, 4.4
L(X0, X1, 0, 0.6, ZB, ZF, STONE)
L(X0, X1, 0.6, H, ZB, ZF, WALL)
hip_roof('roof', X0, X1, -ZF, -ZB, H, 4.2, ROOF, overhang=0.9)
# 中央高棟（候車室）
CX0, CX1 = -11.0, 1.0
L(CX0, CX1, H, H + 1.6, ZB + 1, ZF, WALL)
hip_roof('roof2', CX0, CX1, -ZF, -(ZB + 1), H + 1.6, 4.4, ROOF, overhang=0.8)
# 屋脊飾件（照片中的鐵製棟飾）
for x in [v for v in [-21 + k * 0.9 for k in range(36)] if not (CX0 - 0.5 < v < CX1 + 0.5)]: L(x - 0.04, x + 0.04, H + 4.15, H + 4.6, -5.3, -5.2, TIMBER)
# 正面窗與門（直接貼於牆面外，含窗框，避免布林）
for x in [X0 + 2 + k * 3.2 for k in range(15)]:
    if CX0 - 1 < x < CX1 + 1: continue
    for (zf, face_n) in ((ZF, -1),):
        prism_on_face('g', rect_outline(1.3, 1.9, x, 1.3), ((0, -zf), (1, 0), (0, -1)), 0.03, GLASS)
        frame_on_face('f', rect_outline(1.3, 1.9, x, 1.3, 0.12), rect_outline(1.3, 1.9, x, 1.3), ((0, -zf), (1, 0), (0, -1)), 0.08, TRIM)
for x in (CX0 + 2.5, (CX0 + CX1) / 2, CX1 - 2.5):
    prism_on_face('d', rect_outline(2.2, 3.2, x, 0.6), ((0, -ZF), (1, 0), (0, -1)), 0.03, VOID)
    frame_on_face('df', rect_outline(2.2, 3.2, x, 0.6, 0.15), rect_outline(2.2, 3.2, x, 0.6), ((0, -ZF), (1, 0), (0, -1)), 0.1, TRIM)
# 迴廊（木柱、斜撐、單坡瓦頂）
VZ = ZF + 4.2
for x in [X0 + 0.4 + k * 3.0 for k in range(16)]:
    L(x - 0.11, x + 0.11, 0, 3.4, VZ - 0.11, VZ + 0.11, TIMBER)
    for s in (-1, 1): beam((x, 2.7, VZ), (x + s * 0.9, 3.35, VZ), 0.09, TIMBER)
L(X0, X1, 3.35, 3.6, VZ - 0.15, VZ + 0.15, TIMBER)
import bpy
def lean(x0, x1, z0, y0, z1, y1, m):
    v = [(x0, -z0, y0), (x1, -z0, y0), (x1, -z1, y1), (x0, -z1, y1)]
    o = mesh_obj('lean', v, [(0, 1, 2, 3)], m); o.modifiers.new('s', 'SOLIDIFY').thickness = 0.12
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='s'); return o
lean(X0 - 0.6, X1 + 0.6, ZF, H - 0.2, VZ + 0.6, 3.3, ROOF)
L(X0, X1, 0, 0.25, ZF, VZ + 0.5, STONE)
# 玄關山牆（破風、懸魚狀飾板）
GX0, GX1, GZ = -9.0, -1.0, VZ + 3.2; GC = (GX0 + GX1) / 2
for x in (GX0 + 0.2, GX1 - 0.2):
    for z in (VZ + 0.4, GZ - 0.2): L(x - 0.14, x + 0.14, 0, 4.0, z - 0.14, z + 0.14, TIMBER)
ridge = 4.0 + 2.6
for s in (-1, 1):
    v = [(GC + s * 0.0, -(ZF), ridge), (GC + s * 0.0, -(GZ + 0.6), ridge), (GC + s * 5.0, -(GZ + 0.6), 3.7), (GC + s * 5.0, -(ZF), 3.7)]
    o = mesh_obj('groof', v, [(0, 1, 2, 3)], ROOF); o.modifiers.new('s', 'SOLIDIFY').thickness = 0.14
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='s')
prism_on_face('gable', [(GC - 4.6, 4.0), (GC + 4.6, 4.0), (GC, ridge - 0.1)], ((0, -(GZ + 0.2)), (1, 0), (0, -1)), 0.12, WALL)
for s in (-1, 1):  # 破風板＋垂飾
    pts = []; n = 12
    for k in range(n + 1):
        t = k / n; x = GC + s * 5.0 * t; y = ridge - (ridge - 3.7) * t; pts.append((x, y))
    for k in range(n):
        (xa, ya), (xb, yb) = pts[k], pts[k + 1]
        prism_on_face('barge', [(xa, ya), (xb, yb), (xb, yb - 0.35), ((xa + xb) / 2, (ya + yb) / 2 - 0.55), (xa, ya - 0.35)], ((0, -(GZ + 0.65)), (1, 0), (0, -1)), 0.08, TRIM)
prism_on_face('gegyo', [(GC - 0.35, ridge - 0.3), (GC + 0.35, ridge - 0.3), (GC + 0.2, ridge - 1.4), (GC, ridge - 1.7), (GC - 0.2, ridge - 1.4)], ((0, -(GZ + 0.75)), (1, 0), (0, -1)), 0.1, TRIM)
L(GC - 3, GC + 3, 0, 0.3, VZ, GZ + 1, STONE)
export(os.path.join(MODELS, 'tainan-1900.glb'))

# ═════ 月臺鋼軌雨棚（單元長 6 m，沿 x 重複）═════
reset()
RAIL = mat('tn_railsteel', color=(0.16, 0.17, 0.16), rough=0.55, metal=0.55)
SHEET = mat('tn_canopy_sheet', tex=tex_corrugated('tn_corr'), scale=(0.6, 0.6), rough=0.6, metal=0.3)
LAMP = mat('tn_lamp', color=(0.95, 0.9, 0.8), rough=0.4)
W, HC = 3.6, 3.9
L(-0.09, 0.09, 0, HC, -0.12, 0.12, RAIL)
L(-0.2, 0.2, 0, 0.35, -0.25, 0.25, RAIL)
for s in (-1, 1):
    prev = (0, HC, 0)
    for k in range(1, 9):
        t = k / 8; z = s * W * t; y = HC + 0.6 - 0.55 * t * t
        beam(prev, (0, y, z), 0.11, RAIL); prev = (0, y, z)
    beam((0, HC - 0.9, 0), (0, HC + 0.5, s * 1.6), 0.08, RAIL)   # 斜撐
    for t in (0.33, 0.66, 1.0):
        z = s * W * t; y = HC + 0.6 - 0.55 * t * t
        L(-3.0, 3.0, y - 0.16, y - 0.06, z - 0.06, z + 0.06, RAIL)
    v = [(-3.0, 0, HC + 0.78), (3.0, 0, HC + 0.78), (3.0, -s * (W + 0.3), HC + 0.1), (-3.0, -s * (W + 0.3), HC + 0.1)]
    o = mesh_obj('sheet', v, [(0, 1, 2, 3)], SHEET); o.modifiers.new('s', 'SOLIDIFY').thickness = 0.04
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='s')
L(-3.0, 3.0, HC + 0.6, HC + 0.78, -0.1, 0.1, RAIL)
L(-0.18, 0.18, HC - 0.55, HC - 0.25, -0.18, 0.18, LAMP)
export(os.path.join(MODELS, 'tainan-canopy.glb'))
