#!/usr/bin/env python3
"""
Remove the duplicate heading block from source page 30
(public 27 — 42 mm sliding-door visual page).

Decision: keep the title on the left technical page (public 26) and remove the
duplicate title + subtitle from the right visual page. All other content stays
unchanged: logo, image, footer caption and page artwork.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw
import statistics


def median_rgb(im: Image.Image, box):
    crop=im.crop(box).convert("RGB")
    px=list(crop.getdata())
    if not px:
        return (255,255,255)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))


def process(path: Path):
    im=Image.open(path).convert("RGB")
    W,H=im.size

    # Clean paper sample from the same upper header band.
    bg=median_rgb(
        im,
        (
            round(W*0.43),
            round(H*0.025),
            round(W*0.57),
            round(H*0.055),
        ),
    )

    # Audited box containing only:
    # "42 мм — откатная дверь"
    # "Полотно под откатную систему — без дверного короба"
    # Stops well before the product image and far from the logo.
    x0=round(W*0.035)
    y0=round(H*0.055)
    x1=round(W*0.455)
    y1=round(H*0.158)

    ImageDraw.Draw(im).rectangle((x0,y0,x1,y1),fill=bg)
    im.save(path,"WEBP",quality=96,method=6)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()

    site=Path(args.site)
    name="page-030.webp"
    page=site/"assets"/"pages"/name
    thumb=site/"assets"/"thumbs"/name

    if not page.exists():
        raise SystemExit(f"PAGE 30 HEADING: missing {page}")

    process(page)
    if thumb.exists():
        process(thumb)

    print("PAGE 30 HEADING: removed duplicate sliding-door title block from visual page.")


if __name__=="__main__":
    main()
