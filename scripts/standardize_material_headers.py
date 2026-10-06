#!/usr/bin/env python3
"""
Standardize the approved 59 mm material spread header.

Current approved spread:
- physical 35 / public 32: HPL, left page;
- physical 36 / public 33: natural veneer, right page.

Rules:
- logo stays on the outer edge (handled by LOGO MASTER);
- title/subtitle stay on the binding edge;
- both pages use exactly the same font family, weight, size, baseline and subtitle styling;
- body copy and all page content below the header remain untouched.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]
FONT_REG_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]

HEADERS = {
    35: {
        "title": "59 мм — HPL-пластик",
        "subtitle": "Интеграция HPL-пластика в полотно скрытой двери",
        "side": "left",
    },
    36: {
        "title": "59 мм — натуральный шпон",
        "subtitle": "Интеграция натурального шпона в полотно скрытой двери",
        "side": "right",
    },
}

BASE_W = 1600
BASE_H = 1132
TITLE_SIZE = 42
SUBTITLE_SIZE = 18
TITLE_Y = 77
SUBTITLE_Y = 132
INNER_MARGIN = 50

# Only the old raster title/subtitle area is cleared.
# Coordinates are stored in the full-page 1600x1132 master and scaled for thumbs.
CLEAR_BOX = {
    35: (780, 50, 1600, 175),
    36: (0, 50, 850, 175),
}


def find_font(candidates):
    for p in candidates:
        if Path(p).exists():
            return p
    raise SystemExit("MATERIAL HEADER: DejaVu Sans font not found on runner")


def process(path: Path, physical: int, bold_path: str, regular_path: str):
    spec = HEADERS[physical]
    im = Image.open(path).convert("RGB")
    W, H = im.size

    sx = W / BASE_W
    sy = H / BASE_H
    if abs(sx - sy) > 0.01:
        raise RuntimeError(
            f"MATERIAL HEADER: unexpected aspect ratio for {path.name}: {(W, H)}"
        )
    scale = sx

    d = ImageDraw.Draw(im)
    bx0, by0, bx1, by1 = CLEAR_BOX[physical]
    clear_box = (
        round(bx0 * scale),
        round(by0 * scale),
        round(bx1 * scale),
        round(by1 * scale),
    )
    d.rectangle(clear_box, fill=(255, 255, 255))

    title_font = ImageFont.truetype(bold_path, max(8, round(TITLE_SIZE * scale)))
    subtitle_font = ImageFont.truetype(regular_path, max(5, round(SUBTITLE_SIZE * scale)))

    title = spec["title"]
    subtitle = spec["subtitle"]
    inner = round(INNER_MARGIN * scale)
    title_y = round(TITLE_Y * scale)
    subtitle_y = round(SUBTITLE_Y * scale)

    if spec["side"] == "left":
        bbox = d.textbbox((0, 0), title, font=title_font)
        title_w = bbox[2] - bbox[0]
        x = W - inner - title_w
    else:
        x = inner

    d.text((x, title_y), title, font=title_font, fill=(34, 34, 34))
    d.text((x, subtitle_y), subtitle, font=subtitle_font, fill=(145, 145, 145))

    im.save(path, "WEBP", quality=96, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    args = ap.parse_args()

    site = Path(args.site)
    bold = find_font(FONT_BOLD_CANDIDATES)
    regular = find_font(FONT_REG_CANDIDATES)

    for physical in sorted(HEADERS):
        name = f"page-{physical:03d}.webp"
        page = site / "assets" / "pages" / name
        thumb = site / "assets" / "thumbs" / name
        if not page.exists():
            raise SystemExit(f"MATERIAL HEADER: missing {page}")

        process(page, physical, bold, regular)
        if thumb.exists():
            process(thumb, physical, bold, regular)

    print(
        "MATERIAL HEADER: standardized physical pages 35-36; "
        "same bold title, regular subtitle, size and baseline."
    )


if __name__ == "__main__":
    main()
