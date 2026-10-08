#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw

BASE_W, BASE_H = 1600, 1132

# Areas in the approved back-cover raster that came from the generated artwork.
# We replace only the fake logo and the temporary catalog URL.
LOGO_CLEAR = (88, 62, 420, 184)
URL_CLEAR  = (280, 815, 530, 865)

# Official logo placement on the back cover.
LOGO_X, LOGO_Y = 102, 78
LOGO_W = 305


def avg_rgb(im, box):
    crop=im.crop(box).convert("RGB")
    px=list(crop.getdata())
    if not px:
        return (255,255,255)
    n=len(px)
    return tuple(sum(p[i] for p in px)//n for i in range(3))


def clear_rect_with_row_gradient(im, box):
    """Reconstruct the smooth architectural background from the box edges."""
    W,H=im.size
    sx,sy=W/BASE_W,H/BASE_H
    x0,y0,x1,y1=[round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box)]
    strip=max(4,round(8*sx))
    px=im.load()
    for y in range(max(0,y0),min(H,y1)):
        left_box=(max(0,x0-strip),y,min(W,x0),min(H,y+1))
        right_box=(max(0,x1),y,min(W,x1+strip),min(H,y+1))
        lc=avg_rgb(im,left_box)
        rc=avg_rgb(im,right_box)
        width=max(1,x1-x0-1)
        for x in range(max(0,x0),min(W,x1)):
            t=(x-x0)/width
            px[x,y]=tuple(round(lc[c]*(1-t)+rc[c]*t) for c in range(3))


def official_logo(path: Path):
    data=base64.b64decode(path.read_text().strip())
    logo=Image.open(BytesIO(data)).convert("RGBA")
    p=logo.load()
    for y in range(logo.height):
        for x in range(logo.width):
            r,g,b,a=p[x,y]
            if a==0:
                continue
            # Exact corporate artwork from hidden-doors.ru.
            # On this dark back cover only the black/neutral wordmark is
            # switched to white for contrast; the green brand mark is untouched.
            chroma=max(r,g,b)-min(r,g,b)
            is_green=(g>=90 and g>=r*1.15 and g>=b*1.10)
            if not is_green and chroma<45 and max(r,g,b)<190:
                p[x,y]=(255,255,255,a)
    return logo


def patch(page: Path, logo_b64: Path):
    im=Image.open(page).convert("RGB")
    W,H=im.size
    clear_rect_with_row_gradient(im, LOGO_CLEAR)
    clear_rect_with_row_gradient(im, URL_CLEAR)

    logo=official_logo(logo_b64)
    sx,sy=W/BASE_W,H/BASE_H
    target_w=round(LOGO_W*sx)
    target_h=round(logo.height*target_w/logo.width)
    logo=logo.resize((target_w,target_h),Image.Resampling.LANCZOS)
    x=round(LOGO_X*sx); y=round(LOGO_Y*sy)
    im.paste(logo,(x,y),logo)

    im.save(page,"WEBP",quality=96,method=6)
    print("BACK COVER BRANDING: official logo installed; temporary catalog URL removed.")


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--page",required=True)
    ap.add_argument("--logo-b64",required=True)
    args=ap.parse_args()
    patch(Path(args.page),Path(args.logo_b64))


if __name__=="__main__":
    main()
