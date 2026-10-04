#!/usr/bin/env python3
"""
Bake LOGO MASTER pilot into generated catalog raster assets.

Reference:
- source/public ARC model page 19 is the visual master for logo size and placement;
- the logo is extracted from that actual raster, so no approximate redraw is used;
- pilot applies only to physical pages 04 and 05;
- all non-logo page content stays untouched.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw

GREEN_MIN = 105

# Approved visual reference from the user's live ARC 18–19 spread screenshot.
# Measured against the visible page-19 sheet:
# logo width ≈ 138 / 710 = 19.44% of page width
# outer margin ≈ 22 / 710 = 3.10% of page width
# top margin ≈ 27 / 501 = 5.39% of page height
TARGET_WIDTH_RATIO = 0.1944
TARGET_OUTER_RATIO = 0.0310
TARGET_TOP_RATIO = 0.0539


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def clear_pct(im: Image.Image, x, y, w, h):
    W, H = im.size
    x0 = clamp(round(W * x / 100), 0, W - 1)
    y0 = clamp(round(H * y / 100), 0, H - 1)
    x1 = clamp(round(W * (x + w) / 100), x0 + 1, W)
    y1 = clamp(round(H * (y + h) / 100), y0 + 1, H)
    ImageDraw.Draw(im).rectangle((x0, y0, x1, y1), fill=(255, 255, 255))


def logo_master_from_arc(page19: Path):
    ref = Image.open(page19).convert("RGB")
    W, H = ref.size

    # ARC page 19: the approved logo lives alone in the upper-right header zone.
    rx0, ry0 = round(W * 0.70), round(H * 0.02)
    rx1, ry1 = round(W * 0.99), round(H * 0.18)
    region = ref.crop((rx0, ry0, rx1, ry1))

    # Mask only black wordmark + brand-green icon. Ignore pale rules/background.
    src = region.load()
    xs, ys = [], []
    for y in range(region.height):
        for x in range(region.width):
            r, g, b = src[x, y]
            dark = r < 115 and g < 115 and b < 115
            green = g >= GREEN_MIN and g >= r + 24 and g >= b + 18
            if dark or green:
                xs.append(x)
                ys.append(y)

    if not xs:
        raise RuntimeError("LOGO MASTER: could not detect ARC page 19 logo")

    x0, x1 = min(xs), max(xs) + 1
    y0, y1 = min(ys), max(ys) + 1

    # Tiny optical padding preserves antialiasing around the detected raster.
    px = max(1, round(W * 0.0015))
    py = max(1, round(H * 0.0015))
    x0 = max(0, x0 - px)
    y0 = max(0, y0 - py)
    x1 = min(region.width, x1 + px)
    y1 = min(region.height, y1 + py)

    abs_x0, abs_y0 = rx0 + x0, ry0 + y0
    abs_x1, abs_y1 = rx0 + x1, ry0 + y1
    logo = ref.crop((abs_x0, abs_y0, abs_x1, abs_y1))

    return {
        "image": logo,
        "source_width_ratio": logo.width / W,
        "source_outer_ratio": (W - abs_x1) / W,
        "source_top_ratio": abs_y0 / H,
    }


def apply_logo_master(path: Path, physical: int, master):
    im = Image.open(path).convert("RGB")
    W, H = im.size

    # Remove only historical logo treatment.
    if physical == 4:
        # Old oversized logo + tagline.
        clear_pct(im, 2.0, 1.5, 28.0, 21.5)
        side = "left"
    elif physical == 5:
        # Preserve the existing green heading dash at upper-left.
        clear_pct(im, 75.0, 1.5, 24.0, 16.5)
        side = "right"
    else:
        return

    # Use the exact visual scale/margins measured from the approved live ARC screenshot.
    target_w = max(1, round(W * TARGET_WIDTH_RATIO))
    target_h = max(1, round(target_w * master["image"].height / master["image"].width))
    logo = master["image"].resize((target_w, target_h), Image.Resampling.LANCZOS)

    outer = round(W * TARGET_OUTER_RATIO)
    top = round(H * TARGET_TOP_RATIO)
    x = outer if side == "left" else W - outer - target_w

    im.paste(logo, (x, top))
    im.save(path, "WEBP", quality=95, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="Generated catalog site directory")
    args = ap.parse_args()

    site = Path(args.site)
    page19 = site / "assets" / "pages" / "page-019.webp"
    if not page19.exists():
        raise SystemExit(f"LOGO MASTER: reference page missing: {page19}")

    master = logo_master_from_arc(page19)

    for physical in (4, 5):
        name = f"page-{physical:03d}.webp"
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name
        if not page.exists():
            raise SystemExit(f"LOGO MASTER: target page missing: {page}")
        apply_logo_master(page, physical, master)
        if thumb.exists():
            apply_logo_master(thumb, physical, master)

    print(
        "LOGO MASTER pilot baked into pages 04–05 using ARC logo artwork "
        f"at approved live-spread scale (width={TARGET_WIDTH_RATIO*100:.2f}% page, "
        f"outer={TARGET_OUTER_RATIO*100:.2f}%, top={TARGET_TOP_RATIO*100:.2f}%). "
        f"Source ARC raster logo was {master['source_width_ratio']*100:.2f}% wide."
    )


if __name__ == "__main__":
    main()
