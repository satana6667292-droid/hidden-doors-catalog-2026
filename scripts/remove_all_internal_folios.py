#!/usr/bin/env python3
"""
Remove every printed/internal page number without damaging catalog artwork.

The public viewer owns the only visible page number. Inside the page raster:
- remove audited historical folios/ranges using tight, page-specific masks;
- remove green FOLIO MASTER digits by masking only the green glyph pixels;
- never replace a large corner rectangle by copying neighbouring artwork;
- never touch technical green graphics outside the tiny footer corner zones.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import statistics

HIDDEN_PHYSICAL={24,25,26}

COLLECTION_FOOTER_SIDE={
    7:"right",8:"left",11:"right",12:"left",
    15:"right",16:"left",19:"right",20:"left",
}

PHOTO_PAGES={6,9,10,13,14,17,18,21}

LEGACY_MASKS={
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

def median_rgb(im,box):
    crop=im.crop(box).convert("RGB")
    px=list(crop.getdata())
    if not px:
        return (255,255,255)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))

def rect_px(im,mask):
    W,H=im.size
    x,y,w,h=mask
    x0=clamp(round(W*x/100),0,W-1)
    y0=clamp(round(H*y/100),0,H-1)
    x1=clamp(round(W*(x+w)/100),x0+1,W)
    y1=clamp(round(H*(y+h)/100),y0+1,H)
    return x0,y0,x1,y1

def fill_flat_mask(im,mask):
    """Fill a known folio rectangle with the local paper/background color."""
    W,H=im.size
    x0,y0,x1,y1=rect_px(im,mask)
    pad=max(3,round(W*.004))
    # Sample a ring around the target, excluding its own pixels.
    samples=[]
    boxes=[
        (max(0,x0-pad*3),max(0,y0-pad*2),x0,max(1,y1+pad*2)),
        (x1,max(0,y0-pad*2),min(W,x1+pad*3),min(H,y1+pad*2)),
        (max(0,x0-pad*2),max(0,y0-pad*3),min(W,x1+pad*2),y0),
        (max(0,x0-pad*2),y1,min(W,x1+pad*2),min(H,y1+pad*3)),
    ]
    for b in boxes:
        if b[2]>b[0] and b[3]>b[1]:
            samples.extend(list(im.crop(b).convert("RGB").getdata()))
    if samples:
        bg=tuple(int(statistics.median(ch)) for ch in zip(*samples))
    else:
        bg=(255,255,255)
    ImageDraw.Draw(im).rectangle((x0,y0,x1,y1),fill=bg)

def clear_collection_footer_box(im,side):
    W,H=im.size
    bg=median_rgb(im,(round(W*.42),round(H*.955),round(W*.58),round(H*.995)))
    y0=round(H*.935)
    if side=="left":
        box=(0,y0,round(W*.085),H)
    else:
        box=(round(W*.915),y0,W,H)
    ImageDraw.Draw(im).rectangle(box,fill=bg)

def green_mask(crop):
    src=crop.convert("RGB")
    out=Image.new("L",src.size,0)
    sp=src.load(); op=out.load()
    for y in range(src.height):
        for x in range(src.width):
            r,g,b=sp[x,y]
            # Tight Hidden Doors green / folio green detector.
            if g>=120 and (g-r)>=35 and (g-b)>=25 and r<=185:
                op[x,y]=255
    return out.filter(ImageFilter.MaxFilter(3))

def components(mask):
    w,h=mask.size
    px=mask.load()
    seen=bytearray(w*h)
    out=[]
    for y in range(h):
        for x in range(w):
            idx=y*w+x
            if seen[idx] or px[x,y]==0:
                continue
            q=deque([(x,y)]); seen[idx]=1
            x0=x1=x; y0=y1=y; n=0
            while q:
                xx,yy=q.popleft(); n+=1
                x0=min(x0,xx); x1=max(x1,xx)
                y0=min(y0,yy); y1=max(y1,yy)
                for ny in (yy-1,yy,yy+1):
                    if ny<0 or ny>=h: continue
                    for nx in (xx-1,xx,xx+1):
                        if nx<0 or nx>=w: continue
                        ni=ny*w+nx
                        if not seen[ni] and px[nx,ny]:
                            seen[ni]=1; q.append((nx,ny))
            out.append((x0,y0,x1+1,y1+1,n))
    return out

def remove_green_corner_folio(im,side,photo=False):
    """
    Remove only green numeral glyph pixels in the outer footer corner.
    A tiny local fill is used per component, so cards/photos are never replaced
    by a large pasted rectangle.
    """
    W,H=im.size
    cw=round(W*.095)
    ch=round(H*.085)
    rx0=0 if side=="left" else W-cw
    ry0=H-ch
    crop=im.crop((rx0,ry0,rx0+cw,H)).convert("RGB")
    mask=green_mask(crop)

    for x0,y0,x1,y1,n in components(mask):
        bw=x1-x0; bh=y1-y0
        # Folio glyphs/ranges only. Ignore long arrows/lines and tiny noise.
        if n<8 or bh<3 or bh>round(H*.045) or bw>round(W*.055):
            continue
        # Ignore components too high in the footer region.
        if y1 < round(ch*.28):
            continue

        ax0=rx0+x0; ay0=ry0+y0; ax1=rx0+x1; ay1=ry0+y1
        pad=max(2,round(W*.0015))
        ax0=max(0,ax0-pad); ay0=max(0,ay0-pad)
        ax1=min(W,ax1+pad); ay1=min(H,ay1+pad)

        # Local background ring. Works for white paper and small photo areas.
        ring=[]
        rp=max(3,round(W*.004))
        for box in (
            (max(0,ax0-rp*2),max(0,ay0-rp),ax0,min(H,ay1+rp)),
            (ax1,max(0,ay0-rp),min(W,ax1+rp*2),min(H,ay1+rp)),
            (max(0,ax0-rp),max(0,ay0-rp*2),min(W,ax1+rp),ay0),
            (max(0,ax0-rp),ay1,min(W,ax1+rp),min(H,ay1+rp*2)),
        ):
            if box[2]>box[0] and box[3]>box[1]:
                ring.extend(list(im.crop(box).convert("RGB").getdata()))
        bg=tuple(int(statistics.median(ch)) for ch in zip(*ring)) if ring else (255,255,255)

        # Paint only the dilated green mask pixels within this component box.
        fullmask=mask.crop((x0,y0,x1,y1)).resize((ax1-ax0,ay1-ay0))
        patch=Image.new("RGB",(ax1-ax0,ay1-ay0),bg)
        im.paste(patch,(ax0,ay0),fullmask)

def process(path,physical,public_no):
    im=Image.open(path).convert("RGB")

    # 36 mm model sheets: remove the complete old grey range label in its flat footer.
    if physical in COLLECTION_FOOTER_SIDE:
        clear_collection_footer_box(im,COLLECTION_FOOTER_SIDE[physical])
    else:
        for mask in LEGACY_MASKS.get(physical,[]):
            fill_flat_mask(im,mask)

    # Remove green FOLIO MASTER digits by glyph pixels only, from both corners.
    # This also catches a source page whose old number sits on the "wrong" side.
    if physical!=1:
        remove_green_corner_folio(im,"left",physical in PHOTO_PAGES)
        remove_green_corner_folio(im,"right",physical in PHOTO_PAGES)

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

    print(f"FOLIO CLEANUP: internal numbering removed without corner patch replacement on {len(seq)-1} non-cover pages.")

if __name__=="__main__":
    main()
