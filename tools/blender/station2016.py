# 臺中車站（2016 高架新站）3D 模型，依現況照片：
# 兩道高聳的深灰金屬拱頂沿軌道並排、中央一道橫向拱頂交叉（「蝴蝶展翅」，頂高約 37m），
# 拱頂兩端是開放的拱形端面（玻璃＋直向鰭板），兩側較低的弧形屋頂鋪太陽能板，
# 白色樹狀鋼柱立在陶磚色墩柱上；下方是混凝土＋鋁百葉＋玻璃的兩層站體與月台高架。
# 座標：x 沿軌道；+y 朝站前廣場（臺灣大道側）；原點＝OSM 輪廓外接矩形中心。執行：python3 tools/blender/station2016.py
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from common import *

reset()
metal = mat('roofmetal', tex=tex_stripes('roofmetal', (74, 75, 78), period=12, dark=0.85), scale=(1.2, 1.2), rough=0.6, metal=0.25)
solar = mat('solar', tex=tex_blocks('solar', (34, 42, 62), bw=96, bh=64), scale=(4, 2.5), rough=0.35, metal=0.2)
steel = mat('steel', color=(0.9, 0.91, 0.92), rough=0.4, metal=0.3)
terra = mat('terracotta', tex=tex_blocks('terra', (176, 104, 70), bw=128, bh=32), scale=(1.2, 0.6), rough=0.8)
concrete = mat('concrete', tex=tex_blocks('concrete', (184, 178, 168), bw=256, bh=128), scale=(6, 3), rough=0.9)
louver = mat('louver', tex=tex_stripes('louver', (196, 198, 196), period=8, dark=0.7), scale=(0.25, 0.25), rough=0.6)
glass = mat('glass', color=(0.1, 0.14, 0.17), rough=0.1, metal=0.5)
endglass = mat('endglass', color=(0.12, 0.15, 0.18), rough=0.15, metal=0.4)

DECK = 10.5                       # 月台層高度（配合場景高架橋 10m）
TRACK_Y = -42.0                   # 軌道中心（OSM 軌道在輪廓靠北側）
VAULTS = [TRACK_Y + 14, TRACK_Y - 14]   # 兩道拱頂中心
HW, SPRING, APEX = 15.0, DECK + 4.5, 37.0
VX = 70.0                         # 拱頂半長

def profile(t):  # t∈[-1,1] → 高度（略尖的橢圓拱）
    return SPRING + (APEX - SPRING) * (max(0.0, 1 - t * t)) ** 0.62

def vault_along_x(name, cy, x0, x1, hw, prof, m, segs=28, thick=0.5):
    """沿 x 的筒形屋頂：斷面為 prof(t)"""
    v, f = [], []
    ts = [-1 + 2 * i / segs for i in range(segs + 1)]
    for layer, dz in ((0, 0.0), (1, -thick)):
        for x in (x0, x1):
            for t in ts: v.append((x, cy + t * hw, prof(t) + dz))
    n = segs + 1
    def idx(layer, end, i): return layer * 2 * n + end * n + i
    for i in range(segs):
        f.append((idx(0, 0, i), idx(0, 1, i), idx(0, 1, i + 1), idx(0, 0, i + 1)))
        f.append((idx(1, 0, i + 1), idx(1, 1, i + 1), idx(1, 1, i), idx(1, 0, i)))
        for end in (0, 1): f.append((idx(0, end, i), idx(0, end, i + 1), idx(1, end, i + 1), idx(1, end, i)))
    ob = mesh_obj(name, v, f, m); fix_normals(ob); return ob

def vault_along_y(name, cx, y0, y1, hw, prof, m, segs=28, thick=0.5):
    v, f = [], []
    ts = [-1 + 2 * i / segs for i in range(segs + 1)]
    for dz in (0.0, -thick):
        for y in (y0, y1):
            for t in ts: v.append((cx + t * hw, y, prof(t) + dz))
    n = segs + 1
    def idx(layer, end, i): return layer * 2 * n + end * n + i
    for i in range(segs):
        f.append((idx(0, 0, i), idx(0, 0, i + 1), idx(0, 1, i + 1), idx(0, 1, i)))
        f.append((idx(1, 0, i), idx(1, 1, i), idx(1, 1, i + 1), idx(1, 0, i + 1)))
    ob = mesh_obj(name, v, f, m); fix_normals(ob); return ob

def arch_end(name, cy, x, hw, prof, segs=28):
    """拱頂端面：退縮的玻璃面 + 直向鰭板 + 白色鋼拱"""
    pts = [(cy + (-1 + 2 * i / segs) * hw, prof(-1 + 2 * i / segs)) for i in range(segs + 1)]
    v = [(x, y, z) for (y, z) in pts] + [(x, cy + hw, SPRING), (x, cy - hw, SPRING)]
    ob = mesh_obj(name, v, [tuple(range(len(v)))], endglass); fix_normals(ob)
    for k in range(-13, 14, 2):  # 鰭板
        y = cy + k; t = (y - cy) / hw; top = prof(max(-1, min(1, t))) - 0.4
        box('fin', x - 0.6, x + 0.6, y - 0.08, y + 0.08, SPRING, top, steel)
    for i in range(segs):  # 端部鋼拱
        (y0, z0), (y1, z1) = pts[i], pts[i + 1]
        sx = 0.5
        v = [(x - sx, y0, z0), (x + sx, y0, z0), (x + sx, y1, z1), (x - sx, y1, z1), (x - sx, y0, z0 - 0.9), (x + sx, y0, z0 - 0.9), (x + sx, y1, z1 - 0.9), (x - sx, y1, z1 - 0.9)]
        o = mesh_obj('rib', v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], steel); fix_normals(o)

