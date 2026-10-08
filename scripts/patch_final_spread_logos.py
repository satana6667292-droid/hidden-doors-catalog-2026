#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw

BASE_W, BASE_H = 1600, 1132

# Approved closing spread pages: generated logos are replaced by the official
# Hidden Doors artwork from hidden-doors.ru. No other page content is touched.
PAGES = {
    43: {
        "clear": (55, 30, 390, 145),
        "x": 72, "y": 47, "w": 305,
    },
    44: {
        "clear": (70, 30, 400, 145),
        "x": 92, "y": 47, "w": 305,
    },
}


def load_logo(path: Path) -> Image.Image:
    data=base64.b64decode(path.read_text().strip())
    return Image.open(BytesIO(data)).convert("RGBA")


def avg_rgb(im: Image.Image, box):
    crop=im.crop(box).convert("RGB")
    px=list(crop.getdata())
    if not px:
        return (255,255,255)
    n=len(px)
    return tuple(sum(p[i] for p in px)//n for i in range(3))


def clear_to_local_paper(im: Image.Image, box):
    W,H=im.size
    sx,sy=W/BASE_W,H/BASE_H
    x0,y0,x1,y1=box
    x0,y0,x1,y1=round(x0*sx),round(y0*sy),round(x1*sx),round(y1*sy)
    pad=max(8,round(14*sx))
    sample_boxes=[
        (max(0,x0-pad),max(0,y0-pad),min(W,x1+pad),y0),
        (max(0,x0-pad),y1,min(W,x1+pad),min(H,y1+pad)),
        (max(0,x0-pad),y0,x0,y1),
        (x1,y0,min(W,x1+pad),y1),
    ]
    colors=[avg_rgb(im,b) for b in sample_boxes if b[2]>b[0] and b[3]>b[1]]
    if colors:
        bg=tuple(sum(c[i] for c in colors)//len(colors) for i in range(3))
    else:
        bg=(255,255,255)
    ImageDraw.Draw(im).rectangle((x0,y0,x1,y1),fill=bg)


def patch(page: Path, physical: int, logo: Image.Image):
    cfg=PAGES[physical]
    im=Image.open(page).convert("RGB")
    W,H=im.size
    sx,sy=W/BASE_W,H/BASE_H
    clear_to_local_paper(im,cfg["clear"])

    target_w=round(cfg["w"]*sx)
    target_h=round(logo.height*target_w/logo.width)
    scaled=logo.resize((target_w,target_h),Image.Resampling.LANCZOS)
    x=round(cfg["x"]*sx)
    y=round(cfg["y"]*sy)
    im.paste(scaled,(x,y),scaled)
    im.save(page,"WEBP",quality=96,method=6)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    ap.add_argument("--logo-b64",required=True)
    args=ap.parse_args()

    site=Path(args.site)
    logo=load_logo(Path(args.logo_b64))
    for physical in (43,44):
        page=site/"assets"/"pages"/f"page-{physical:03d}.webp"
        if not page.exists():
            raise SystemExit(f"FINAL LOGO PATCH: missing {page}")
        patch(page,physical,logo)

    print("FINAL LOGO PATCH: official Hidden Doors logo installed on physical pages 43-44.")


if __name__=="__main__":
    main()
