# 臺中驛（1917 第二代站房）3D 模型，依日治時期舊照比例建模。
# 執行：python3 tools/blender/station1917.py（需 pip install bpy）
# 座標：x 沿長邊、+y 為正面（站前廣場）、z 向上；單位公尺。匯出 glTF 後正面朝本地 -z。
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *

reset()
L, D = 58.0, 14.8            # 主體長、深（對齊 OSM 輪廓）
X, YF, YB = L / 2, D / 2, -D / 2
EAVE = 12.6                  # 主體簷口高
PX, PF, PB, PH = 9.2, YF + 1.5, YB - 1.0, 17.6   # 中央山牆塊：半寬、前緣、後緣、高
EX0 = X - 6.0                # 兩端角樓起點

brick = mat('brick', tex=tex_brick('brick'), scale=(2, 1))
stone = mat('stone', color=(0.86, 0.83, 0.76), tex=tex_blocks('stone', (222, 214, 196)), scale=(2, 2), rough=0.8)
white = mat('white', color=(0.92, 0.9, 0.84), rough=0.7)
slate = mat('slate', tex=tex_slate('slate'), scale=(2, 2), rough=0.75)
glass = mat('glass', color=(0.035, 0.04, 0.045), rough=0.3, metal=0.1)
wood = mat('wood', color=(0.34, 0.24, 0.16), rough=0.9)
canopyM = mat('canopy', tex=tex_stripes('canopy', (112, 86, 62)), scale=(0.6, 0.6), rough=0.8)
towerM = mat('towerstone', tex=tex_blocks('tower', (150, 152, 138), bw=96, bh=48), scale=(1.6, 1.6), rough=0.85)
copper = mat('copper', color=(0.36, 0.5, 0.42), rough=0.55, metal=0.3)
clockM = mat('clock', tex=tex_clock('clock'), scale=(1, 1), rough=0.5)

FRONT = ((0, YF), (1, 0), (0, 1)); BACK = ((0, YB), (-1, 0), (0, -1))
def plane(face, y=None, x=None):
    (ox, oy), u, n = face
    return ((ox if x is None else x, oy if y is None else y), u, n)

# ── 主體 ──
main = box('main', -X, X, YB, YF, 0, EAVE, brick)
pav = box('pavilion', -PX, PX, PB, PF, 0, PH, brick)
ends = [box('end%d' % s, (EX0 if s > 0 else -X - 0.4), (X + 0.4 if s > 0 else -EX0), YB - 0.5, YF + 0.5, 0, EAVE + 1.6, brick) for s in (-1, 1)]

cut_main, cut_pav, cut_end = [], [], []
GW, GH, GZ = 1.5, 2.5, 1.3      # 一樓窗
UW, UH, UZ = 1.3, 2.0, 8.3      # 二樓拱窗（直段高 + 半圓）
bays = [x for x in [-21.6 + 4.32 * i for i in range(11)] if abs(x) > PX + 1.2]
details = []
def window(face, u, kind, cuts, yface, inward):
    if kind == 'g': out = rect_outline(GW, GH, u, GZ); fr_o = rect_outline(GW, GH, u, GZ, 0.22); fr_i = rect_outline(GW, GH, u, GZ, 0.0)
    else: out = arch_outline(UW, UH, 10, u, UZ); fr_o = arch_outline(UW, UH, 10, u, UZ, 0.24); fr_i = arch_outline(UW, UH, 10, u, UZ, 0.0)
    (ox, oy), du, n = face
    cuts.append(prism_on_face('c', out, ((ox, yface + n[1] * 0.2), du, (0, -n[1])), 0.7, glass))
    details.append(prism_on_face('g', out, ((ox, yface - n[1] * 0.35), du, (0, n[1])), 0.03, glass))
    details.append(frame_on_face('f', fr_o, fr_i, ((ox, yface), du, (0, n[1])), 0.12, white))
    # 窗台
    z0 = GZ if kind == 'g' else UZ; w = (GW if kind == 'g' else UW) + 0.6
    details.append(prism_on_face('s', rect_outline(w, 0.15, u, z0 - 0.32), ((ox, yface), du, (0, n[1])), 0.2, white))
    if kind == 'u': details.append(prism_on_face('k', rect_outline(0.32, 0.5, u, UZ + UH + UW / 2 - 0.05), ((ox, yface), du, (0, n[1])), 0.18, white))

