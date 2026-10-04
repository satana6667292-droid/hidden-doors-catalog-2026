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
- all historical embedded page numbers are removed only by explicit page masks;
- automatic green-content deletion is forbidden.
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
    38:[(71.4,96.2,3.8,3.6),(96.3,96.1,3.7,3.6)],
    39:[(94.8,94.2,3.7,2.5),(96.3,96.2,3.7,3.6)],
    40:[(92.4,91.7,3.5,2.2)],
    41:[(92.8,91.8,2.8,2.6),(96.3,96.1,3.7,3.6)],
    42:[(93.2,93.0,2.9,2.8),(96.3,96.1,3.7,3.6)],
    43:[(94.0,93.6,3.8,3.6)],
    44:[(91.7,91.3,3.9,3.7)],
}

# Footer notes on these even public pages start inside the fixed left folio safe zone.
# Move the already-rendered raster note to the right; do not move FOLIO MASTER itself.
# Values: x, y, width, height, horizontal shift — all in page percentages.
FOOTER_NOTE_SHIFTS = {
    33:(2.0,95.8,58.0,3.0,5.5),  # public 30 — зеркало и стекло
    35:(2.0,95.8,58.0,3.0,5.5),  # public 32 — HPL
    37:(2.0,95.8,58.0,3.0,5.5),  # public 34 — керамогранит
    39:(2.0,95.8,58.0,3.0,5.5),  # public 36 — МДФ с фрезеровкой
}

# Full-bleed interior pages need a tiny optical halo around the green number.
PHOTO_PAGES = {6, 9, 10, 13, 14, 17, 18, 21}

# LOGO MASTER S — pilot only on spread 04–05.
# User approved the smallest/most restrained logo option.
LOGO_MASTER_TEST_PAGES = {4, 5}
LOGO_WIDTH_MM = 47.0
LOGO_OUTER_MM = 13.5
LOGO_TOP_MM = 9.5
LOGO_RULE_WIDTH_MM = 16.0
LOGO_RULE_HEIGHT_MM = 1.2
LOGO_RULE_GAP_MM = 4.0


def mm_x(W, mm):
    return round(W * mm / 297)


def mm_y(H, mm):
    return round(H * mm / 210)


def clear_pct(im: Image.Image, x, y, w, h, fill=WHITE):
    W, H = im.size
    x0 = clamp(round(W * x / 100), 0, W - 1)
    y0 = clamp(round(H * y / 100), 0, H - 1)
    x1 = clamp(round(W * (x + w) / 100), x0 + 1, W)
    y1 = clamp(round(H * (y + h) / 100), y0 + 1, H)
    ImageDraw.Draw(im).rectangle((x0, y0, x1, y1), fill=fill)


