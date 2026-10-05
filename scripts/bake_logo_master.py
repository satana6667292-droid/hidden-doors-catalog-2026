#!/usr/bin/env python3
"""
Bake the approved Hidden Doors LOGO MASTER into catalog raster assets.

Final rules:
- use the clean transparent corporate logo PNG, never a raster crop from a catalog page;
- keep the approved ARC 18–19 visual size/placement;
- fully clear the historical logo/header zone before placing the master;
- fill that zone with the page's own sampled background, so no gray/white patch remains;
- keep intentional logo-free 36 mm interior/full-bleed pages logo-free;
- cover/back cover and hidden source pages stay untouched.
"""
from __future__ import annotations

import argparse
import base64
from io import BytesIO
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw

# Clean transparent corporate logo from hidden-doors-website/site/assets/logo.png
LOGO_PNG_B64 = """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"""

# Approved visual scale from the live ARC 18–19 spread.
TARGET_WIDTH_RATIO = 0.1944
TARGET_OUTER_RATIO = 0.0310
TARGET_TOP_RATIO = 0.0539

# Explicit page-side map. This avoids heuristic detection failures/partial remnants.
PAGE_SIDES = {
    2:"left", 3:"right", 4:"left", 5:"right",
    7:"right", 8:"left", 11:"right", 12:"left",
    15:"right", 16:"left", 19:"right", 20:"left",
    22:"left", 23:"right",
    27:"left", 28:"right", 29:"left", 30:"right",
    31:"right", 32:"right", 33:"right", 34:"right",
    35:"right", 36:"right", 37:"right", 38:"right",
    39:"right", 41:"right", 42:"right",
}

# These collection interior/full-bleed pages intentionally carry no logo.
NO_LOGO_36_INTERIORS = {6, 9, 10, 13, 14, 17, 18, 21}

# Hidden/removed physical source pages and covers are not touched.
HIDDEN_PHYSICAL = {24, 25, 26}
COVER_PAGES = {1, 44}

# Collection model pages use a larger historical header treatment. Clear the
# whole outer header block so legacy green dashes/partial logos cannot survive.
COLLECTION_MODEL_PAGES = {7, 8, 11, 12, 15, 16, 19, 20}

# Pages 27 and 29 historically had the logo on the right, but the approved
# layout places it on the left. Clear only the old right-side logo zone before
# placing the new master. Page 30 had no logo and receives one on the right.
OLD_LOGO_SIDE = {27: "right", 29: "right"}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def sample_header_background(im: Image.Image):
    """Sample the page's actual blank top margin to avoid visible cleanup patches."""
    W, H = im.size
    x0, x1 = round(W * 0.38), round(W * 0.62)
    y0, y1 = max(0, round(H * 0.004)), max(1, round(H * 0.026))
    crop = im.crop((x0, y0, x1, y1)).convert("RGB")
    px = list(crop.getdata())
    if not px:
        return (255, 255, 255)
    return tuple(int(median([p[i] for p in px])) for i in range(3))


def clear_logo_zone(im: Image.Image, physical: int, side: str):
    """
    Clear the entire historical logo area, not just detected pixels.
    This removes old logo fragments, underlines, white/gray rectangles and blur.
    """
    W, H = im.size
    bg = sample_header_background(im)

    # Collection model pages had wider/taller historical header graphics.
    # Clear the full outer block before placing the master so no green dashes,
    # clipped logo pieces or antialiasing remnants can remain.
    if physical in COLLECTION_MODEL_PAGES:
        # Collection cards begin immediately below the header. Keep this mask
        # deliberately tight: it must cover only the historical logo, never
        # the first row of model cards.
        y_ratio = 0.145
        if side == "left":
            x0, x1 = 0, round(W * 0.275)
        else:
            x0, x1 = round(W * 0.725), W
    elif physical == 22:
        # The 42 mm title shares the same top row as the left logo.
        # Remove the entire old logo/tagline/divider treatment, but stop before
        # the title so the leading "42" is preserved.
        y_ratio = 0.205
        x0, x1 = 0, round(W * 0.280)
    elif physical == 38:
        # This source revision placed a fragment of the historical logo farther
        # inward. Clear that fragment without touching the title/work badge below.
        y_ratio = 0.145
        x0, x1 = round(W * 0.600), W
    else:
        y_ratio = 0.235 if physical in {2, 4} else 0.205
        if side == "left":
            x0, x1 = 0, round(W * 0.345)
        else:
            x0, x1 = round(W * 0.655), W

    y0, y1 = 0, round(H * y_ratio)
    ImageDraw.Draw(im).rectangle((x0, y0, x1, y1), fill=bg)


def clean_logo_rgba():
    """Load the clean transparent PNG and trim only fully transparent outer padding."""
    logo = Image.open(BytesIO(base64.b64decode(LOGO_PNG_B64))).convert("RGBA")
    alpha = logo.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        logo = logo.crop(bbox)
    return logo


def place_master_logo(im: Image.Image, side: str, logo_src: Image.Image):
    W, H = im.size
    target_w = max(1, round(W * TARGET_WIDTH_RATIO))
    target_h = max(1, round(target_w * logo_src.height / logo_src.width))
    logo = logo_src.resize((target_w, target_h), Image.Resampling.LANCZOS)

    outer = round(W * TARGET_OUTER_RATIO)
    top = round(H * TARGET_TOP_RATIO)
    x = outer if side == "left" else W - outer - target_w

    # Alpha compositing is critical: only logo pixels are placed, no background rectangle.
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    overlay.alpha_composite(logo, (x, top))
    merged = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    return merged


def process_image(path: Path, physical: int, logo_src: Image.Image):
    side = PAGE_SIDES.get(physical)
    if not side:
        return False

    im = Image.open(path).convert("RGB")

    # When a page changes logo side, remove the historical logo from its old
    # position first. Do not clear the new side: there was no old logo there
    # and the title/content below must remain untouched.
    old_side = OLD_LOGO_SIDE.get(physical)
    if old_side and old_side != side:
        clear_logo_zone(im, physical, old_side)
    elif physical != 30:
        clear_logo_zone(im, physical, side)

    im = place_master_logo(im, side, logo_src)
    im.save(path, "WEBP", quality=96, method=6)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="Generated catalog site directory")
    args = ap.parse_args()

    site = Path(args.site)
    logo_src = clean_logo_rgba()

    replaced = []
    for physical, side in sorted(PAGE_SIDES.items()):
        if physical in HIDDEN_PHYSICAL or physical in COVER_PAGES or physical in NO_LOGO_36_INTERIORS:
            continue

        name = "page-%03d.webp" % physical
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name
        if not page.exists():
            raise SystemExit("LOGO MASTER: target page missing: %s" % page)

        process_image(page, physical, logo_src)
        if thumb.exists():
            process_image(thumb, physical, logo_src)
        replaced.append("%02d:%s" % (physical, side))

    print(
        "LOGO MASTER clean rollout complete. "
        "Transparent source used; historical logo zones fully cleared with sampled page background. "
        "Pages: %s. Master width=%.2f%%, outer=%.2f%%, top=%.2f%%."
        % (", ".join(replaced), TARGET_WIDTH_RATIO*100, TARGET_OUTER_RATIO*100, TARGET_TOP_RATIO*100)
    )


if __name__ == "__main__":
    main()
