#!/usr/bin/env python3
"""
QA for the 42 mm sliding-door spread (public 26-27 / source 29-30).

Rules:
- title + subtitle stay only on the LEFT technical page (source 29);
- the RIGHT visual page (source 30) must have no duplicate title/subtitle;
- the left title must match the established 42 mm technical-title proportions
  used on source page 27 (double-door technical page).
"""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image

def dark_bbox(im, box, threshold=120):
    crop=im.crop(box).convert("L")
    pts=[]
    px=crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            if px[x,y] < threshold:
                pts.append((x,y))
    if not pts:
        return None,0
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    return (min(xs),min(ys),max(xs)+1,max(ys)+1),len(pts)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()
    site=Path(args.site)/"assets"/"pages"

    p27=Image.open(site/"page-027.webp").convert("RGB")
    p29=Image.open(site/"page-029.webp").convert("RGB")
    p30=Image.open(site/"page-030.webp").convert("RGB")
    W,H=p29.size

    # Header title band coordinates, same geometry on source 27 and 29.
    title_box=(round(W*.11),round(H*.16),round(W*.62),round(H*.29))
    b27,n27=dark_bbox(p27,title_box)
    b29,n29=dark_bbox(p29,title_box)
    if not b27 or not b29:
        raise SystemExit("SLIDING SPREAD QA: missing technical title block")

    # The title heights should be effectively identical to the established
    # technical page style. This catches accidental italic/small replacements.
    h27=b27[3]-b27[1]; h29=b29[3]-b29[1]
    if abs(h27-h29)>3:
        raise SystemExit(f"SLIDING SPREAD QA: title style mismatch: page27={h27}px page29={h29}px")

    # Visual page top-left area must be clean after duplicate heading removal.
    right_box=(round(W*.02),round(H*.035),round(W*.50),round(H*.18))
    _,dark=dark_bbox(p30,right_box,threshold=145)
    # Allow only a tiny amount of compression/noise; actual heading is thousands
    # of dark pixels.
    if dark>180:
        raise SystemExit(f"SLIDING SPREAD QA: duplicate visual-page heading remains ({dark} dark pixels)")

    print(f"SLIDING SPREAD QA passed: technical title standard height {h29}px; visual duplicate absent.")

if __name__=="__main__":
    main()
