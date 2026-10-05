#!/usr/bin/env python3
from __future__ import annotations
import argparse, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

W0,H0=1448,1024
BOXES=[
    (66,371,201,490),(212,371,347,490),(359,371,494,490),(506,371,641,490),
    (66,552,201,671),(212,552,347,671),(359,552,494,671),(506,552,641,671),
]
SEED=59032026

def fit_box(box,W,H):
    sx,sy=W/W0,H/H0
    return tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box))

def clamp(v): return max(0,min(255,int(v)))

def noise(size, base, amount, seed):
    rnd=random.Random(seed); w,h=size
    im=Image.new("RGB",size,base); p=im.load()
    for y in range(h):
        for x in range(w):
            n=rnd.gauss(0,amount)
            p[x,y]=tuple(clamp(c+n) for c in base)
    return im.filter(ImageFilter.GaussianBlur(.35))

def soft_light(im, strength=.18):
    w,h=im.size
    ov=Image.new("RGBA",size=im.size,color=(0,0,0,0)); d=ImageDraw.Draw(ov)
    d.ellipse((-w*.25,-h*.45,w*.9,h*.55),fill=(255,255,255,int(255*strength)))
    return Image.alpha_composite(im.convert("RGBA"),ov).convert("RGB")

def glass(size):
    w,h=size
    im=Image.new("RGB",size); p=im.load()
    for y in range(h):
        for x in range(w):
            tx=x/max(1,w-1); ty=y/max(1,h-1)
            p[x,y]=(clamp(232-13*tx+4*ty),clamp(247-8*tx),clamp(247-4*tx))
    # dark glass edge + green tint
    d=ImageDraw.Draw(im)
    edge=int(w*.78)
    d.rectangle((edge,0,edge+max(2,int(w*.025)),h),fill=(25,111,107))
    d.rectangle((edge+max(2,int(w*.025)),0,edge+max(3,int(w*.055)),h),fill=(126,206,201))
    # real-world reflections
    ov=Image.new("RGBA",size,(0,0,0,0)); od=ImageDraw.Draw(ov)
    od.polygon([(0,h*.05),(w*.44,0),(w*.72,0),(0,h*.62)],fill=(255,255,255,105))
    od.polygon([(w*.08,h),(w*.48,h),(w*.86,0),(w*.67,0)],fill=(178,211,214,34))
    return Image.alpha_composite(im.convert("RGBA"),ov).convert("RGB").filter(ImageFilter.GaussianBlur(.25))

def mirror(size):
    w,h=size
    im=Image.new("RGB",size)
    p=im.load()
    for y in range(h):
        for x in range(w):
            v=clamp(188+48*(1-y/max(1,h-1))+8*x/max(1,w-1))
            p[x,y]=(v,v+1 if v<254 else v,v+3 if v<252 else v)
    d=ImageDraw.Draw(im)
    d.polygon([(0,0),(w*.58,0),(w*.08,h),(0,h)],fill=(246,247,248))
    d.polygon([(w*.25,0),(w*.55,0),(0,h*.78),(0,h*.52)],fill=(225,228,231))
    d.line((w*.63,0,w*.17,h),fill=(255,255,255),width=max(1,int(w*.02)))
    return im.filter(ImageFilter.GaussianBlur(.5))

def hpl(size):
    w,h=size
    im=noise(size,(71,72,71),7,SEED+3); d=ImageDraw.Draw(im); rnd=random.Random(SEED+30)
    # very fine embossed HPL texture
    for _ in range(int(w*h*.11)):
        x=rnd.randrange(w); y=rnd.randrange(h)
        v=rnd.choice([52,58,64,80,88])
        d.point((x,y),fill=(v,v,v))
    for _ in range(28):
        x=rnd.randrange(w); y=rnd.randrange(h)
        d.arc((x-6,y-4,x+6,y+4),0,180,fill=(95,95,94),width=1)
    return soft_light(im,.09)

def bamboo(size):
    w,h=size
    im=Image.new("RGB",size,(198,145,66)); d=ImageDraw.Draw(im); rnd=random.Random(SEED+4)
    x=0; i=0
    while x<w:
        bw=rnd.randint(max(5,int(w*.055)),max(7,int(w*.09)))
        base=(rnd.randint(185,218),rnd.randint(128,161),rnd.randint(49,78))
        for xx in range(x,min(w,x+bw)):
            t=(xx-x)/max(1,bw)
            col=(clamp(base[0]+13*math.sin(t*math.pi)),clamp(base[1]+8*math.sin(t*math.pi)),base[2])
            d.line((xx,0,xx,h),fill=col)
        d.line((x,0,x,h),fill=(116,78,38),width=1)
        for yy in range((i*23)%31,h,31+rnd.randint(-4,4)):
            d.rectangle((x,yy,min(w,x+bw),min(h,yy+2)),fill=(150,99,43))
        x+=bw; i+=1
    return ImageEnhance.Contrast(im.filter(ImageFilter.GaussianBlur(.18))).enhance(1.08)

