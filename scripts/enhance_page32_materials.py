#!/usr/bin/env python3
"""Insert eight photorealistic material images into public page 29.

Physical page 32 supplies the layout, captions and technical copy. Replace only
the eight image windows with committed assets; no generation runs at deploy.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


BASE_SIZE = (1448, 1024)
ASSET_DIRECTORY = Path(__file__).resolve().parents[1] / "material-assets/photoreal-swatches"
SWATCHES = (
    ("glass", (66, 371, 201, 490)),
    ("mirror", (212, 371, 347, 490)),
    ("hpl", (359, 371, 494, 490)),
    ("bamboo", (506, 371, 641, 490)),
    ("veneer", (66, 552, 201, 671)),
    ("mdf", (212, 552, 347, 671)),
    ("porcelain", (359, 552, 494, 671)),
    ("stone", (506, 552, 641, 671)),
)


def load_swatches():
    images = {}
    for name, _ in SWATCHES:
        path = ASSET_DIRECTORY / f"{name}.webp"
        with Image.open(path) as image:
            if min(image.size) < 512:
                raise ValueError(f"MATERIAL SWATCH: source too small: {path}")
            images[name] = image.convert("RGB")
    return images


def fit_box(bounds, size):
    sx, sy = size[0] / BASE_SIZE[0], size[1] / BASE_SIZE[1]
    return tuple(round(value * (sx if i % 2 == 0 else sy)) for i, value in enumerate(bounds))


def rounded_top_mask(size):
    # Preserve the rounded image tops and square image/caption seam.
    scale = 4
    width, height = size[0] * scale, size[1] * scale
    radius = max(6, round(size[0] * 0.07)) * scale
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, width - 1, height + radius), radius=radius, fill=255)
    draw.rectangle((0, radius, width - 1, height - 1), fill=255)
    return mask.resize(size, Image.Resampling.LANCZOS)


def compose_swatches(image, swatches):
    result = image.convert("RGB")
    for name, bounds in SWATCHES:
        x0, y0, x1, y1 = fit_box(bounds, result.size)
        size = (x1 - x0, y1 - y0)
        photo = ImageOps.fit(swatches[name], size, method=Image.Resampling.LANCZOS)
        result.paste(photo, (x0, y0), rounded_top_mask(size))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    args = parser.parse_args()
    swatches = load_swatches()

    for root in ("pages", "thumbs"):
        path = args.site / "assets" / root / "page-032.webp"
        with Image.open(path) as image:
            result = compose_swatches(image, swatches)
        result.save(path, "WEBP", quality=97, method=6)

    print("PAGE 32 MATERIALS: installed eight photorealistic assets and matching thumbnails.")


if __name__ == "__main__":
    main()