for face, yf in ((FRONT, YF), (BACK, YB)):
    for x in bays:
        u = x if face is FRONT else -x
        for k in ('g', 'u'): window(face, u, k, cut_main, yf, None)
# 兩端角樓（正背面各一組）
cut_side = {-1: [], 1: []}
for s in (-1, 1):
    for face, yf in ((FRONT, YF + 0.5), (BACK, YB - 0.5)):
        u = s * (X - 3.0) * (1 if face is FRONT else -1)
        for k in ('g', 'u'): window(face, u, k, cut_side[s], yf, None)
boolean_cut(main, cut_main)
boolean_cut(ends[0], cut_side[-1]); boolean_cut(ends[1], cut_side[1])

# ── 中央山牆塊：三扇通高拱窗、角柱、荷蘭式曲線山頭 ──
cut_p = []
for u in (-3.0, 0.0, 3.0):
    out = arch_outline(2.0, 6.0, 12, u, 9.8)
    cut_p.append(prism_on_face('c', out, ((0, PF + 0.2), (1, 0), (0, -1)), 0.7, glass))
    details.append(prism_on_face('g', out, ((0, PF - 0.35), (1, 0), (0, 1)), 0.03, glass))
    details.append(frame_on_face('f', arch_outline(2.0, 6.0, 12, u, 9.8, 0.28), out, ((0, PF), (1, 0), (0, 1)), 0.14, white))
    # 窗格
    for k in (-0.33, 0.33): details.append(box('m', u + k - 0.04, u + k + 0.04, PF - 0.33, PF - 0.28, 9.8, 16.8, white))
    for z in (11.8, 13.8, 15.8): details.append(box('t', u - 1.0, u + 1.0, PF - 0.33, PF - 0.28, z, z + 0.06, white))
# 一樓三個入口
for u in (-3.5, 0.0, 3.5):
    out = arch_outline(2.2, 2.4, 10, u, 0.6)
    cut_p.append(prism_on_face('c', out, ((0, PF + 0.2), (1, 0), (0, -1)), 0.8, glass))
    details.append(prism_on_face('g', out, ((0, PF - 0.45), (1, 0), (0, 1)), 0.03, wood))
    details.append(frame_on_face('f', arch_outline(2.2, 2.4, 10, u, 0.6, 0.25), out, ((0, PF), (1, 0), (0, 1)), 0.14, white))
boolean_cut(pav, cut_p)
# 角柱（白色石造隅柱，往上突出成裝飾塔）
for s in (-1, 1):
    x = s * (PX - 0.8)
    details.append(box('pier', x - 0.9, x + 0.9, PF - 0.2, PF + 0.35, 0, PH + 2.2, brick))
    for z in (4.6, 8.9, 12.6, PH - 0.6): details.append(box('q', x - 0.95, x + 0.95, PF - 0.25, PF + 0.45, z, z + 0.3, white))
    details.append(box('pcap', x - 1.1, x + 1.1, PF - 0.4, PF + 0.6, PH + 2.2, PH + 2.6, white))
    details.append(box('ped', x - 0.6, x + 0.6, PF - 0.1, PF + 0.3, PH + 2.6, PH + 3.4, white))
    details.append(sphere('urn', x, PF + 0.1, PH + 3.9, 0.55, white))
# 山牆塊白帶與簷口
for (z0, z1, d) in ((0.0, 0.8, 0.12), (4.6, 4.9, 0.1), (8.9, 9.5, 0.15), (PH - 0.6, PH, 0.35)):
    details.append(box('band', -PX - d, PX + d, PB - d, PF + d, z0, z1, white if z0 > 0 else stone))
