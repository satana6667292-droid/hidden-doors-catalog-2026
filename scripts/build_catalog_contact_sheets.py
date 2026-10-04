#!/usr/bin/env python3
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HIDDEN = {24,25,26}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    args=ap.parse_args()
    site=Path(args.site)
    out=site/"_qa"
    out.mkdir(parents=True, exist_ok=True)

    physical=[n for n in range(1,45) if n not in HIDDEN]
    cols, rows = 3, 3
    tile_w, tile_h = 594, 420
    label_h=28
    bg=(230,230,228)
    font=ImageFont.load_default()

    sheets=[]
    for si in range(0,len(physical),cols*rows):
        chunk=physical[si:si+cols*rows]
        sheet=Image.new("RGB",(cols*tile_w,rows*(tile_h+label_h)),bg)
        d=ImageDraw.Draw(sheet)
        for j,n in enumerate(chunk):
            p=site/"assets"/"pages"/f"page-{n:03d}.webp"
            if not p.exists():
                raise SystemExit(f"QA missing page: {p}")
            im=Image.open(p).convert("RGB")
            if im.width <= 0 or im.height <= 0:
                raise SystemExit(f"QA invalid page dimensions: {p}")
            im.thumbnail((tile_w,tile_h),Image.Resampling.LANCZOS)
            x=(j%cols)*tile_w
            y=(j//cols)*(tile_h+label_h)
            px=x+(tile_w-im.width)//2
            py=y+(tile_h-im.height)//2
            sheet.paste(im,(px,py))
            d.rectangle((x,y+tile_h,x+tile_w,y+tile_h+label_h),fill=(250,250,250))
            d.text((x+8,y+tile_h+8),f"physical {n:02d}",fill=(20,20,20),font=font)
        path=out/f"contact-{si//(cols*rows)+1:02d}.webp"
        sheet.save(path,"WEBP",quality=86,method=6)
        sheets.append(path)

    print(f"QA contact sheets: {len(sheets)} for {len(physical)} public pages.")

if __name__=="__main__":
    main()
