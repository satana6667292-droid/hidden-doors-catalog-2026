#!/usr/bin/env python3
"""
Footer QA guard.

After internal folio cleanup:
- inspect both bottom corners of every public page;
- fail the build if green folio-like glyphs remain in a corner;
- write one footer contact sheet covering every public page for visual QA.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HIDDEN={24,25,26}

def pages():
    physical=[p for p in range(1,45) if p not in HIDDEN]
    return [(p,i+1) for i,p in enumerate(physical)]

def green_mask(crop):
    src=crop.convert("RGB")
    out=Image.new("L",src.size,0)
    sp=src.load(); op=out.load()
    for y in range(src.height):
        for x in range(src.width):
            r,g,b=sp[x,y]
            if g>=120 and (g-r)>=35 and (g-b)>=25 and r<=185:
                op[x,y]=255
    return out.filter(ImageFilter.MaxFilter(3))

def components(mask):
    w,h=mask.size; px=mask.load(); seen=bytearray(w*h); out=[]
    for y in range(h):
        for x in range(w):
            idx=y*w+x
            if seen[idx] or px[x,y]==0: continue
            q=deque([(x,y)]); seen[idx]=1
            x0=x1=x; y0=y1=y; n=0
            while q:
                xx,yy=q.popleft(); n+=1
                x0=min(x0,xx);x1=max(x1,xx);y0=min(y0,yy);y1=max(y1,yy)
                for ny in (yy-1,yy,yy+1):
                    if ny<0 or ny>=h: continue
                    for nx in (xx-1,xx,xx+1):
                        if nx<0 or nx>=w: continue
                        ni=ny*w+nx
                        if not seen[ni] and px[nx,ny]:
                            seen[ni]=1;q.append((nx,ny))
            out.append((x0,y0,x1+1,y1+1,n))
    return out

def folio_like_green(crop):
    W,H=crop.size
    bad=[]
    for x0,y0,x1,y1,n in components(green_mask(crop)):
        bw=x1-x0; bh=y1-y0
        if n>=8 and bh>=3 and bh<=H*.55 and bw<=W*.65 and y1>=H*.30:
            # Long horizontal/vertical rules are not folios.
            if bw/max(1,bh)>5.0 or bh/max(1,bw)>5.5:
                continue
            bad.append((x0,y0,x1,y1,n))
    return bad

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()
    site=Path(args.site)
    outdir=site/"_qa"
    outdir.mkdir(parents=True,exist_ok=True)

    tile_w,tile_h,label_h=300,105,18
    cols=4
    entries=[]
    failures=[]

    for physical,public_no in pages():
        path=site/"assets"/"pages"/f"page-{physical:03d}.webp"
        im=Image.open(path).convert("RGB")
        W,H=im.size
        y0=round(H*.89); cw=round(W*.16)
        left=im.crop((0,y0,cw,H))
        right=im.crop((W-cw,y0,W,H))

        for side,crop in (("L",left),("R",right)):
            bad=folio_like_green(crop)
            if bad:
                failures.append((physical,public_no,side,bad))

        combo=Image.new("RGB",(cw*2,H-y0),"white")
        combo.paste(left,(0,0));combo.paste(right,(cw,0))
        combo=combo.resize((tile_w,tile_h),Image.Resampling.LANCZOS)
        entries.append((physical,public_no,combo))

    rows=(len(entries)+cols-1)//cols
    sheet=Image.new("RGB",(cols*tile_w,rows*(tile_h+label_h)),(225,225,225))
    d=ImageDraw.Draw(sheet)
    font=ImageFont.load_default()
    for i,(physical,public_no,im) in enumerate(entries):
        x=(i%cols)*tile_w;y=(i//cols)*(tile_h+label_h)
        sheet.paste(im,(x,y))
        d.text((x+4,y+tile_h+2),f"public {public_no:02d} / source {physical:02d}",fill=(20,20,20),font=font)
    sheet.save(outdir/"footer-audit.webp","WEBP",quality=88,method=6)

    if failures:
        msg="; ".join(f"public {pub:02d}/source {phys:02d} {side}" for phys,pub,side,_ in failures)
        raise SystemExit("FOOTER QA FAILED: green folio-like remnants: "+msg)

    print(f"FOOTER QA passed for {len(entries)} public pages.")

if __name__=="__main__":
    main()
