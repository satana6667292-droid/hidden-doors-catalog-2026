#!/usr/bin/env python3
"""
Remove only the duplicate top heading from source page 28
(public 25 — 42 mm double-door visual page).

Everything else on the page stays unchanged, including:
- green accent line;
- Hidden Doors logo;
- large door image;
- right-side content;
- footer text.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw
import statistics


def median_rgb(im: Image.Image, box):
    crop = im.crop(box).convert("RGB")
    px = list(crop.getdata())
    if not px:
        return (254, 254, 254)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))


def process(path: Path):
    im = Image.open(path).convert("RGB")
    W, H = im.size

    # Sample the same white paper background from the clean upper centre area.
    bg = median_rgb(
        im,
        (
            round(W * 0.44),
            round(H * 0.015),
            round(W * 0.58),
            round(H * 0.045),
        ),
    )

    # Tight audited box around "42 мм — двустворчатая дверь".
    # It stops above the green underline, which is intentionally preserved.
    x0 = round(W * 0.026)
    y0 = round(H * 0.033)
    x1 = round(W * 0.625)
    y1 = round(H * 0.112)

    draw = ImageDraw.Draw(im)
    draw.rectangle((x0, y0, x1, y1), fill=bg)

    # Remove the damaged remnant of the old green "ВИЗУАЛЬНОЕ РЕШЕНИЕ"
    # label above "Две створки — одна плоскость". Keep the black title intact.
    gx0 = round(W * 0.565)
    gy0 = round(H * 0.216)
    gx1 = round(W * 0.715)
    gy1 = round(H * 0.234)
    draw.rectangle((gx0, gy0, gx1, gy1), fill=bg)

    im.save(path, "WEBP", quality=96, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    args = ap.parse_args()

    site = Path(args.site)
    name = "page-028.webp"

    page = site / "assets" / "pages" / name
    thumb = site / "assets" / "thumbs" / name

    if not page.exists():
        raise SystemExit(f"PAGE 28 HEADING: missing {page}")

    process(page)
    if thumb.exists():
        process(thumb)

    print("PAGE 28 HEADING: removed duplicate visual-page heading; all other content preserved.")


if __name__ == "__main__":
    main()
