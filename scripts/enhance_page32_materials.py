#!/usr/bin/env python3
from __future__ import annotations
import argparse, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

W0,H0=1448,1024
# image-only areas inside the existing 2x4 cards on source page 32
BOXES=[
    (66,371,201,490),(212,371,347,490),(359,371,494,490),(506,371,641,490),
    (66,552,201,671),(212,552,347,671),(359,552,494,671),(506,552,641,671),
]
SEED=59032

def fit_box(box,W,H):
    sx,sy=W/W0,H/H0
    return tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box))

def noise_img(size, base, amount=14, seed=0):
    rnd=random.Random(seed)
    w,h=size
    im=Image.new("RGB",size,base)
    p=im.load()
    for y in range(h):
        for x in range(w):
            n=rnd.randint(-amount,amount)
            p[x,y]=tuple(max(0,min(255,c+n)) for c in base)
    return im.filter(ImageFilter.GaussianBlur(.45))

def add_vignette(im, strength=.12):
    w,h=im.size
    ov=Image.new("L",(w,h),0); p=ov.load()
    cx,cy=w/2,h/2
    md=math.hypot(cx,cy)
    for y in range(h):
        for x in range(w):
            d=math.hypot(x-cx,y-cy)/md
            p[x,y]=int(255*min(1,d)*strength)
    shade=Image.new("RGB",(w,h),(25,25,25))
    im.paste(shade,(0,0),ov)
    return im

def glass(size):
    w,h=size
    im=Image.new("RGB",size,(229,242,242)); d=ImageDraw.Draw(im)
    for x in range(w):
        t=x/max(1,w-1)
        c=(int(235-20*t),int(247-15*t),int(247-10*t))
        d.line((x,0,x,h),fill=c)
    d.rectangle((w*.76,0,w*.80,h),fill=(51,155,147))
    d.rectangle((w*.80,0,w*.825,h),fill=(179,227,222))
    # soft window reflection
    refl=Image.new("RGBA",size,(0,0,0,0)); rd=ImageDraw.Draw(refl)
    rd.polygon([(0,h*.1),(w*.38,0),(w*.7,0),(0,h*.55)],fill=(255,255,255,70))
    return Image.alpha_composite(im.convert("RGBA"),refl).convert("RGB")

def mirror(size):
    w,h=size
    im=Image.new("RGB",size,(202,205,207)); d=ImageDraw.Draw(im)
    for y in range(h):
        v=int(188+45*y/max(1,h-1)); d.line((0,y,w,y),fill=(v,v+2,v+4))
    d.polygon([(0,h*.02),(w*.62,0),(w*.18,h),(0,h)],fill=(247,248,249))
    d.polygon([(w*.24,0),(w*.58,0),(0,h*.82),(0,h*.52)],fill=(229,232,234))
    return im.filter(ImageFilter.GaussianBlur(.35))

def hpl(size):
    im=noise_img(size,(82,84,83),10,SEED+3)
    d=ImageDraw.Draw(im); rnd=random.Random(SEED+33)
    for _ in range(650):
        x=rnd.randrange(size[0]); y=rnd.randrange(size[1]); a=rnd.randrange(20,50)
        d.point((x,y),fill=(a+55,a+55,a+54))
    return add_vignette(im,.08)

def bamboo(size):
    w,h=size
    im=noise_img(size,(193,139,65),6,SEED+4); d=ImageDraw.Draw(im)
    widths=[10,12,9,13,10,11,12,9,13,10,12,11,9,13]
    x=0; i=0
    while x<w:
        bw=widths[i%len(widths)]
        col=(201+(i%3)*7,150+(i%4)*4,72+(i%2)*8)
        d.rectangle((x,0,min(w,x+bw),h),fill=col)
        d.line((x,0,x,h),fill=(126,91,49),width=1)
        # node variation
        yy=(i*29)%max(1,h)
        d.rectangle((x,yy,min(w,x+bw),min(h,yy+2)),fill=(160,111,55))
        x+=bw; i+=1
    return im.filter(ImageFilter.GaussianBlur(.2))

