#!/usr/bin/env python3
"""Restore bottom padding in the two marked cards on public page 28.

Physical page 31 is approved raster artwork from the catalog bundle. Keep its
frames, typography and technical profile at their original scale: translate
the box contents up 24 px and center the system paragraph vertically. Run after
header/folio cleanup, then derive the thumbnail from the corrected full page.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


PAGE_SIZE = (1600, 1132)
BOX_BACKGROUND = (248, 248, 246)
PAPER = (255, 255, 255)


def move_caption(image, source, bounds, dy, sample_x, background):
    """Move existing glyphs without carrying the old frame into the text.

    Both captions touch a horizontal frame. The unobstructed part of that same
    frame supplies each row's background: restore it under the old text, and
    remove that background from the translated crop. No wording is retyped.
    """
    x0, y0, x1, y1 = bounds
    caption = source.crop(bounds)
    pixels = caption.load()
    draw = ImageDraw.Draw(image)

    for y in range(y1 - y0):
        old_background = source.getpixel((sample_x, y0 + y))
        draw.line((x0, y0 + y, x1 - 1, y0 + y), fill=old_background)
        for x in range(x1 - x0):
            color = pixels[x, y]
            pixels[x, y] = tuple(
                max(0, min(255, background[c] + color[c] - old_background[c]))
                for c in range(3)
            )

    image.paste(caption, (x0, y0 + dy))


def correct_spacing(image):
    if image.size != PAGE_SIZE:
        raise ValueError(f"CARD SPACING: expected {PAGE_SIZE}, got {image.size}")
    source = image.convert("RGB")
    result = source.copy()

    # Preserve every original heading, specification and profile pixel. The
    # title retains 37 px of top padding; the caption gains 24 px below it.
    body = (810, 600, 1480, 862)
    ImageDraw.Draw(result).rectangle(
        (body[0], body[1], body[2] - 1, body[3] - 1), fill=BOX_BACKGROUND
    )
    result.paste(source.crop(body), (body[0], body[1] - 24))
    move_caption(result, source, (834, 863, 1420, 896), -24, 1400, BOX_BACKGROUND)

    # The short heading is already centered. Only the three-line paragraph
    # needs moving: its visible top and bottom then have about 18 px of padding.
    move_caption(result, source, (1110, 960, 1440, 1015), -18, 1460, PAPER)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    args = parser.parse_args()

    page = args.site / "assets/pages/page-031.webp"
    thumb = args.site / "assets/thumbs/page-031.webp"
    with Image.open(page) as image:
        corrected = correct_spacing(image)
    with Image.open(thumb) as image:
        thumb_size = image.size

    # Lossless output keeps every pixel outside the two edited cards intact.
    corrected.save(page, "WEBP", lossless=True, method=6)
    corrected.resize(thumb_size, Image.Resampling.LANCZOS).save(
        thumb, "WEBP", quality=92, method=6
    )
    print("CARD SPACING: corrected physical page 31 / public page 28 and thumbnail.")


if __name__ == "__main__":
    main()
