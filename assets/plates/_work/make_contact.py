#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""拼 contact-sheet.png：3 张成品 + 9 张候选 + 色板 / 文件信息。"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PLATES = os.path.dirname(HERE)
RAW = os.path.join(PLATES, "raw")
TREATED = os.path.join(PLATES, "treated")
OUT = os.path.join(PLATES, "contact-sheet.png")

INK = (17, 19, 16)
BONE = (242, 236, 223)
CORAL = (216, 80, 58)
GREY = (17, 19, 16)

SERIF = "C:/Windows/Fonts/NotoSerifSC-VF.ttf"
SANS = "C:/Windows/Fonts/NotoSansSC-VF.ttf"
MONO = "C:/Windows/Fonts/consola.ttf"

W, H = 2400, 1280
M = 80

PLATES_META = [
    dict(key="01", cn="玄武", en="BASALT", file="01-xuanwu.webp", raw="01-b",
         pal=["#0F110E", "#45453C", "#746F63", "#E8E2D4", "#8C4A38"]),
    dict(key="03", cn="珊瑚", en="CORAL", file="03-coral.webp", raw="03-a",
         pal=["#04110F", "#12302C", "#3E6E66", "#E8E2D4", "#E2452F", "#7FE3D4"]),
    dict(key="04", cn="航线", en="ROUTE BOOK", file="04-route.webp", raw="04-a",
         pal=["#111310", "#4A4332", "#8E8468", "#E9DFC9", "#C9A96A"]),
]
CANDIDATES = ["01-a", "01-b", "01-c", "03-a", "03-b", "03-c", "04-a", "04-b", "04-c"]


def font(path, size):
    return ImageFont.truetype(path, size)


def tw(d, txt, f, tracking=0):
    return sum(d.textlength(c, font=f) + tracking for c in txt)


def text(d, xy, txt, f, fill=INK, tracking=0):
    x, y = xy
    for c in txt:
        d.text((x, y), c, font=f, fill=fill)
        x += d.textlength(c, font=f) + tracking
    return x


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def main():
    sheet = Image.new("RGB", (W, H), BONE)
    d = ImageDraw.Draw(sheet)

    f_title = font(SERIF, 40)
    f_sub = font(SANS, 15)
    f_label = font(MONO, 12)
    f_plate = font(SERIF, 32)
    f_plate_en = font(MONO, 13)
    f_meta = font(MONO, 13)
    f_hex = font(MONO, 10)
    f_note = font(SANS, 13)

    # ---------------- header
    x = text(d, (M, 52), "潮汐书 · 海南", f_title, INK, 5)
    d.line([(x + 26, 62), (x + 26, 100)], fill=(17, 19, 16, 40), width=1)
    text(d, (x + 48, 64), "R0 · 图鉴插页 / PLATE INSERTS", font(SANS, 13), INK, 2.2)
    text(d, (x + 48, 86), "AI 图版 01 玄武 · 03 珊瑚 · 04 航线", f_sub, (60, 62, 56), 1.2)

    tot = sum(os.path.getsize(os.path.join(TREATED, p["file"])) for p in PLATES_META)
    right = "%d plates · 3 × 1200×800 · %d KB" % (len(PLATES_META), round(tot / 1024))
    text(d, (W - M - tw(d, right, f_label, 1.6), 54), right, f_label, (60, 62, 56), 1.6)
    r2 = "WebP q80 · halftone 3.2px/27° · duotone · misregistration"
    text(d, (W - M - tw(d, r2, f_hex, 1.2), 76), r2, f_hex, (60, 62, 56), 1.2)

    d.line([(M, 148), (W - M, 148)], fill=(17, 19, 16), width=1)

    # ---------------- treated plates
    text(d, (M, 168), "TREATED", f_label, (17, 19, 16), 3)
    text(d, (M + 110, 168), "成品：已双色调 / 网点 / 颗粒 / 套准，可直接上图", f_note, (90, 92, 84), 1)

    pw, ph = 720, 480
    xs = [M, M + pw + 40, M + 2 * pw + 80]
    for i, meta in enumerate(PLATES_META):
        img = Image.open(os.path.join(TREATED, meta["file"])).convert("RGB")
        img = img.resize((pw, ph), Image.LANCZOS)
        x0 = xs[i]
        y0 = 204
        sheet.paste(img, (x0, y0))
        d.rectangle([x0 - 1, y0 - 1, x0 + pw, y0 + ph], outline=(17, 19, 16), width=1)

        # 编号 + 中文名
        text(d, (x0, y0 + ph + 22), meta["key"] + "  " + meta["cn"], f_plate, INK, 2)
        text(d, (x0 + 132, y0 + ph + 36), meta["en"], f_plate_en, (90, 92, 84), 2.4)

        size = os.path.getsize(os.path.join(TREATED, meta["file"]))
        meta_line = "%s · 1200×800 · %d KB" % (meta["file"], round(size / 1024))
        text(d, (x0, y0 + ph + 74), meta_line, f_meta, (60, 62, 56), 1.0)
        text(d, (x0, y0 + ph + 96), "raw %s · gpt-image-2 · 1536×1024" % meta["raw"],
             f_hex, (90, 92, 84), 0.8)

        # 色板
        cx, cy = x0, y0 + ph + 122
        for hx in meta["pal"]:
            d.rectangle([cx, cy, cx + 16, cy + 16], fill=hex2rgb(hx), outline=(17, 19, 16, 40))
            text(d, (cx + 1, cy + 24), hx, f_hex, (60, 62, 56), 0.4)
            cx += 74

    # ---------------- candidates
    d.line([(M, 962), (W - M, 962)], fill=(17, 19, 16), width=1)
    text(d, (M, 980), "CANDIDATES", f_label, INK, 3)
    text(d, (M + 138, 980), "候选：raw 原图（未处理），每幕 3 版，● = 选用", f_note, (90, 92, 84), 1)

    tw_, th_ = 236, 157
    for i, c in enumerate(CANDIDATES):
        img = Image.open(os.path.join(RAW, c + ".png")).convert("RGB").resize((tw_, th_), Image.LANCZOS)
        x0 = M + i * 254
        y0 = 1014
        sheet.paste(img, (x0, y0))
        d.rectangle([x0 - 1, y0 - 1, x0 + tw_, y0 + th_], outline=(17, 19, 16), width=1)
        chosen = c == {"01": "01-b", "03": "03-a", "04": "04-a"}[c[:2]]
        if chosen:
            d.ellipse([x0 + tw_ - 14, y0 + 8, x0 + tw_ - 6, y0 + 16], fill=CORAL)
            text(d, (x0 + 1, y0 + th_ + 8), "● " + c + "  选用", font(SANS, 10), CORAL, 0.6)
        else:
            text(d, (x0 + 1, y0 + th_ + 8), "  " + c, f_hex, (110, 112, 102), 0.6)

    # ---------------- footer
    d.line([(M, 1224), (W - M, 1224)], fill=(17, 19, 16), width=1)
    foot = "图版内无任何文字；编号 / 中文标签 / 1px 线框由页面按 ART-DIRECTION §6 叠加。"
    text(d, (M, 1238), foot, f_note, (60, 62, 56), 1)
    stamp = "plate-maker · 2026-10-23 · _work/make_plates.py"
    text(d, (W - M - tw(d, stamp, f_hex, 0.8), 1239), stamp, f_hex, (110, 112, 102), 0.8)

    sheet.save(OUT, "PNG")
    print(OUT, sheet.size, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