def veneer(size):
    w,h=size
    im=noise_img(size,(135,93,55),7,SEED+5); d=ImageDraw.Draw(im)
    rnd=random.Random(SEED+55)
    for i in range(34):
        x=i*w/34+rnd.uniform(-4,4)
        pts=[]
        phase=rnd.random()*6
        for y in range(-5,h+6,5):
            xx=x+math.sin(y*.055+phase)*rnd.uniform(2,7)
            pts.append((xx,y))
        d.line(pts,fill=(90+rnd.randrange(0,22),62,38),width=rnd.choice([1,1,2]))
    for _ in range(5):
        cx=rnd.randrange(w); cy=rnd.randrange(h)
        d.ellipse((cx-10,cy-3,cx+10,cy+3),outline=(94,60,35),width=1)
    return im.filter(ImageFilter.GaussianBlur(.25))

def mdf(size):
    w,h=size
    im=noise_img(size,(224,222,215),3,SEED+6); d=ImageDraw.Draw(im)
    grooves=[w*.28,w*.50,w*.72]
    for gx in grooves:
        d.line((gx,8,gx,h-8),fill=(164,163,158),width=2)
        d.line((gx+3,8,gx+3,h-8),fill=(247,246,242),width=2)
    return im

def porcelain(size):
    w,h=size
    im=noise_img(size,(165,166,163),7,SEED+7); d=ImageDraw.Draw(im)
    rnd=random.Random(SEED+77)
    for k in range(5):
        x0=rnd.randint(-20,w//3); y0=rnd.randint(0,h)
        pts=[(x0,y0)]
        x,y=x0,y0
        for _ in range(7):
            x+=rnd.randint(18,42); y+=rnd.randint(-20,20); pts.append((x,y))
        d.line(pts,fill=(220,220,216),width=rnd.choice([1,2]))
        if k<2:d.line([(a+1,b+1) for a,b in pts],fill=(120,122,121),width=1)
    return im.filter(ImageFilter.GaussianBlur(.25))

def stone(size):
    w,h=size
    im=noise_img(size,(221,214,199),7,SEED+8); d=ImageDraw.Draw(im)
    rnd=random.Random(SEED+88)
    for _ in range(900):
        x=rnd.randrange(w); y=rnd.randrange(h)
        c=rnd.choice([(196,187,170),(235,231,219),(177,169,153)])
        d.point((x,y),fill=c)
    for k in range(3):
        pts=[]; x=-10; y=rnd.randrange(h)
        while x<w+10:
            pts.append((x,y)); x+=rnd.randint(20,40); y+=rnd.randint(-14,14)
        d.line(pts,fill=(184,174,157),width=1)
    return im.filter(ImageFilter.GaussianBlur(.2))

MAKERS=[glass,mirror,hpl,bamboo,veneer,mdf,porcelain,stone]

def top_rounded_mask(size,r=12):
    w,h=size
    m=Image.new("L",size,0)
    d=ImageDraw.Draw(m)
    d.rounded_rectangle((0,0,w-1,h+2*r),radius=r,fill=255)
    d.rectangle((0,r,w,h),fill=255)
    return m

def enhance(path:Path):
    im=Image.open(path).convert("RGB")
    W,H=im.size
    for i,raw in enumerate(BOXES):
        x0,y0,x1,y1=fit_box(raw,W,H)
        size=(x1-x0,y1-y0)
        tex=MAKERS[i](size)
        tex=ImageEnhance.Contrast(tex).enhance(1.06)
        mask=top_rounded_mask(size,max(6,round(size[0]*.07)))
        im.paste(tex,(x0,y0),mask)
    im.save(path,"WEBP",quality=96,method=6)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--site",required=True); args=ap.parse_args()
    site=Path(args.site)
    for root in ("pages","thumbs"):
        p=site/"assets"/root/"page-032.webp"
        if p.exists(): enhance(p)
    print("PAGE 32 MATERIALS: replaced 8 schematic swatches with realistic high-resolution textures.")

if __name__=="__main__":
    main()