def apply_logo_master_s(im: Image.Image, physical: int, logo_path: Path):
    """Pilot LOGO MASTER S on pages 04–05 only; all other page content stays untouched."""
    if physical not in LOGO_MASTER_TEST_PAGES:
        return

    W, H = im.size

    # Remove the historical logo treatment in the header only.
    if physical == 4:
        # Covers old oversized logo and any legacy tagline beneath it.
        clear_pct(im, 2.5, 2.0, 27.0, 20.5)
        side = "left"
    else:
        # Page 05 revisions exist with either a left green dash or an old right logo.
        clear_pct(im, 2.0, 3.0, 10.0, 7.0)
        clear_pct(im, 75.0, 2.0, 23.0, 16.5)
        side = "right"

    logo = Image.open(logo_path).convert("RGBA")
    target_w = mm_x(W, LOGO_WIDTH_MM)
    target_h = max(1, round(target_w * logo.height / logo.width))
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)

    outer = mm_x(W, LOGO_OUTER_MM)
    top = mm_y(H, LOGO_TOP_MM)
    if side == "left":
        x = outer
        rule_x0 = x
    else:
        x = W - outer - target_w
        rule_x0 = W - outer - mm_x(W, LOGO_RULE_WIDTH_MM)

    im.paste(logo, (x, top), logo)

    rule_y = top + target_h + mm_y(H, LOGO_RULE_GAP_MM)
    rule_h = max(1, mm_y(H, LOGO_RULE_HEIGHT_MM))
    rule_w = max(1, mm_x(W, LOGO_RULE_WIDTH_MM))
    ImageDraw.Draw(im).rounded_rectangle(
        (rule_x0, rule_y, rule_x0 + rule_w, rule_y + rule_h),
        radius=max(1, rule_h // 2),
        fill=GREEN,
    )


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
    Detect green historical folio clusters near the outer bottom corners.

    Important: a folio is text, so it normally contains at least two nearby
    digit/stroke components. Single tiny green arrows/bullets are ignored.
    """
    W, H = im.size
    # Safety audit only: inspect the actual outer footer folio zones.
    # Do not scan the lower 20% of the page: technical dimensions such as
    # "450–1000 мм" can legitimately be green and must never be auto-erased.
    y0 = round(H * 0.93)
    side_w = round(W * 0.14)
    found = []

    for side, rx0 in (("left", 0), ("right", W - side_w)):
        region = im.crop((rx0, y0, rx0 + side_w, H))
        mask = _green_mask(region)

        parts = []
        for bx0, by0, bx1, by1, area in _components(mask):
            bw = bx1 - bx0
            bh = by1 - by0
            if bh < max(4, round(H * 0.004)) or bh > round(H * 0.045):
                continue
            if bw < 2 or bw > round(W * 0.050):
                continue
            if area < 8:
                continue
            ratio = bw / max(1, bh)
            if ratio > 4.8:
                continue
            parts.append([bx0, by0, bx1, by1, area])

        # Group nearby glyphs into a number/range cluster. This avoids treating
        # a single technical arrow or green bullet as an old page number.
        groups = []
        used = [False] * len(parts)
        for i, p in enumerate(parts):
            if used[i]:
                continue
            group = [p]
            used[i] = True
            changed = True
            while changed:
                changed = False
                gx0 = min(x[0] for x in group); gy0 = min(x[1] for x in group)
                gx1 = max(x[2] for x in group); gy1 = max(x[3] for x in group)
                gh = max(1, gy1 - gy0)
                for j, q in enumerate(parts):
                    if used[j]:
                        continue
                    qcx = (q[0] + q[2]) / 2
                    qcy = (q[1] + q[3]) / 2
                    # close horizontally and on the same baseline
                    hgap = max(0, max(q[0] - gx1, gx0 - q[2]))
                    same_line = (gy0 - gh * 0.75) <= qcy <= (gy1 + gh * 0.75)
                    if same_line and hgap <= max(round(W * 0.012), gh * 2.2):
                        group.append(q)
                        used[j] = True
                        changed = True
            groups.append(group)

        for group in groups:
            gx0 = min(x[0] for x in group); gy0 = min(x[1] for x in group)
            gx1 = max(x[2] for x in group); gy1 = max(x[3] for x in group)
            gw = gx1 - gx0
            gh = gy1 - gy0
            total_area = sum(x[4] for x in group)

            # A real folio/range normally has 2+ glyph components. Permit one
            # merged component only when it is clearly wider than one glyph.
            if len(group) < 2 and not (gw >= gh * 1.35 and total_area >= 20):
                continue
            if gw > round(W * 0.090) or gh > round(H * 0.050):
                continue

            found.append((side, rx0 + gx0, y0 + gy0, rx0 + gx1, y0 + gy1))

    return found

def shift_footer_note_right(im: Image.Image, spec):
    """
    Preserve the rasterized footer note but move it horizontally out of the
    fixed FOLIO MASTER safe zone. This is page-specific mechanical placement,
    not retyping and not a folio position override.
    """
    W, H = im.size
    x, y, w, h, dx = spec
    sx = clamp(round(W * x / 100), 0, W - 1)
    sy = clamp(round(H * y / 100), 0, H - 1)
    sw = clamp(round(W * w / 100), 1, W - sx)
    sh = clamp(round(H * h / 100), 1, H - sy)
    tx = clamp(sx + round(W * dx / 100), 0, W - sw)

    patch = im.crop((sx, sy, sx + sw, sy + sh))

    # Sample the same footer row well to the right of the note, where these
    # pages are blank paper, so the cleanup remains optically invisible.
    bx0 = clamp(round(W * 0.70), 0, W - 2)
    bx1 = clamp(round(W * 0.82), bx0 + 1, W)
    bg = median_rgb(im, (bx0, sy, bx1, sy + sh))
    ImageDraw.Draw(im).rectangle((sx, sy, sx + sw, sy + sh), fill=bg)
    im.paste(patch, (tx, sy))


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


def process_image(path: Path, physical: int, public_no: int, font_path: Path, logo_path: Path):
    im = Image.open(path).convert("RGB")

    # First pass: audited page-specific masks (also catches gray range labels such as 06–07).
    for mask in LEGACY_MASKS.get(physical, []):
        repair_mask(im, mask)

    # LOGO MASTER S pilot: only spread 04–05 for approval.
    apply_logo_master_s(im, physical, logo_path)

    # Keep page-specific footer notes out of the fixed folio safe zone.
    if physical in FOOTER_NOTE_SHIFTS:
        shift_footer_note_right(im, FOOTER_NOTE_SHIFTS[physical])

    # Release blocker: audit is read-only. Never auto-delete green content based
    # on visual similarity; all historical folios must be handled explicitly by LEGACY_MASKS.
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
    ap.add_argument("--logo", required=True, help="Hidden Doors transparent logo PNG")
    args = ap.parse_args()

    site = Path(args.site)
    font_path = Path(args.font)
    logo_path = Path(args.logo)
    if not font_path.exists():
        raise SystemExit(f"FOLIO MASTER: font not found: {font_path}")
    if not logo_path.exists():
        raise SystemExit(f"LOGO MASTER: logo not found: {logo_path}")

    sequence = public_sequence()

    for physical, public_no in sequence.items():
        name = f"page-{physical:03d}.webp"
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name

        if not page.exists():
            raise SystemExit(f"FOLIO MASTER: missing page asset: {page}")
        process_image(page, physical, public_no, font_path, logo_path)

        if thumb.exists():
            process_image(thumb, physical, public_no, font_path, logo_path)

    print(f"FOLIO MASTER v1 baked into {len(sequence)} included pages (cover unnumbered).")


if __name__ == "__main__":
    main()