def veneer(size):
    w,h=size
    im=noise(size,(133,88,48),5,SEED+5); d=ImageDraw.Draw(im); rnd=random.Random(SEED+50)
    # layered cathedral grain
    for i in range(24):
        base_x=(i+.5)*w/24
        phase=rnd.uniform(0,6.28); amp=rnd.uniform(2.0,7.5)
        pts=[]
        for y in range(-8,h+9,3):
            xx=base_x + math.sin(y*.045+phase)*amp + math.sin(y*.012+phase)*amp*.7
            pts.append((xx,y))
        col=rnd.choice([(83,49,28),(96,57,31),(111,66,35),(73,44,26)])
        d.line(pts,fill=col,width=rnd.choice([1,1,2]))
    # occasional knots
    for _ in range(4):
        cx=rnd.randint(8,w-8); cy=rnd.randint(8,h-8)
        for rr in (2,4,7):
            d.ellipse((cx-rr*2,cy-rr,cx+rr*2,cy+rr),outline=(78,45,26),width=1)
    return soft_light(im,.07).filter(ImageFilter.GaussianBlur(.18))

def mdf(size):
    w,h=size
    im=noise(size,(224,221,213),2.5,SEED+6); d=ImageDraw.Draw(im)
    # milled flutes with real highlight/shadow
    centers=[w*.25,w*.48,w*.71]
    for c in centers:
        ww=max(4,int(w*.055))
        d.rectangle((c-ww,5,c+ww,h-5),fill=(208,205,197))
        d.line((c-ww,5,c-ww,h-5),fill=(160,159,154),width=2)
        d.line((c+ww,5,c+ww,h-5),fill=(248,247,242),width=2)
        d.line((c-ww+3,6,c-ww+3,h-6),fill=(190,188,182),width=1)
    return soft_light(im,.08)

def porcelain(size):
    w,h=size
    im=noise(size,(156,158,157),6,SEED+7); d=ImageDraw.Draw(im); rnd=random.Random(SEED+70)
    # marble-like veins, some branching
    for k in range(7):
        x=rnd.randint(-15,w//2); y=rnd.randint(0,h)
        pts=[(x,y)]
        for _ in range(9):
            x+=rnd.randint(10,28); y+=rnd.randint(-11,11); pts.append((x,y))
        d.line(pts,fill=rnd.choice([(225,224,219),(208,208,205),(112,115,114)]),width=rnd.choice([1,1,2]))
        if k<3:
            branch=pts[len(pts)//2]
            d.line((branch[0],branch[1],branch[0]+rnd.randint(15,35),branch[1]+rnd.randint(-22,22)),fill=(218,217,212),width=1)
    return soft_light(im,.06).filter(ImageFilter.GaussianBlur(.15))

def stone(size):
    w,h=size
    im=noise(size,(221,215,201),4,SEED+8); d=ImageDraw.Draw(im); rnd=random.Random(SEED+80)
    # quartz / artificial stone granular aggregate
    for _ in range(int(w*h*.055)):
        x=rnd.randrange(w); y=rnd.randrange(h); r=rnd.choice([1,1,1,2])
        c=rnd.choice([(185,177,162),(202,194,178),(238,234,224),(163,157,145)])
        d.ellipse((x-r,y-r,x+r,y+r),fill=c)
    for _ in range(4):
        x=-10; y=rnd.randrange(h); pts=[]
        while x<w+10:
            pts.append((x,y)); x+=rnd.randint(18,32); y+=rnd.randint(-8,8)
        d.line(pts,fill=(188,178,160),width=1)
    return soft_light(im,.08).filter(ImageFilter.GaussianBlur(.16))

MAKERS=[glass,mirror,hpl,bamboo,veneer,mdf,porcelain,stone]

def rounded_mask(size,r):
    m=Image.new("L",size,0); d=ImageDraw.Draw(m)
    d.rounded_rectangle((0,0,size[0]-1,size[1]-1),radius=r,fill=255)
    return m

def add_depth(tex):
    w,h=tex.size
    ov=Image.new("RGBA",tex.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    # subtle real sample shadow/edge
    d.rectangle((0,h-3,w,h),fill=(0,0,0,30))
    d.line((w-2,2,w-2,h-3),fill=(0,0,0,22),width=2)
    return Image.alpha_composite(tex.convert("RGBA"),ov).convert("RGB")

def enhance(path:Path):
    im=Image.open(path).convert("RGB"); W,H=im.size
    for i,raw in enumerate(BOXES):
        x0,y0,x1,y1=fit_box(raw,W,H); size=(x1-x0,y1-y0)
        tex=MAKERS[i](size)
        tex=add_depth(tex)
        tex=ImageEnhance.Sharpness(tex).enhance(1.22)
        tex=ImageEnhance.Contrast(tex).enhance(1.08)
        mask=rounded_mask(size,max(5,round(size[0]*.06)))
        im.paste(tex,(x0,y0),mask)
    im.save(path,"WEBP",quality=97,method=6)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--site",required=True); args=ap.parse_args()
    site=Path(args.site)
    for root in ("pages","thumbs"):
        p=site/"assets"/root/"page-032.webp"
        if p.exists(): enhance(p)
    print("PAGE 32 MATERIALS: rendered high-detail photorealistic finish samples.")

if __name__=="__main__":
    main()