# ── 兩道主拱頂（沿軌道）──
for cy in VAULTS:
    vault_along_x('vault', cy, -VX, VX, HW, profile, metal)
    for x in (-VX, VX): arch_end('end', cy, x, HW, profile)
# ── 中央橫向拱頂（交叉成蝴蝶狀），中段玻璃天窗 ──
CXW = 13.0
vault_along_y('cross', 0, TRACK_Y - 31, TRACK_Y + 31, CXW, lambda t: SPRING + (APEX + 0.6 - SPRING) * (max(0, 1 - t * t)) ** 0.62, metal)
for y in (TRACK_Y - 31, TRACK_Y + 31):
    pts = [((-1 + 2 * i / 28) * CXW, SPRING + (APEX + 0.6 - SPRING) * (max(0, 1 - ((-1 + 2 * i / 28)) ** 2)) ** 0.62) for i in range(29)]
    v = [(x, y, z) for (x, z) in pts] + [(CXW, y, SPRING), (-CXW, y, SPRING)]
    o = mesh_obj('crossend', v, [tuple(range(len(v)))], endglass); fix_normals(o)
    for k in range(-12, 13, 2):
        t = k / CXW; box('fin', k - 0.08, k + 0.08, y - 0.6, y + 0.6, SPRING, SPRING + (APEX + 0.6 - SPRING) * (max(0, 1 - t * t)) ** 0.62 - 0.4, steel)
box('skylight', -2.5, 2.5, TRACK_Y - 30, TRACK_Y + 30, APEX + 0.55, APEX + 0.75, glass)

# ── 兩側較低的弧形太陽能屋頂 ──
LOW_SP, LOW_AP, LW = DECK + 5.5, DECK + 11.0, 31.0
lowp = lambda t: LOW_SP + (LOW_AP - LOW_SP) * (1 - t * t) ** 0.5
for (x0, x1) in ((-155, -VX), (VX, 155)):
    vault_along_x('low', TRACK_Y, x0, x1, LW, lowp, metal, segs=20, thick=0.4)
    # 太陽能板帶
    for t0 in (-0.55, 0.15):
        v = []
        for x in (x0 + 3, x1 - 3):
            for t in (t0, t0 + 0.4): v.append((x, TRACK_Y + t * LW, lowp(t) + 0.15))
        o = mesh_obj('pv', [v[0], v[2], v[3], v[1]], [(0, 1, 2, 3)], solar); fix_normals(o)

# ── 樹狀鋼柱：陶磚色墩柱 + 白色 Y 形分枝 ──
def tree_col(x, y, top):
    box('pier', x - 1.0, x + 1.0, y - 1.0, y + 1.0, 0, DECK + 1.5, terra)
    for dx in (-3.5, 3.5):
        for dy in (-1.2, 1.2):
            # 斜撐：從墩頂到屋頂邊
            a = Vector((x, y, DECK + 1.5)); b = Vector((x + dx, y + dy, top))
            d = b - a; L = d.length
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.28, depth=L, location=(a + b) / 2)
            o = bpy.context.active_object; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); o.data.materials.append(steel)
for cy in VAULTS:
    for s in (-1, 1):
        y = cy + s * (HW - 0.5)
        if abs(y - TRACK_Y) < 3: continue
        for x in range(-60, 61, 20): tree_col(x, y, SPRING)
for (x0, x1) in ((-150, -80), (80, 150)):
    for x in range(x0, x1 + 1, 20):
        for s in (-1, 1): tree_col(x, TRACK_Y + s * (LW - 1.0), LOW_SP)

# ── 月台高架層（軌道下的站體）與月台護欄 ──
box('deck', -155, 155, TRACK_Y - 30, TRACK_Y + 30, DECK - 1.2, DECK, concrete)
box('rail_s', -155, 155, TRACK_Y + 29.6, TRACK_Y + 30, DECK, DECK + 1.2, steel)
box('rail_n', -155, 155, TRACK_Y - 30, TRACK_Y - 29.6, DECK, DECK + 1.2, steel)
# 一樓／二樓站體（沿軌道下方）：混凝土框＋鋁百葉＋玻璃
box('podium', -150, 150, TRACK_Y - 26, TRACK_Y + 26, 0, DECK - 1.2, louver)
for x in range(-150, 151, 12): box('frame', x - 0.6, x + 0.6, TRACK_Y + 25.6, TRACK_Y + 26.4, 0, DECK - 1.2, concrete)
box('glassband', -150, 150, TRACK_Y + 26.05, TRACK_Y + 26.1, 0.3, 3.6, glass)
box('slab', -152, 152, TRACK_Y + 25, TRACK_Y + 29, 4.6, 5.2, concrete)  # 二樓走廊雨庇
# 面向廣場的大廳（輪廓南側凸出部分）
HY0, HY1 = TRACK_Y + 26, 30.0
box('hall', -60, 28, HY0, HY1, 0, DECK + 3.5, concrete)
box('hallglass', -56, 24, HY1, HY1 + 0.1, 0.4, DECK + 2.5, glass)
for x in range(-56, 25, 4): box('mull', x - 0.12, x + 0.12, HY1, HY1 + 0.4, 0.4, DECK + 2.5, steel)
box('hallroof', -62, 30, HY0 - 1, HY1 + 6, DECK + 3.5, DECK + 4.2, concrete)
for x in (-50, -26, -2, 22): tree_col(x, HY1 + 4, DECK + 3.6)
# 站名塔（白底藍字的直立招牌）
box('signtower', 34, 37, HY1 + 4, HY1 + 6, 0, 11, mat('sign', color=(0.95, 0.95, 0.95), rough=0.5))
box('signtowerb', 33.6, 37.4, HY1 + 3.6, HY1 + 6.4, 0, 1.2, concrete)

export(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../public/models/station2016.glb'))
print('done')
