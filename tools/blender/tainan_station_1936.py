# 臺南驛（1936 第二代站房）精細模型。
# 執行：python3 tools/blender/tainan_station_1936.py（需 pip install bpy）→ public/models/tainan-1936.glb
#
# 座標直接採用網頁臺南場景的「站區本地座標」：x 沿站房長軸（面向正面時往右為 +x）、
# y 向上、z 朝站前廣場；原點為 OSM relation 6477070 外框中心（見 src/tainan/osm.js）。
# Blender 內 X=x、Y=-z、Z=y，匯出 glTF（+Y up）後即為上述座標，網頁端不需旋轉或位移。
#
# 依據：OSM 站房外框（主體 x -26.7～24、後牆 z -17、門廊前緣 z≈21）、
# 1936 落成正面照（七扇二樓高拱窗、八道壁柱、中央圓形紋章、三拱門廊與兩側圓窗、
# 門廊上方低山形雨庇、右端塔屋與煙囪、兩端低矮廊棚）與 2024 修復照的面磚色。
# 各部高度由照片比例推算（以門廊拱高約 4.7 m 為基準），屬視覺推估，見 docs/tainan-evidence.md。
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
from common import reset, mat, mesh_obj, box, arch_outline, rect_outline, prism_on_face, frame_on_face, fix_normals, boolean_cut, export, TEX_DIR
import bpy
from PIL import Image, ImageDraw, ImageFilter

reset()
OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(os.path.dirname(__file__), '../../public/models/tainan-1936.glb')

# ── 貼圖 ──
def save(im, name):
    p = os.path.join(TEX_DIR, name + '.png'); im.save(p); return p

