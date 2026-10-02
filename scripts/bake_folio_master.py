#!/usr/bin/env python3
"""
Bake FOLIO MASTER v1 into generated catalog raster assets.

This runs only against the temporary generated site during deploy.
Source assets in the catalog repository remain unchanged.

Approved rules:
- cover is logically 01 but has no printed folio;
- Manrope SemiBold, 10 pt equivalent;
- #57C035;
- 8 mm from the outer trim edge;
- 5 mm from the bottom trim edge;
- even public pages -> bottom-left; odd public pages -> bottom-right;
- all historical embedded page numbers are removed first.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import statistics

GREEN = (87, 192, 53)
WHITE = (255, 255, 255)

# Physical/source pages hidden from the public catalog.
HIDDEN_PHYSICAL = {24, 25, 26}

# Audited historical folio rectangles as percentages of page width/height.
# Multiple rectangles are allowed when a page accumulated more than one historical number.
LEGACY_MASKS = {
    2:[(3.4,92.0,3.6,3.8)],
    3:[(92.7,91.8,4.0,4.5)],
    4:[(3.5,92.4,3.4,3.1)],
    5:[(93.2,92.0,3.2,3.8)],

    7:[(93.6,96.0,4.9,2.8)],
    8:[(2.5,96.0,4.9,2.8)],
    11:[(93.6,96.0,4.9,2.8)],
    12:[(2.5,96.0,4.9,2.8)],
    15:[(93.6,96.0,4.9,2.8)],
    16:[(2.5,96.0,4.9,2.8)],
    19:[(93.6,96.0,4.9,2.8)],
    20:[(2.5,96.0,4.9,2.8)],

    27:[(84.2,86.5,2.8,2.3)],
    28:[(94.0,93.6,3.8,3.6)],
    29:[(84.2,84.1,2.8,2.4)],
    30:[(92.3,94.5,3.9,3.7)],
    31:[(92.6,93.1,3.9,3.8)],
    32:[(93.9,93.0,3.6,3.7)],
    33:[(94.8,94.5,3.9,3.9)],
    34:[(94.8,94.5,3.9,3.9)],
    35:[(94.8,94.5,3.9,3.9)],
    36:[(94.8,93.7,3.6,2.8),(96.4,96.1,3.6,3.6)],
    37:[(96.3,96.2,3.7,3.6)],
    38:[(71.4,96.2,3.8,3.6)],
    39:[(94.8,94.2,3.7,2.5),(96.3,96.2,3.7,3.6)],
    40:[(92.4,91.7,3.5,2.2)],
    41:[(92.8,91.8,2.8,2.6),(96.3,96.1,3.7,3.6)],
    42:[(93.2,93.0,2.9,2.8),(96.3,96.1,3.7,3.6)],
    43:[(94.0,93.6,3.8,3.6)],
    44:[(91.7,91.3,3.9,3.7)],
}

# Full-bleed interior pages need a tiny optical halo around the green number.
PHOTO_PAGES = {6, 9, 10, 13, 14, 17, 18, 21}


def public_sequence():
    physical = [p for p in range(1, 45) if p not in HIDDEN_PHYSICAL]
    return {p: i + 1 for i, p in enumerate(physical)}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def median_rgb(im: Image.Image, box):
    crop = im.crop(box).convert("RGB")
    px = list(crop.getdata())
    if not px:
        return (255, 255, 255)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))


def repair_mask(im: Image.Image, mask):
    """Remove one old folio by copying a nearby patch from the same footer row."""
    W, H = im.size
    x, y, w, h = mask
    tx = clamp(round(W * x / 100), 0, W - 1)
    ty = clamp(round(H * y / 100), 0, H - 1)
    tw = clamp(round(W * w / 100), 1, W - tx)
    th = clamp(round(H * h / 100), 1, H - ty)

    center = (x + w / 2) / 100
    shift = max(round(W * 0.055), tw * 2)
    src_x = tx - shift if center > 0.5 else tx + shift
    src_x = clamp(src_x, 0, W - tw)

    patch = im.crop((src_x, ty, src_x + tw, ty + th))
    im.paste(patch, (tx, ty))


def add_folio(im: Image.Image, number: str, side: str, font_path: Path, halo: bool):
    W, H = im.size
    # 10 pt = 3.5278 mm. Convert from page physical width to pixels.
    font_px = max(8, round((10 * 25.4 / 72) * (W / 297)))
    font = ImageFont.truetype(str(font_path), font_px)
    draw = ImageDraw.Draw(im)
    bbox = draw.textbbox((0, 0), number, font=font)

    outer = round((8 / 297) * W)
    bottom = round((5 / 210) * H)

    if side == "left":
        x = outer - bbox[0]
    else:
        x = W - outer - bbox[2]
    y = H - bottom - bbox[3]

    stroke = max(1, round(W / 3509 * 2)) if halo else 0
    draw.text(
        (x, y), number,
        font=font,
        fill=GREEN,
        stroke_width=stroke,
        stroke_fill=WHITE if halo else GREEN,
    )


def process_image(path: Path, physical: int, public_no: int, font_path: Path):
    im = Image.open(path).convert("RGB")

    for mask in LEGACY_MASKS.get(physical, []):
        repair_mask(im, mask)

    if physical != 1:
        side = "left" if public_no % 2 == 0 else "right"
        add_folio(im, f"{public_no:02d}", side, font_path, physical in PHOTO_PAGES)

    # Preserve WEBP; deployment copy only.
    im.save(path, "WEBP", quality=95, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="Generated catalog site directory")
    ap.add_argument("--font", required=True, help="Manrope SemiBold font path")
    args = ap.parse_args()

    site = Path(args.site)
    font_path = Path(args.font)
    if not font_path.exists():
        raise SystemExit(f"FOLIO MASTER: font not found: {font_path}")

    sequence = public_sequence()

    for physical, public_no in sequence.items():
        name = f"page-{physical:03d}.webp"
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name

        if not page.exists():
            raise SystemExit(f"FOLIO MASTER: missing page asset: {page}")
        process_image(page, physical, public_no, font_path)

        if thumb.exists():
            process_image(thumb, physical, public_no, font_path)

    print(f"FOLIO MASTER v1 baked into {len(sequence)} included pages (cover unnumbered).")


if __name__ == "__main__":
    main()
