#!/usr/bin/env python3
"""
Remove every printed/internal page number from catalog raster assets.

The public viewer already shows the canonical black page number below each sheet.
Therefore any number printed inside the sheet is a duplicate and must be removed.

Rules:
- remove all audited historical folios/range labels;
- remove the previously baked green FOLIO MASTER number on every non-cover page;
- do not add a replacement printed folio;
- preserve real technical content by using explicit masks only.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image
import statistics

HIDDEN_PHYSICAL = {24, 25, 26}

# The 36 mm model sheets used small legacy range/page boxes in the outer
# bottom corner. These sit on a flat warm background, so clear the whole box
# instead of copying a neighbouring patch (which can drag letters/numbers into
# the corner and create artifacts like "S", "14", "R").
COLLECTION_FOOTER_SIDE = {
    7:"right", 8:"left", 11:"right", 12:"left",
    15:"right", 16:"left", 19:"right", 20:"left",
}

# Audited historical folio rectangles from the existing FOLIO MASTER cleanup.
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

def public_sequence():
    physical=[p for p in range(1,45) if p not in HIDDEN_PHYSICAL]
    return {p:i+1 for i,p in enumerate(physical)}

def clamp(v,lo,hi):
    return max(lo,min(hi,v))

def median_rgb(im, box):
    crop=im.crop(box).convert("RGB")
    px=list(crop.getdata())
    if not px:
        return (248,247,243)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))

def clear_collection_footer_box(im, side):
    """Erase the complete legacy number/range box on collection model sheets."""
    W,H=im.size
    # Sample the flat paper background from the bottom centre gutter.
    bg=median_rgb(im,(round(W*0.45),round(H*0.965),round(W*0.55),round(H*0.995)))
    y0=round(H*0.925)
    y1=H
    if side=="left":
        x0=0
        x1=round(W*0.095)
    else:
        x0=round(W*0.905)
        x1=W
    from PIL import ImageDraw
    ImageDraw.Draw(im).rectangle((x0,y0,x1,y1),fill=bg)

def repair_mask(im, mask):
    W,H=im.size
    x,y,w,h=mask
    tx=clamp(round(W*x/100),0,W-1)
    ty=clamp(round(H*y/100),0,H-1)
    tw=clamp(round(W*w/100),1,W-tx)
    th=clamp(round(H*h/100),1,H-ty)

    center=(x+w/2)/100
    shift=max(round(W*0.055),tw*2)
    src_x=tx-shift if center>0.5 else tx+shift
    src_x=clamp(src_x,0,W-tw)
    patch=im.crop((src_x,ty,src_x+tw,ty+th))
    im.paste(patch,(tx,ty))

def master_mask(public_no):
    # Previously baked FOLIO MASTER: 8 mm from outer trim, 5 mm from bottom.
    # This box is intentionally small enough not to touch footer notes.
    if public_no % 2 == 0:
        return (1.8, 92.7, 6.2, 5.8)
    return (92.0, 92.7, 6.2, 5.8)

def process(path, physical, public_no):
    im=Image.open(path).convert("RGB")

    # First remove any older embedded folio/range label.
    if physical in COLLECTION_FOOTER_SIDE:
        clear_collection_footer_box(im, COLLECTION_FOOTER_SIDE[physical])
    else:
        for mask in LEGACY_MASKS.get(physical,[]):
            repair_mask(im,mask)

    # Then remove the global green FOLIO MASTER number itself.
    if physical != 1:
        repair_mask(im,master_mask(public_no))

    im.save(path,"WEBP",quality=96,method=6)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()

    site=Path(args.site)
    seq=public_sequence()

    for physical,public_no in seq.items():
        name=f"page-{physical:03d}.webp"
        page=site/"assets"/"pages"/name
        thumb=site/"assets"/"thumbs"/name
        if not page.exists():
            raise SystemExit(f"FOLIO CLEANUP: missing {page}")
        process(page,physical,public_no)
        if thumb.exists():
            process(thumb,physical,public_no)

    print(f"FOLIO CLEANUP: removed all internal page numbers from {len(seq)-1} non-cover public pages.")

if __name__=="__main__":
    main()