def tex_tile(name, base, joint, tw=24, th=8, size=512, seed=4, var=0.06):
    """細長面磚（實際約 22×6 cm）：1 張貼圖代表 2 m"""
    r = random.Random(seed); im = Image.new('RGB', (size, size), joint); d = ImageDraw.Draw(im)
    for j, y in enumerate(range(0, size, th)):
        off = (tw // 2) * (j % 2)
        for x in range(-tw, size + tw, tw):
            k = 1 + r.uniform(-var, var); c = tuple(max(0, min(255, int(v * k))) for v in base)
            d.rectangle([x + off + 1, y + 1, x + off + tw - 1, y + th - 1], fill=c)
    # 雨水垂流與風化
    ov = Image.new('L', (size, size), 0); od = ImageDraw.Draw(ov)
    for _ in range(40):
        x = r.randrange(size); w = r.randrange(2, 9); od.rectangle([x, 0, x + w, r.randrange(size // 3, size)], fill=r.randrange(10, 30))
    ov = ov.filter(ImageFilter.GaussianBlur(4)); dark = Image.new('RGB', (size, size), tuple(int(v * 0.72) for v in base))
    im = Image.composite(dark, im, ov)
    return save(im.filter(ImageFilter.GaussianBlur(0.4)), name)

def tex_stucco(name, base, size=256, seed=5):
    r = random.Random(seed); im = Image.new('RGB', (size, size), base); px = im.load()
    for y in range(size):
        for x in range(size):
            k = 1 + r.uniform(-0.035, 0.035); px[x, y] = tuple(max(0, min(255, int(v * k))) for v in base)
    return save(im.filter(ImageFilter.GaussianBlur(0.8)), name)

def tex_glass(name, rows=2, cols=2, size=256):
    """玻璃＋細格窗櫺：1 張代表 0.6 m（直）× 0.45 m（橫）"""
    im = Image.new('RGB', (size, size), (34, 44, 52)); d = ImageDraw.Draw(im)
    for y in range(size):
        t = y / size; d.line([0, y, size, y], fill=(int(40 + 30 * t), int(52 + 34 * t), int(62 + 36 * t)))
    m = (222, 218, 204)
    for k in range(cols + 1): x = int(k * size / cols); d.rectangle([x - 5, 0, x + 5, size], fill=m)
    for k in range(rows + 1): y = int(k * size / rows); d.rectangle([0, y - 5, size, y + 5], fill=m)
    return save(im, name)

def tex_frieze(name, size=256):
    """壁柱頭的格紋飾帶"""
    im = Image.new('RGB', (size, size // 2), (214, 205, 184)); d = ImageDraw.Draw(im)
    for k in range(0, size, 32):
        d.polygon([(k, 64), (k + 16, 16), (k + 32, 64), (k + 16, 112)], outline=(120, 110, 92), width=5)
    return save(im, name)

def tex_roof(name, size=256, seed=7):
    r = random.Random(seed); im = Image.new('RGB', (size, size), (118, 116, 108)); d = ImageDraw.Draw(im)
    for _ in range(300):
        x, y = r.randrange(size), r.randrange(size); c = r.randrange(90, 140); d.ellipse([x, y, x + 6, y + 6], fill=(c, c - 2, c - 8))
    return save(im.filter(ImageFilter.GaussianBlur(1.5)), name)

def tex_door(name, size=256):
    im = Image.new('RGB', (size, size), (22, 20, 18)); d = ImageDraw.Draw(im)
    for k in range(0, size, 64): d.rectangle([k + 6, 10, k + 58, size - 10], outline=(70, 58, 44), width=6)
    return save(im, name)

# 材質名稱固定：網頁端依名稱切換年代外觀（戰後白漆、夜間窗光、雨天濕面）
TILE = mat('tn_tile', tex=tex_tile('tn_tile', (205, 184, 146), (176, 160, 132)), scale=(2, 2), rough=0.72)
TRIM = mat('tn_trim', tex=tex_stucco('tn_trim', (226, 216, 194)), scale=(2, 2), rough=0.8)
PLINTH = mat('tn_plinth', tex=tex_tile('tn_plinth', (132, 118, 98), (98, 88, 74), tw=64, th=32, seed=9), scale=(2, 2), rough=0.85)
GLASS = mat('tn_glass', tex=tex_glass('tn_glass'), scale=(0.45, 0.6), rough=0.18)
GLASS_L = mat('tn_glass_low', tex=tex_glass('tn_glass_low', rows=3, cols=3), scale=(0.9, 0.9), rough=0.18)
FRIEZE = mat('tn_frieze', tex=tex_frieze('tn_frieze'), scale=(0.7, 0.35), rough=0.8)
ROOF = mat('tn_roof', tex=tex_roof('tn_roof'), scale=(4, 4), rough=0.95)
DARK = mat('tn_void', tex=tex_door('tn_door'), scale=(3, 3), rough=0.9)
METAL = mat('tn_metal', color=(0.10, 0.11, 0.10), rough=0.5, metal=0.6)
ORN = mat('tn_ornament', color=(0.42, 0.37, 0.29), rough=0.6, metal=0.2)

def L(x, y, z): return (x, -z, y)
def lbox(x0, x1, y0, y1, z0, z1, m, name='b'):
    return box(name, min(x0, x1), max(x0, x1), -max(z0, z1), -min(z0, z1), min(y0, y1), max(y0, y1), m)

# 面：front(z=常數, 法線 +z)、back(法線 -z)、left(x=常數, 法線 -x)、right(法線 +x)
def face(kind, c):
    if kind == 'front': return ((0, -c), (1, 0), (0, -1))
    if kind == 'back': return ((0, -c), (1, 0), (0, 1))
    if kind == 'left': return ((c, 0), (0, -1), (-1, 0))
    return ((c, 0), (0, -1), (1, 0))
def shift(f, d):
    (ox, oy), u, n = f; return ((ox + n[0] * d, oy + n[1] * d), u, n)
def flip(f):
    (ox, oy), u, n = f; return ((ox, oy), u, (-n[0], -n[1]))

details = []
def window(cuts, kind, c, u, z0, w, h, shape='arch', glass=GLASS, depth=0.32, sill=True, keystone=False, surround=0.16):
    """在牆面開洞（cuts 收集切割體）、內縮玻璃、外凸窗框與窗台。u 為沿牆座標（front/back 用 x，left/right 用 z）"""
    f = face(kind, c)
    outl = (arch_outline(w, h, 14, u, z0) if shape == 'arch' else rect_outline(w, h, u, z0))
    co = outl if z0 > 0.05 else (arch_outline(w, h + 0.4, 14, u, z0 - 0.4) if shape == 'arch' else rect_outline(w, h + 0.4, u, z0 - 0.4))
    cuts.append(prism_on_face('cut', co, flip(shift(f, 0.5)), 1.2 + depth, GLASS))
    details.append(prism_on_face('glass', outl, shift(f, -depth), 0.04, glass))
    if surround:
        o = arch_outline(w, h, 14, u, z0, surround) if shape == 'arch' else rect_outline(w, h, u, z0, surround)
        i = arch_outline(w, h, 14, u, z0) if shape == 'arch' else rect_outline(w, h, u, z0)
        details.append(frame_on_face('surround', o, i, f, 0.09, TRIM))
    if sill: details.append(prism_on_face('sill', rect_outline(w + 0.5, 0.14, u, z0 - 0.16), f, 0.2, TRIM))
    if keystone and shape == 'arch':
        details.append(prism_on_face('key', [(u - 0.22, z0 + h + w / 2 - 0.15), (u + 0.22, z0 + h + w / 2 - 0.15), (u + 0.3, z0 + h + w / 2 + 0.45), (u - 0.3, z0 + h + w / 2 + 0.45)], f, 0.16, TRIM))

def cornice(x0, x1, z0, z1, y, proj=0.35, h=0.45, m=TRIM):
    lbox(x0 - proj, x1 + proj, y, y + h * 0.45, z0 - proj, z1 + proj, m)
    lbox(x0 - proj * 0.55, x1 + proj * 0.55, y + h * 0.45, y + h, z0 - proj * 0.55, z1 + proj * 0.55, m)

def parapet(x0, x1, z0, z1, y, h=0.9, t=0.25):
    for (a, b, c, d) in ((x0, x1, z1 - t, z1), (x0, x1, z0, z0 + t), (x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1)):
        lbox(a, b, y, y + h, c, d, TILE)
    for (a, b, c, d) in ((x0, x1, z1 - t, z1), (x0, x1, z0, z0 + t), (x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1)):
        lbox(a - 0.08, b + 0.08, y + h, y + h + 0.14, c - 0.08, d + 0.08, TRIM)
    lbox(x0, x1, y - 0.05, y + 0.08, z0, z1, ROOF)

# ═════ 尺寸 ═════
XC = -4.0                    # 中央棟與門廊中心（OSM 門廊前緣 -12.2～4.1 的中點）
CB = (XC - 15.5, XC + 15.5)  # 中央棟 31 m
CBF, REAR = 14.0, -17.0      # 中央棟前牆、全棟後牆
CBH = 13.6                   # 中央棟簷口
LW = (-26.7, CB[0]); LWF, LWH = 2.2, 10.2   # 左翼（OSM 前緣 z=2.2）
RW = (CB[1], 24.0); RWF, RWH = 5.4, 10.2    # 右翼（OSM 前緣 z=5.4）
PO = (XC - 9.6, XC + 9.6); POF, POH = 20.6, 7.0  # 門廊

# ═════ 主量體（開窗以布林切割）═════
cb = lbox(CB[0], CB[1], 0, CBH, REAR, CBF, TILE, 'central')
lw = lbox(LW[0], LW[1], 0, LWH, REAR, LWF, TILE, 'leftwing')
rw = lbox(RW[0], RW[1], 0, RWH, REAR, RWF, TILE, 'rightwing')
tower = lbox(14.2, 19.6, 0, RWH + 4.2, -3.5, 1.8, TILE, 'tower')
po = lbox(PO[0], PO[1], 0, POH, CBF - 0.5, POF, TILE, 'porch')
cut_cb, cut_lw, cut_rw, cut_tw, cut_po = [], [], [], [], []

# 中央棟正面：二樓七扇高拱窗（直段 3.7 m + 半圓），窗台 7.5 m
UPX = [XC + k * 3.75 for k in range(-3, 4)]
for x in UPX: window(cut_cb, 'front', CBF, x, 7.5, 1.95, 3.7, keystone=True)
# 中央棟露出門廊上方以外的一樓（兩側）
for x in (CB[0] + 1.6, CB[1] - 1.6):
    window(cut_cb, 'front', CBF, x, 1.2, 1.4, 2.4, 'rect', GLASS_L)
# 中央棟背面（月臺側）：上層拱窗、下層出入口
for x in UPX: window(cut_cb, 'back', REAR, x, 7.5, 1.95, 3.7)
for x in [XC + k * 7.5 for k in (-1, 0, 1)]: window(cut_cb, 'back', REAR, x, 0.0, 3.0, 2.6, 'arch', DARK, depth=0.6, sill=False)
for x in [XC + k * 7.5 for k in (-1.5, -0.5, 0.5, 1.5)]: window(cut_cb, 'back', REAR, x, 1.1, 1.5, 2.4, 'rect', GLASS_L)
# 中央棟兩側（翼棟前方露出段）
for zc in (6.0, 10.5):
    window(cut_cb, 'left', CB[0], zc, 7.5, 1.6, 3.2)
    window(cut_cb, 'left', CB[0], zc, 1.2, 1.4, 2.4, 'rect', GLASS_L)
for zc in (9.8,):
    window(cut_cb, 'right', CB[1], zc, 7.5, 1.6, 3.2)
    window(cut_cb, 'right', CB[1], zc, 1.2, 1.4, 2.4, 'rect', GLASS_L)

# 左翼：正面上層兩扇拱窗、下層方窗；外側面成列
for x in (LW[0] + 2.0, LW[1] - 2.2):
    window(cut_lw, 'front', LWF, x, 6.0, 1.5, 2.3)
    window(cut_lw, 'front', LWF, x, 1.2, 1.4, 2.3, 'rect', GLASS_L)
for zc in [LWF - 3.2 - k * 3.6 for k in range(5)]:
    window(cut_lw, 'left', LW[0], zc, 6.0, 1.4, 2.2)
    window(cut_lw, 'left', LW[0], zc, 1.2, 1.3, 2.3, 'rect', GLASS_L)
for x in (LW[0] + 2.0, LW[1] - 2.2): window(cut_lw, 'back', REAR, x, 6.0, 1.5, 2.3)
# 右翼：正面上層三扇拱窗、下層方窗（鐵道飯店客室側）
for x in (RW[0] + 2.2, RW[0] + 6.2, RW[0] + 10.2):
    window(cut_rw, 'front', RWF, x, 6.0, 1.5, 2.3)
    window(cut_rw, 'front', RWF, x, 1.2, 1.4, 2.3, 'rect', GLASS_L)
for zc in [RWF - 3.0 - k * 3.6 for k in range(6)]:
    window(cut_rw, 'right', RW[1], zc, 6.0, 1.4, 2.2)
    window(cut_rw, 'right', RW[1], zc, 1.2, 1.3, 2.3, 'rect', GLASS_L)
for x in [RW[0] + 2.4 + k * 3.6 for k in range(3)]: window(cut_rw, 'back', REAR, x, 6.0, 1.4, 2.2)
# 塔屋小拱窗
window(cut_tw, 'front', 1.8, 16.9, RWH + 1.0, 1.0, 1.6)
window(cut_tw, 'right', 19.6, 0.8, RWH + 1.0, 0.9, 1.4)

# 門廊：三座大拱入口與兩側圓窗
ARX = [XC - 4.6, XC, XC + 4.6]
for x in ARX: window(cut_po, 'front', POF, x, 0.0, 3.5, 2.95, 'arch', DARK, depth=1.4, sill=False, surround=0.22)
for s in (-1, 1):
    x = XC + s * 7.6; f = face('front', POF)
    circ = [(x + 0.62 * math.cos(a * math.pi / 12), 3.35 + 0.62 * math.sin(a * math.pi / 12)) for a in range(24)]
    cut_po.append(prism_on_face('cut', circ, flip(shift(f, 0.5)), 1.2, GLASS))
    details.append(prism_on_face('glass', circ, shift(f, -0.3), 0.04, GLASS_L))
    ring_o = [(x + 0.86 * math.cos(a * math.pi / 12), 3.35 + 0.86 * math.sin(a * math.pi / 12)) for a in range(24)]
    details.append(frame_on_face('oculus', ring_o, circ, f, 0.14, TRIM))
for s in (-1, 1):  # 門廊側面入口
    window(cut_po, 'left' if s < 0 else 'right', PO[0] if s < 0 else PO[1], 17.6, 0.0, 2.4, 2.3, 'arch', DARK, depth=1.0, sill=False)

for tgt, cuts in ((cb, cut_cb), (lw, cut_lw), (rw, cut_rw), (tower, cut_tw), (po, cut_po)):
    boolean_cut(tgt, cuts)

# ═════ 立面細部 ═════
# 基座（深色面磚勒腳）
for (x0, x1, z0, z1, h) in ((CB[0], CB[1], REAR, CBF, 1.0), (LW[0], LW[1], REAR, LWF, 1.0), (RW[0], RW[1], REAR, RWF, 1.0), (PO[0], PO[1], CBF, POF, 1.15)):
    lbox(x0 - 0.12, x1 + 0.12, 0, h, z0 - 0.12, z1 + 0.12, PLINTH)
# 中央棟：八道壁柱（自門廊頂至女兒牆上方），柱頭格紋飾帶
PIL = [CB[0] + 0.45] + [x + 1.875 for x in UPX[:-1]] + [CB[1] - 0.45]
for x in PIL:
    lbox(x - 0.42, x + 0.42, POH, CBH + 1.1, CBF, CBF + 0.32, TILE)
    lbox(x - 0.5, x + 0.5, CBH - 1.25, CBH - 0.15, CBF + 0.32, CBF + 0.42, FRIEZE)
    lbox(x - 0.55, x + 0.55, CBH + 1.1, CBH + 1.35, CBF - 0.05, CBF + 0.47, TRIM)
    lbox(x - 0.3, x + 0.3, CBH + 1.35, CBH + 1.75, CBF + 0.05, CBF + 0.37, TRIM)
    lbox(x - 0.42, x + 0.42, 0.9, POH, REAR - 0.3, REAR, TILE)   # 背面亦設壁柱
# 二樓窗下腰帶、簷口、女兒牆
lbox(CB[0] - 0.15, CB[1] + 0.15, 6.95, 7.25, CBF, CBF + 0.3, TRIM)
cornice(CB[0], CB[1], REAR, CBF, CBH)
parapet(CB[0], CB[1], REAR, CBF, CBH + 0.45, 0.85)
# 中央紋章：圓環＋四瓣（照片中二樓中窗上方）
def disc(x, y, z, r, depth, m, seg=40, ring=None):
    f = face('front', z)
    outer = [(x + r * math.cos(a * 2 * math.pi / seg), y + r * math.sin(a * 2 * math.pi / seg)) for a in range(seg)]
    if ring:
        inner = [(x + ring * math.cos(a * 2 * math.pi / seg), y + ring * math.sin(a * 2 * math.pi / seg)) for a in range(seg)]
        details.append(frame_on_face('ring', outer, inner, f, depth, m))
    else:
        details.append(prism_on_face('disc', outer, f, depth, m))
MY = CBH + 0.55
lbox(XC - 1.9, XC + 1.9, CBH + 0.45, CBH + 1.9, CBF - 0.1, CBF + 0.25, TILE)    # 中央女兒牆加高
disc(XC, MY + 0.3, CBF + 0.25, 1.05, 0.22, TRIM, ring=0.72)
disc(XC, MY + 0.3, CBF + 0.25, 0.42, 0.3, ORN)
for a in range(4):
    ang = a * math.pi / 2; disc(XC + math.cos(ang) * 0.86, MY + 0.3 + math.sin(ang) * 0.86, CBF + 0.25, 0.28, 0.26, TRIM)
# 翼棟與塔屋：簷口、女兒牆、腰帶
for (x0, x1, zf, h) in ((LW[0], LW[1], LWF, LWH), (RW[0], RW[1], RWF, RWH)):
    lbox(x0 - 0.12, x1 + 0.12, 5.25, 5.5, REAR - 0.12, zf + 0.12, TRIM)
    cornice(x0, x1, REAR, zf, h, 0.3, 0.38)
    parapet(x0, x1, REAR, zf, h + 0.38, 0.7)
cornice(14.2, 19.6, -3.5, 1.8, RWH + 4.2, 0.25, 0.32)
parapet(14.2, 19.6, -3.5, 1.8, RWH + 4.5, 0.6)
# 塔屋上方小屋（水箱）與煙囪
lbox(15.0, 18.8, RWH + 5.1, RWH + 6.6, -2.8, 1.0, TILE); cornice(15.0, 18.8, -2.8, 1.0, RWH + 6.6, 0.18, 0.25)
lbox(20.6, 21.9, RWH, RWH + 8.4, -9.0, -7.6, TILE); lbox(20.45, 22.05, RWH + 8.4, RWH + 8.8, -9.15, -7.45, TRIM)
# 門廊：低山形雨庇、上方三角楣與紋飾、女兒牆
CY = 5.05
lbox(PO[0] - 1.4, PO[1] + 1.4, CY, CY + 0.32, POF - 0.2, POF + 2.1, TRIM)          # 雨庇版
lbox(PO[0] - 1.45, PO[1] + 1.45, CY + 0.32, CY + 0.55, POF + 1.85, POF + 2.15, TRIM)  # 雨庇鼻緣
lbox(PO[0] - 1.4, PO[1] + 1.4, CY - 0.18, CY, POF + 1.9, POF + 2.1, TRIM)
for x in [PO[0] - 0.8 + k * ((PO[1] - PO[0] + 1.6) / 8) for k in range(9)]:             # 托架
    details.append(prism_on_face('bracket', [(POF, CY - 0.7), (POF, CY), (POF + 1.6, CY)], ((x - 0.1, 0), (0, -1), (1, 0)), 0.2, TRIM))
f = face('front', POF)
details.append(prism_on_face('pediment', [(XC - 7.8, CY + 0.55), (XC + 7.8, CY + 0.55), (XC, CY + 1.55)], shift(f, 0.0), 0.35, TILE))
details.append(prism_on_face('pedcap', [(XC - 8.0, CY + 0.5), (XC + 8.0, CY + 0.5), (XC + 8.0, CY + 0.62), (XC, CY + 1.68), (XC - 8.0, CY + 0.62)], shift(f, 0.0), 0.5, TRIM))
details.append(prism_on_face('cartouche', [(XC - 1.3, CY + 0.7), (XC + 1.3, CY + 0.7), (XC + 1.5, CY + 0.95), (XC + 1.3, CY + 1.2), (XC - 1.3, CY + 1.2), (XC - 1.5, CY + 0.95)], shift(f, 0.35), 0.12, ORN))
cornice(PO[0], PO[1], CBF, POF, POH - 0.3, 0.2, 0.3)
parapet(PO[0], PO[1], CBF - 0.4, POF, POH, 0.6)
# 拱圈飾線（拱心磚）與門廊地坪、台階
for x in ARX:
    details.append(prism_on_face('archkey', [(x - 0.3, 4.55), (x + 0.3, 4.55), (x + 0.38, 5.0), (x - 0.38, 5.0)], f, 0.26, TRIM))
lbox(PO[0] - 1.2, PO[1] + 1.2, 0, 0.18, POF, POF + 2.6, PLINTH)
lbox(PO[0] + 0.2, PO[1] - 0.2, 0.18, 0.32, POF - 3, POF + 1.0, PLINTH)

# 兩端低矮廊棚（車寄／貨物出入口；鋼柱＋平頂）
def lowshed(x0, x1, z0, z1, h=3.9):
    lbox(x0, x1, h, h + 0.35, z0, z1, TRIM); lbox(x0, x1, h + 0.35, h + 0.5, z0, z1, ROOF)
    lbox(x0 - 0.05, x1 + 0.05, h - 0.25, h, z1 - 0.15, z1 + 0.05, TRIM)
    n = max(2, int(abs(x1 - x0) / 3.6))
    for k in range(n + 1):
        x = x0 + 0.3 + k * (x1 - x0 - 0.6) / n
        lbox(x - 0.11, x + 0.11, 0, h, z1 - 0.4, z1 - 0.18, METAL)
lowshed(-36.5, LW[0], -6.0, LWF + 1.5)
lowshed(RW[1], 32.0, -6.0, RWF + 0.5)
# 月臺側長廊雨庇（站房後簷，連接第一月臺）
lbox(LW[0], RW[1], 4.4, 4.7, REAR - 4.0, REAR, TRIM); lbox(LW[0], RW[1], 4.7, 4.82, REAR - 4.0, REAR, ROOF)
for x in [LW[0] + 1 + k * 4.9 for k in range(11)]: lbox(x - 0.1, x + 0.1, 0, 4.4, REAR - 3.8, REAR - 3.6, METAL)
# 屋頂設備
for (x, z) in ((XC - 8, -6), (XC + 6, -10), (-22, -10)): lbox(x - 1.2, x + 1.2, CBH + 0.4 if abs(x - XC) < 15 else LWH + 0.4, (CBH if abs(x - XC) < 15 else LWH) + 1.6, z - 1, z + 1, TILE)

export(OUT)
print('wrote', OUT)
