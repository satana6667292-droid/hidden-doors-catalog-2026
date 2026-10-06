#!/usr/bin/env python3
"""
Remove decorative green header accent bars across the public catalog.

Design rule:
- no standalone green header stripes/bars anywhere in the page artwork;
- Hidden Doors logos, green technical diagrams, bullets and status badges remain;
- only filled horizontal green rectangles in the top header zone are removed.

This gives one consistent catalog-wide treatment instead of several incompatible
bar lengths, thicknesses and positions.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import statistics

HIDDEN_PHYSICAL={24,25,26}

# Audited bars that sit close to title/status geometry and can merge with nearby
# green pixels in generic component detection. Percentages: x, y, w, h.
EXPLICIT_BAR_MASKS={
    33:[(1.8,2.8,7.0,1.8)],   # 59 mm — mirror and glass
    34:[(1.8,2.8,7.0,1.8)],   # 59 mm — bamboo
    35:[(1.6,2.4,7.5,2.2)],   # 59 mm — HPL: stray green bar above logo
    38:[(25.8,1.7,5.2,1.7)],  # 59 mm — artificial stone
    43:[(3.2,6.6,6.4,1.8)],   # contacts/catalog/configurator
}

def pages():
    return [p for p in range(1,45) if p not in HIDDEN_PHYSICAL]

def green_mask(crop: Image.Image) -> Image.Image:
    src=crop.convert("RGB")
    out=Image.new("L",src.size,0)
    sp=src.load(); op=out.load()
    for y in range(src.height):
        for x in range(src.width):
            r,g,b=sp[x,y]
            if g>=120 and (g-r)>=35 and (g-b)>=25 and r<=185:
                op[x,y]=255
    return out.filter(ImageFilter.MaxFilter(3))

def components(mask: Image.Image):
    w,h=mask.size; px=mask.load(); seen=bytearray(w*h); out=[]
    for y in range(h):
        for x in range(w):
            i=y*w+x
            if seen[i] or not px[x,y]:
                continue
            q=deque([(x,y)]); seen[i]=1
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

def median_rgb(im: Image.Image, boxes):
    px=[]
    for box in boxes:
        if box[2]>box[0] and box[3]>box[1]:
            px.extend(list(im.crop(box).convert("RGB").getdata()))
    if not px:
        return (255,255,255)
    return tuple(int(statistics.median(ch)) for ch in zip(*px))

def is_accent_bar(comp, W, H):
    x0,y0,x1,y1,n=comp
    bw=x1-x0; bh=y1-y0
    if bw < W*0.022 or bw > W*0.135:
        return False
    if bh < max(2,H*0.0015) or bh > H*0.022:
        return False
    if bw/max(1,bh) < 4.8:
        return False
    fill=n/max(1,bw*bh)
    # Filled decorative bars pass; outline badges/status pills do not.
    if fill < 0.42:
        return False
    return True

def clear_explicit_masks(im: Image.Image, masks):
    W,H=im.size
    draw=ImageDraw.Draw(im)
    cleared=[]
    for x,y,w,h in masks:
        x0=max(0,round(W*x/100)); y0=max(0,round(H*y/100))
        x1=min(W,round(W*(x+w)/100)); y1=min(H,round(H*(y+h)/100))
        rp=max(4,round(W*.004))
        bg=median_rgb(im,[
            (max(0,x0-rp*2),max(0,y0-rp),x0,min(H,y1+rp)),
            (x1,max(0,y0-rp),min(W,x1+rp*2),min(H,y1+rp)),
            (max(0,x0-rp),max(0,y0-rp*2),min(W,x1+rp),y0),
            (max(0,x0-rp),y1,min(W,x1+rp),min(H,y1+rp*2)),
        ])
        draw.rectangle((x0,y0,x1,y1),fill=bg)
        cleared.append((x0,y0,x1,y1))
    return cleared

def detect_bars(im: Image.Image):
    """Detect bars on a 1/4-scale header for speed; return full-res boxes."""
    W,H=im.size
    header_h=round(H*0.22)
    scale=4
    sw=max(1,W//scale)
    sh=max(1,header_h//scale)
    small=im.crop((0,0,W,header_h)).resize((sw,sh),Image.Resampling.BILINEAR)
    comps=components(green_mask(small))

    boxes=[]
    for x0,y0,x1,y1,n in comps:
        # Evaluate geometry in full-resolution equivalents.
        fx0=x0*scale; fy0=y0*scale
        fx1=min(W,x1*scale); fy1=min(header_h,y1*scale)
        bw=fx1-fx0; bh=fy1-fy0
        if bw < W*0.022 or bw > W*0.135:
            continue
        if bh < max(2,H*0.0015) or bh > H*0.022:
            continue
        if bw/max(1,bh) < 4.8:
            continue
        fill=n/max(1,(x1-x0)*(y1-y0))
        if fill < 0.35:
            continue
        boxes.append((fx0,fy0,fx1,fy1))
    return boxes

def remove_bars(im: Image.Image):
    W,H=im.size
    removed=[]
    draw=ImageDraw.Draw(im)

    for x0,y0,x1,y1 in detect_bars(im):
        pad=max(2,round(W*.0015))
        ax0=max(0,x0-pad); ay0=max(0,y0-pad)
        ax1=min(W,x1+pad); ay1=min(H,y1+pad)

        rp=max(4,round(W*.004))
        bg=median_rgb(im,[
            (max(0,ax0-rp*2),max(0,ay0-rp),ax0,min(H,ay1+rp)),
            (ax1,max(0,ay0-rp),min(W,ax1+rp*2),min(H,ay1+rp)),
            (max(0,ax0-rp),max(0,ay0-rp*2),min(W,ax1+rp),ay0),
            (max(0,ax0-rp),ay1,min(W,ax1+rp),min(H,ay1+rp*2)),
        ])
        draw.rectangle((ax0,ay0,ax1,ay1),fill=bg)
        removed.append((ax0,ay0,ax1,ay1))
    return removed

def process(path: Path, physical: int):
    im=Image.open(path).convert("RGB")
    removed=[]
    removed.extend(clear_explicit_masks(im, EXPLICIT_BAR_MASKS.get(physical,[])))
    removed.extend(remove_bars(im))

    # Release guard: after cleanup there must be no remaining decorative bar
    # matching the same catalog-wide signature.
    leftovers=detect_bars(im)
    if leftovers:
        raise RuntimeError(f"HEADER ACCENTS QA failed for {path.name}: {leftovers}")

    im.save(path,"WEBP",quality=96,method=6)
    return removed

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()
    site=Path(args.site)

    total=0
    touched=[]
    for physical in pages():
        name=f"page-{physical:03d}.webp"
        page=site/"assets"/"pages"/name
        thumb=site/"assets"/"thumbs"/name
        if not page.exists():
            raise SystemExit(f"HEADER ACCENTS: missing {page}")
        removed=process(page,physical)
        if removed:
            touched.append((physical,len(removed)))
            total+=len(removed)
        if thumb.exists():
            process(thumb,physical)

    details=", ".join(f"{p:02d}x{n}" for p,n in touched)
    print(f"HEADER ACCENTS: removed {total} decorative green bars. Pages: {details or 'none'}.")


if __name__=="__main__":
    main()
