#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
潮汐书 · 海南 —— 图鉴插页图版处理  (R0 / plate-maker)

raw (gpt-image-2 1536x1024) -> treated (1200px 长边, WebP q80, <300KB)
raw 原样保留在 assets/plates/raw/。

统一配方（三张同一条流水线，只换本幕 palette / crop）：
  1. 裁切（04 只取一段安静的航线局部）→ 缩到长边 1200px
  2. 软化 0.6–0.9px（去掉 AI 照片的数码锐边）
  3. 印刷调子：抬黑场（不留纯黑）、压白场（不留纯白）、很轻的局部对比
  4. 双色调 LUT：本幕 6–7 个色标，锁进 ART-DIRECTION 的 tokens
  5. 网点：3.2px 栅格 / 27° 网角，圆点面积律（点径约 1.3–2.4px）；
     点边叠低频噪声再阈值，模拟油墨扩张；屏幕版与双色调 3:1 叠合，大调子不变
  6. 专色版：§8C4A38 锈红 / #E2452F 活珊瑚 / #7FE3D4 荧光青 / #C9A96A 星金
     04 不用红：只留墨 + 骨白纸 + 星金
  7. 套印偏移：每个专色版整体平移 1–2.5px，走版边自然出彩边
  8. 颗粒 + 低频斑驳 + 纸纤维 + 版边微压
  9. WebP q80（预览 PNG 留 _work/）

用法:
  python make_plates.py                            # 按 picks.json 出片
  python make_plates.py compare 01:01-a 04:04-a    # 只出对比预览
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PLATES = os.path.dirname(HERE)            # hainan/assets/plates
RAW = os.path.join(PLATES, "raw")
TREATED = os.path.join(PLATES, "treated")

LONG_EDGE = 1200
SEED = 20261023
SCREEN_PITCH = 3.2
SCREEN_ANGLE = 27.0

# ---------------------------------------------------------------- palettes
# 贴 ART-DIRECTION：01 锈红 #8C4A38 / 石灰白 #E8E2D4
#                   03 活珊瑚 #E2452F / 荧光青 #7FE3D4
#                   04 星金 #C9A96A / 纸 #E9DFC9 / 墨 #111310
PAL = {
    "01": dict(
        crop=None,
        # 01 向墨 / 骨 / 锈红拉：中性暖灰，压掉橄榄绿
        ramp=[
            (0.00, (15, 17, 16)),
            (0.18, (33, 35, 33)),
            (0.38, (69, 69, 64)),
            (0.58, (116, 113, 103)),
            (0.76, (170, 164, 150)),
            (0.90, (212, 205, 191)),
            (1.00, (232, 226, 212)),
        ],
        black=0.02, white=0.96, gamma=0.96, contrast=0.94,
        floor=0.08, soft=1.7, local_contrast=0.10, local_radius=56,
        screen=0.18, grain=0.13,
        masks=dict(red=(0.11, 0.28), gold=(0.16, 0.32), cyan=(0.10, 0.24),
                   lum_lo=0.10, lum_hi=0.32, hi=(0.62, 0.92)),
        spots=[
            ("rust",      (140, 74, 56),  "multiply", "red",    (2, -1), 1.00),
            ("limestone", (232, 226, 212), "screen",   "hi",     (-1, 2), 0.12),
            ("ink2",      (17, 19, 16),   "multiply", "shadow", (-1, 2), 0.34),
        ],
    ),
    "03": dict(
        crop=None,
        ramp=[
            (0.00, (4, 17, 15)),
            (0.18, (10, 31, 28)),
            (0.38, (18, 48, 44)),
            (0.58, (29, 70, 64)),
            (0.76, (62, 110, 102)),
            (0.90, (157, 179, 170)),
            (1.00, (232, 226, 212)),
        ],
        black=0.00, white=0.85, gamma=1.12, contrast=1.02,
        floor=0.10, soft=0.8, local_contrast=0.14, local_radius=44,
        screen=0.24, grain=0.90,
        masks=dict(red=(0.22, 0.44), gold=(0.16, 0.34), cyan=(0.07, 0.22),
                   lum_lo=0.08, lum_hi=0.30, hi=(0.60, 0.90)),
        spots=[
            ("coral", (226, 69, 47),   "normal",   "red",    (2, -1), 0.60),
            ("cyan",  (127, 227, 212), "screen",   "cyan",   (-2, 1), 0.34),
            ("ink2",  (3, 16, 15),     "multiply", "shadow", (-1, 2), 0.42),
        ],
    ),
    "04": dict(
        # 只留 墨 #111310 / 纸 #E9DFC9 / 星金 #C9A96A；红版整个去掉
        crop=(60, 300, 880, 847),
        ramp=[
            (0.00, (17, 19, 16)),
            (0.18, (34, 34, 30)),
            (0.40, (78, 74, 62)),
            (0.62, (146, 136, 113)),
            (0.80, (194, 184, 160)),
            (0.92, (226, 216, 193)),
            (1.00, (233, 223, 201)),
        ],
        black=0.03, white=0.88, gamma=0.95, contrast=1.00,
        floor=0.16, soft=0.6, local_contrast=0.10, local_radius=44,
        screen=0.22, grain=0.85,
        masks=dict(red=(0.30, 0.48), gold=(0.20, 0.38), cyan=(0.10, 0.24),
                   lum_lo=0.08, lum_hi=0.30, hi=(0.70, 0.95)),
        spots=[
            ("gold", (201, 169, 106), "multiply", "gold", (-2, 1), 0.55),
            ("ink2", (17, 19, 16),    "multiply", "shadow", (1, 2), 0.24),
        ],
    ),
}