# 中央匾額
details.append(box('plaque', -2.2, 2.2, PF, PF + 0.1, 9.0, 9.4, mat('plaque', color=(0.25, 0.2, 0.15))))
# 荷蘭式曲線山頭（正面），後方人字屋頂
def dutch(w, h, n=24):
    pts = [(-w / 2, 0), (w / 2, 0)]
    for i in range(n + 1):
        t = i / n; x = w / 2 * (1 - t)
        # 兩段 S 形：肩部渦卷 + 中央高起
        z = h * (0.55 * math.sin(min(1, t * 2) * math.pi / 2) + 0.45 * max(0, (t - 0.45) / 0.55) ** 0.7)
        pts.append((x, z))
    for i in range(1, n + 1):
        t = 1 - i / n; x = -w / 2 * (1 - t)
        z = h * (0.55 * math.sin(min(1, t * 2) * math.pi / 2) + 0.45 * max(0, (t - 0.45) / 0.55) ** 0.7)
        pts.append((x, z))
    return pts[:1] + pts[2:] + [pts[1]] if False else pts
gable = dutch(13.6, 4.2)
gable_outline = [(x, PH + z) for (x, z) in [gable[0]] + gable[2:] + [gable[1]]]
details.append(prism_on_face('gable', gable_outline, ((0, PF - 0.5), (1, 0), (0, 1)), 0.7, brick))
details.append(frame_on_face('gfr', [(x * 1.04, PH + (z - PH) * 1.05 + 0.0) for (x, z) in gable_outline], gable_outline, ((0, PF - 0.5), (1, 0), (0, 1)), 0.85, white))
details.append(cylinder('cart', 0, PF + 0.3, PH + 1.4, PH + 1.4, 0.0, white))  # 佔位
bpy.data.objects.remove(details.pop(), do_unlink=True)
# 山頭中央圓形徽飾
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.9, depth=0.25, location=(0, PF + 0.3, PH + 1.8), rotation=(math.pi / 2, 0, 0)); o = bpy.context.active_object; o.data.materials.append(white)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.55, depth=0.3, location=(0, PF + 0.35, PH + 1.8), rotation=(math.pi / 2, 0, 0)); o = bpy.context.active_object; o.data.materials.append(copper)
# 山牆塊屋頂（人字，屋脊沿 y）
def gable_roof(name, x0, x1, y0, y1, z, rise, m, oh=0.4):
    x0 -= oh; x1 += oh; cx = (x0 + x1) / 2
    v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), (cx, y0, z + rise), (cx, y1, z + rise)]
    ob = mesh_obj(name, v, [(0, 3, 5, 4), (1, 4, 5, 2)], m); fix_normals(ob); return ob
gable_roof('pavroof', -PX, PX, PB - 0.3, PF - 0.5, PH, 4.6, slate)

# ── 主屋頂（高聳四坡）、簷口、白帶 ──
hip_roof('roof', -X, X, YB, YF, EAVE + 0.6, 8.2, slate, overhang=0.6)
for s in (-1, 1):
    x0, x1 = (EX0, X + 0.4) if s > 0 else (-X - 0.4, -EX0)
    hip_roof('endroof%d' % s, x0, x1, YB - 0.5, YF + 0.5, EAVE + 2.2, 5.0, slate, overhang=0.4)
    details.append(box('endcorn', x0 - 0.35, x1 + 0.35, YB - 0.85, YF + 0.85, EAVE + 1.6, EAVE + 2.2, white))
    for (z0, z1) in ((4.6, 4.9), (7.75, 8.0)): details.append(box('eb', x0 - 0.08, x1 + 0.08, YB - 0.58, YF + 0.58, z0, z1, white))
    details.append(box('ep', x0 - 0.12, x1 + 0.12, YB - 0.62, YF + 0.62, 0, 0.8, stone))
    # 煙囪
    cx = s * (X - 9.5)
    details.append(box('chim', cx - 0.6, cx + 0.6, -0.6, 0.6, EAVE + 4, EAVE + 9.6, brick)); details.append(box('chc', cx - 0.75, cx + 0.75, -0.75, 0.75, EAVE + 9.6, EAVE + 9.9, white))
