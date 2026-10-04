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
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from collections import deque
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


def _green_mask(region: Image.Image) -> Image.Image:
    """Brand-green-ish pixels, dilated slightly so anti-aliased digits stay connected."""
    src = region.convert("RGB")
    out = Image.new("L", src.size, 0)
    sp = src.load()
    op = out.load()
    for yy in range(src.height):
        for xx in range(src.width):
            r, g, b = sp[xx, yy]
            if g >= 115 and (g - r) >= 30 and (g - b) >= 24 and r <= 190:
                op[xx, yy] = 255
    return out.filter(ImageFilter.MaxFilter(3))


def _components(mask: Image.Image):
    """Connected white components from a small binary mask."""
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = []
    for yy in range(h):
        row = yy * w
        for xx in range(w):
            idx = row + xx
            if seen[idx] or px[xx, yy] == 0:
                continue
            q = deque([(xx, yy)])
            seen[idx] = 1
            x0 = x1 = xx
            y0 = y1 = yy
            count = 0
            while q:
                x, y = q.popleft()
                count += 1
                x0 = min(x0, x); x1 = max(x1, x)
                y0 = min(y0, y); y1 = max(y1, y)
                for ny in (y - 1, y, y + 1):
                    if ny < 0 or ny >= h:
                        continue
                    base = ny * w
                    for nx in (x - 1, x, x + 1):
                        if nx < 0 or nx >= w:
                            continue
                        ni = base + nx
                        if not seen[ni] and px[nx, ny] != 0:
                            seen[ni] = 1
                            q.append((nx, ny))
            out.append((x0, y0, x1 + 1, y1 + 1, count))
    return out


def find_green_folio_candidates(im: Image.Image):
    """
    Detect small green digit-like remnants near the outer bottom corners.
    The search deliberately ignores the middle 56% of the page so dimensions,
    cards and body accents are not touched.
    """
    W, H = im.size
    y0 = round(H * 0.80)
    side_w = round(W * 0.22)
    found = []
    for side, x0 in (("left", 0), ("right", W - side_w)):
        region = im.crop((x0, y0, x0 + side_w, H))
        mask = _green_mask(region)
        for bx0, by0, bx1, by1, area in _components(mask):
            bw = bx1 - bx0
            bh = by1 - by0
            # digit/short-number geometry only: not long rules, dimensions or cards
            if bh < max(4, round(H * 0.004)) or bh > round(H * 0.045):
                continue
            if bw < 2 or bw > round(W * 0.075):
                continue
            if area < 8:
                continue
            ratio = bw / max(1, bh)
            if ratio > 4.8:
                continue
            # Green dots/bullets are too small to be a folio.
            if bw < round(W * 0.0025) and bh < round(H * 0.010):
                continue
            found.append((side, x0 + bx0, y0 + by0, x0 + bx1, y0 + by1))
    return found


def remove_green_folio_candidates(im: Image.Image):
    """
    Safety pass after page-specific masks: remove any remaining green folio-like
    digit fragments in the outer footer zones. This catches historical numbers
    that moved between page revisions without touching central content.
    """
    W, H = im.size
    for side, x0, y0, x1, y1 in find_green_folio_candidates(im):
        pad_x = max(4, round(W * 0.004))
        pad_y = max(3, round(H * 0.004))
        tx0 = clamp(x0 - pad_x, 0, W - 1)
        ty0 = clamp(y0 - pad_y, 0, H - 1)
        tx1 = clamp(x1 + pad_x, tx0 + 1, W)
        ty1 = clamp(y1 + pad_y, ty0 + 1, H)
        tw = tx1 - tx0
        th = ty1 - ty0

        # Copy from the same footer row, toward the page interior.
        shift = max(round(W * 0.045), tw * 2)
        src_x = tx0 + shift if side == "left" else tx0 - shift
        src_x = clamp(src_x, 0, W - tw)
        patch = im.crop((src_x, ty0, src_x + tw, ty1))
        im.paste(patch, (tx0, ty0))


def audit_no_legacy_green(im: Image.Image, physical: int):
    leftovers = find_green_folio_candidates(im)
    if leftovers:
        boxes = ", ".join(f"{side}:{x0},{y0}-{x1},{y1}" for side, x0, y0, x1, y1 in leftovers)
        raise RuntimeError(
            f"FOLIO MASTER audit failed on source page {physical:02d}: "
            f"green folio-like remnants remain ({boxes})"
        )


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

    # First pass: audited page-specific masks (also catches gray range labels such as 06–07).
    for mask in LEGACY_MASKS.get(physical, []):
        repair_mask(im, mask)

    # Second pass: automatically catch any green historical number that survived
    # because a page revision moved it slightly.
    remove_green_folio_candidates(im)

    # Release blocker: there must be no folio-like green remnant BEFORE the new
    # master number is written. If there is, deploy fails instead of publishing a duplicate.
    audit_no_legacy_green(im, physical)

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