# ---------------------------------------------------------------- helpers

def to_f(img):
    return np.asarray(img).astype(np.float32) / 255.0


def to_u8(a):
    return np.clip(a * 255.0 + 0.5, 0, 255).astype(np.uint8)


def gauss(a, radius):
    im = Image.fromarray(to_u8(a), mode="L").filter(ImageFilter.GaussianBlur(radius))
    return to_f(im)


def smoothstep(x, e0, e1):
    t = np.clip((x - e0) / max(1e-6, (e1 - e0)), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def shift(a, dx, dy):
    dx, dy = int(dx), int(dy)
    out = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
    if dx > 0:
        out[:, :dx] = out[:, dx:dx + 1]
    elif dx < 0:
        out[:, dx:] = out[:, dx - 1:dx]
    if dy > 0:
        out[:dy, :] = out[dy:dy + 1, :]
    elif dy < 0:
        out[dy:, :] = out[dy - 1:dy, :]
    return out


def make_lut(stops):
    xs = np.array([s[0] for s in stops], dtype=np.float32)
    cs = np.array([s[1] for s in stops], dtype=np.float32)
    t = np.linspace(0, 1, 256, dtype=np.float32)
    return np.stack([np.interp(t, xs, cs[:, i]) for i in range(3)], axis=1)


def screen_r2(h, w, pitch=SCREEN_PITCH, angle=SCREEN_ANGLE):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    th = math.radians(angle)
    u = xx * math.cos(th) + yy * math.sin(th)
    v = -xx * math.sin(th) + yy * math.cos(th)
    cu = (u % pitch) / pitch - 0.5
    cv = (v % pitch) / pitch - 0.5
    return (cu * cu + cv * cv) / 0.25      # 0 中心 · 1 边中点 · 2 角


def halftone(tone, r2, seed=0):
    """tone 0..1（1=纸/少墨）→ 1=纸 0=墨点。圆点面积律 + 点边不齐。"""
    rng = np.random.default_rng(seed)
    h, w = tone.shape
    n = rng.normal(0, 1, (h // 8 + 2, w // 8 + 2)).astype(np.float32)
    n = to_f(Image.fromarray(to_u8(n * 0.25 + 0.5), mode="L").resize((w, h), Image.BICUBIC))
    n = (n - 0.5) * 0.14
    cov = np.clip(1.0 - tone + n, 0, 1)
    thr = cov ** 1.15
    dot = (r2 >= thr * 1.27).astype(np.float32)     # 面积律: r² = 4c/π
    dot = np.clip(gauss(dot, 0.45) * 1.25 - 0.125, 0, 1)
    return dot


def lowfreq(cell, w, h, seed):
    rng = np.random.default_rng(seed)
    sh, sw = h // cell + 2, w // cell + 2
    small = rng.normal(0, 1, (sh, sw)).astype(np.float32)
    im = Image.fromarray(to_u8(small * 0.2 + 0.5), mode="L").resize((w, h), Image.BICUBIC)
    return (to_f(im) - 0.5) * 2.0


def spot_masks(rgb, lum, m):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = smoothstep(r - g, m["red"][0], m["red"][1]) * smoothstep(r - b, m["red"][0] * 1.5, m["red"][1] * 1.5)
    cyan = smoothstep((g + b) * 0.5 - r, m["cyan"][0], m["cyan"][1]) * smoothstep(lum, 0.22, 0.50)
    gold = smoothstep((r + g) * 0.5 - b, m["gold"][0], m["gold"][1]) \
        * (1 - smoothstep(r - g, m["red"][0] * 0.9, m["red"][1])) \
        * smoothstep(lum, 0.35, 0.65)
    hi = smoothstep(lum, m["hi"][0], m["hi"][1])
    shadow = 1.0 - smoothstep(lum, m["lum_lo"], m["lum_hi"])
    return dict(red=red, cyan=cyan, gold=gold, hi=hi, shadow=shadow)


# ---------------------------------------------------------------- core

def treat(cfg, src_path, out_path=None, preview_path=None):
    img = Image.open(src_path).convert("RGB")
    if cfg.get("crop"):
        img = img.crop(cfg["crop"])
    w, h = img.size
    s = LONG_EDGE / max(w, h)
    nw, nh = int(round(w * s)), int(round(h * s))
    img = img.resize((nw, nh), Image.LANCZOS)
    rgb = to_f(img)

    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    lum = gauss(lum, cfg["soft"])
    lc = np.clip(lum + (lum - gauss(lum, cfg["local_radius"])) * cfg["local_contrast"], 0, 1)

    # 印刷调子：抬黑场、压白场，两边都不留纯黑纯白
    t = np.clip((lc - cfg["black"]) / max(1e-6, cfg["white"] - cfg["black"]), 0, 1)
    t = np.clip(t, 0, 1) ** cfg["gamma"]
    t = np.clip(0.5 + (t - 0.5) * cfg["contrast"], 0, 1)
    t = cfg["floor"] + t * (1 - cfg["floor"])

    lut = make_lut(cfg["ramp"])
    duo = lut[np.clip((t * 255).astype(np.int32), 0, 255)] / 255.0

    # 网点版（两色：墨/纸）与双色调叠合 —— 大调子不变，小尺度变印刷
    r2 = screen_r2(nh, nw)
    dot = halftone(gauss(np.clip(t, 0, 1), 0.8), r2, seed=SEED)
    ink = np.array(cfg["ramp"][0][1], dtype=np.float32) / 255.0
    paper = np.array(cfg["ramp"][-1][1], dtype=np.float32) / 255.0
    screen_layer = ink + (paper - ink) * dot[..., None]
    out = duo * (1 - cfg["screen"]) + screen_layer * cfg["screen"]

    # 专色版 + 走版
    masks = spot_masks(rgb, lum, cfg["masks"])
    for name, color, blend, mk, (dx, dy), op in cfg["spots"]:
        m = masks[mk] * op
        m = m * (0.35 + 0.65 * dot)          # 专色也过网点，避免数码渐变
        m = shift(m, dx, dy)
        col = np.array(color, dtype=np.float32) / 255.0
        if blend == "normal":
            out = out * (1 - m[..., None]) + col * m[..., None]
        elif blend == "multiply":
            out = out * (1 - m[..., None]) + (out * col) * m[..., None]
        else:
            scr = 1 - (1 - out) * (1 - col)
            out = out * (1 - m[..., None]) + scr * m[..., None]

    # 颗粒 / 斑驳 / 纤维
    rng = np.random.default_rng(SEED + 5)
    grain = rng.normal(0, 1, (nh, nw)).astype(np.float32)
    out = out + grain[..., None] * 0.012 * cfg["grain"]
    out = out + lowfreq(120, nw, nh, SEED + 7)[..., None] * 0.014 * cfg["grain"]
    out = out + lowfreq(3, nw, nh, SEED + 11)[..., None] * 0.010 * cfg["grain"]

    # 版边微压
    yy, xx = np.mgrid[0:nh, 0:nw].astype(np.float32)
    ex = np.minimum(xx, nw - 1 - xx) / (nw * 0.5)
    ey = np.minimum(yy, nh - 1 - yy) / (nh * 0.5)
    edge = np.clip(np.minimum(ex, ey) * 8.0, 0, 1)
    out = out * (0.955 + 0.045 * edge[..., None])

    out = np.clip(out, 0, 1)
    im_out = Image.fromarray(to_u8(out), mode="RGB")
    if out_path:
        im_out.save(out_path, "WEBP", quality=80, method=6)
    if preview_path:
        im_out.save(preview_path, "PNG")
    return im_out


NAMES = {"01": "01-xuanwu", "03": "03-coral", "04": "04-route"}


def main():
    os.makedirs(TREATED, exist_ok=True)
    args = sys.argv[1:]
    if args and args[0] == "compare":
        for spec in args[1:]:
            plate, cand = spec.split(":")
            prev = os.path.join(HERE, "cmp-%s-%s.png" % (plate, cand))
            treat(PAL[plate], os.path.join(RAW, cand + ".png"), None, prev)
            print("cmp", cand, "->", os.path.basename(prev))
        return

    picks = json.load(open(os.path.join(HERE, "picks.json"), encoding="utf-8-sig"))
    for plate, cand in picks.items():
        src = os.path.join(RAW, cand + ".png")
        if not os.path.exists(src):
            raise SystemExit("missing raw: " + src)
        out = os.path.join(TREATED, NAMES[plate] + ".webp")
        prev = os.path.join(HERE, "preview-" + NAMES[plate] + ".png")
        treat(PAL[plate], src, out, prev)
        kb = os.path.getsize(out) // 1024
        print("treated", plate, cand, "->", os.path.basename(out), kb, "KB")


if __name__ == "__main__":
    main()