for (z0, z1, d) in ((0.0, 0.8, 0.12), (4.6, 4.9, 0.08), (7.75, 8.0, 0.08), (EAVE - 0.1, EAVE + 0.6, 0.4)):
    details.append(box('band', -X - d, X + d, YB - d, YF + d, z0, z1, white if z0 > 0 else stone))
# ── 鐘塔（山牆塊後方屋頂上）──
TY, TB, TS = -1.5, PH + 4.2, 2.2
details.append(box('tbase', -TS - 0.2, TS + 0.2, TY - TS - 0.2, TY + TS + 0.2, PH, TB, towerM))
details.append(box('tbody', -TS, TS, TY - TS, TY + TS, TB, TB + 4.4, towerM))
for sx in (-1, 1):
    for sy in (-1, 1): details.append(cylinder('tc', sx * (TS + 0.05), TY + sy * (TS + 0.05), TB + 0.3, TB + 4.2, 0.28, towerM))
details.append(box('tcorn', -TS - 0.6, TS + 0.6, TY - TS - 0.6, TY + TS + 0.6, TB + 4.4, TB + 5.0, towerM))
for (cx, cy, rot) in ((0, TY + TS + 0.02, 0), (0, TY - TS - 0.02, math.pi), (TS + 0.02, TY, -math.pi / 2), (-TS - 0.02, TY, math.pi / 2)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.9, depth=0.1, location=(cx, cy, TB + 2.4), rotation=(math.pi / 2, 0, rot)); o = bpy.context.active_object; o.data.materials.append(clockM)
    # 弧形山花
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.0, depth=0.5, location=(cx * 1.12, TY + (cy - TY) * 1.12, TB + 5.0), rotation=(math.pi / 2, 0, rot)); o = bpy.context.active_object; o.data.materials.append(towerM)
lathe_square('spire', 0, TY, [(TB + 5.0, 1.9), (TB + 5.6, 1.35), (TB + 6.4, 0.85), (TB + 7.3, 0.5), (TB + 8.2, 0.28), (TB + 8.8, 0.16)], copper)
details.append(cylinder('mast', 0, TY, TB + 8.8, TB + 11.0, 0.06, copper, 6))
details.append(sphere('mball', 0, TY, TB + 9.0, 0.22, copper))

# ── 正面長廊（雨庇）：木柱、斜屋頂、簷板 ──
CX0, CX1, CY0, CY1 = -37.0, 37.0, YF, YF + 7.0
Z_IN, Z_OUT = 6.4, 5.0
v = [(CX0, CY0, Z_IN), (CX1, CY0, Z_IN), (CX1, CY1, Z_OUT), (CX0, CY1, Z_OUT)]
v += [(x, y, z - 0.12) for (x, y, z) in v]
c = mesh_obj('canopy', v, [(0, 1, 2, 3), (7, 6, 5, 4), (3, 2, 6, 7), (0, 3, 7, 4), (1, 0, 4, 5), (2, 1, 5, 6)], canopyM); fix_normals(c)
details.append(box('fascia', CX0, CX1, CY1 - 0.05, CY1 + 0.05, Z_OUT - 0.6, Z_OUT, white))
details.append(box('beam', CX0, CX1, CY1 - 0.4, CY1 - 0.15, Z_OUT - 0.55, Z_OUT - 0.25, wood))
for i in range(18):
    x = CX0 + 0.6 + i * (CX1 - CX0 - 1.2) / 17
    details.append(cylinder('col', x, CY1 - 0.3, 0, Z_OUT - 0.5, 0.14, white, 10))
    details.append(box('cap', x - 0.3, x + 0.3, CY1 - 0.6, CY1, Z_OUT - 0.65, Z_OUT - 0.5, white))
    details.append(box('base', x - 0.25, x + 0.25, CY1 - 0.55, CY1 - 0.05, 0, 0.3, stone))
    # 斜撐
    details.append(box('br', x - 0.06, x + 0.06, CY1 - 1.4, CY1 - 0.3, Z_OUT - 1.2, Z_OUT - 1.1, wood))

export(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../public/models/station1917.glb'))
print('done', len(bpy.data.objects), 'objects')
