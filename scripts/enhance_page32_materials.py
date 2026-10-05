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
SEED=5903202
SCALE=4

def fit_box(box,W,H):
    sx,sy=W/W0,H/H0
    return tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(box))

def low_noise(size,seed,grid=(14,10),blur=1.8):
    w,h=size
    rnd=random.Random(seed)
    gw=max(2,grid[0]); gh=max(2,grid[1])
    sm=Image.new("L",(gw,gh))
    px=sm.load()
    for y in range(gh):
        for x in range(gw):
            px[x,y]=rnd.randint(40,220)
    return sm.resize((w,h),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(blur))

def multi_noise(size,seed):
    w,h=size
    a=low_noise(size,seed,(9,7),3.0)
    b=low_noise(size,seed+1,(24,18),1.3)
    c=low_noise(size,seed+2,(64,44),0.35)
    out=Image.blend(a,b,.42)
    out=Image.blend(out,c,.22)
    return out

def colorize_noise(size,seed,dark,light):
    n=multi_noise(size,seed)
    lo=Image.new("RGB",size,dark)
    hi=Image.new("RGB",size,light)
    return Image.composite(hi,lo,n)

def rounded_top_mask(size,r):
    w,h=size
    m=Image.new("L",size,0)
    d=ImageDraw.Draw(m)
    d.rounded_rectangle((0,0,w-1,h+r),radius=r,fill=255)
    d.rectangle((0,r,w,h),fill=255)
    return m

def glass(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=Image.new("RGB",(w,h),(220,238,239))
    d=ImageDraw.Draw(im,"RGBA")
    for x in range(w):
        t=x/max(1,w-1)
        c=(int(232-22*t),int(245-10*t),int(246-7*t))
        d.line((x,0,x,h),fill=(*c,255))
    # subtle room reflection
    d.polygon([(0,int(h*.06)),(int(w*.58),0),(int(w*.82),0),(0,int(h*.62))],fill=(255,255,255,72))
    d.polygon([(0,int(h*.44)),(int(w*.24),int(h*.30)),(int(w*.50),h),(0,h)],fill=(194,216,217,48))
    # polished green glass edge
    ex=int(w*.78)
    d.rectangle((ex,0,ex+int(w*.035),h),fill=(13,92,86,255))
    d.rectangle((ex+int(w*.035),0,ex+int(w*.058),h),fill=(67,181,168,190))
    d.line((ex-3,0,ex-3,h),fill=(255,255,255,195),width=3)
    return im.filter(ImageFilter.GaussianBlur(.35)).resize(size,Image.Resampling.LANCZOS)

def mirror(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=Image.new("RGB",(w,h),(194,198,202))
    d=ImageDraw.Draw(im,"RGBA")
    for y in range(h):
        v=int(170+64*(1-y/max(1,h-1)))
        d.line((0,y,w,y),fill=(v,v+2,v+5,255))
    # reflected architecture/light bands
    d.polygon([(0,0),(int(w*.58),0),(int(w*.14),h),(0,h)],fill=(252,252,252,235))
    d.polygon([(int(w*.28),0),(int(w*.62),0),(int(w*.18),h),(int(w*.02),h)],fill=(217,220,224,165))
    d.polygon([(int(w*.72),0),(w,0),(w,h),(int(w*.58),h)],fill=(118,122,126,75))
    d.line((0,0,w-1,0),fill=(255,255,255,170),width=3)
    return im.filter(ImageFilter.GaussianBlur(.55)).resize(size,Image.Resampling.LANCZOS)

def hpl(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    base=colorize_noise((w,h),SEED+20,(53,54,53),(103,104,102))
    d=ImageDraw.Draw(base,"RGBA")
    rnd=random.Random(SEED+21)
    # very fine embossed fibers / mineral flecks
    for _ in range(max(1200,(w*h)//55)):
        x=rnd.randrange(w); y=rnd.randrange(h)
        a=rnd.randint(16,48)
        c=rnd.choice([(220,220,216,a),(12,12,12,a),(140,140,136,a)])
        d.point((x,y),fill=c)
    for k in range(20):
        y=rnd.randrange(h)
        d.line((0,y,w,y+rnd.randint(-3,3)),fill=(255,255,255,16),width=1)
    base=ImageEnhance.Contrast(base).enhance(1.10)
    return base.filter(ImageFilter.GaussianBlur(.18)).resize(size,Image.Resampling.LANCZOS)

def bamboo(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=Image.new("RGB",(w,h),(192,137,62))
    d=ImageDraw.Draw(im,"RGBA")
    rnd=random.Random(SEED+30)
    x=0
    while x<w:
        bw=rnd.randint(max(18,w//18),max(24,w//12))
        end=min(w,x+bw)
        base=(rnd.randint(176,218),rnd.randint(119,160),rnd.randint(48,78))
        for xx in range(x,end):
            t=(xx-x)/max(1,bw)
            delta=int(13*math.sin(t*math.pi))
            col=tuple(max(0,min(255,c+delta)) for c in base)
            d.line((xx,0,xx,h),fill=(*col,255))
        d.line((x,0,x,h),fill=(105,72,34,190),width=max(2,w//260))
        d.line((x+2,0,x+2,h),fill=(235,181,92,100),width=1)
        # natural bamboo nodes
        for _ in range(rnd.randint(1,3)):
            yy=rnd.randint(0,max(0,h-7))
            if end-x>6:
                d.rectangle((x+2,yy,end-2,min(h-1,yy+rnd.randint(3,7))),fill=(132,85,38,135))
        # fine vertical grain
        for _ in range(2):
            gx=rnd.randint(x+1,max(x+1,end-1))
            d.line((gx,0,gx,h),fill=(95,62,30,35),width=1)
        x=end
    return im.filter(ImageFilter.GaussianBlur(.28)).resize(size,Image.Resampling.LANCZOS)

def veneer(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=colorize_noise((w,h),SEED+40,(79,47,27),(171,117,68))
    d=ImageDraw.Draw(im,"RGBA")
    rnd=random.Random(SEED+41)
    # long organic walnut/oak grain
    for i in range(42):
        base_x=(i+0.5)*w/42 + rnd.uniform(-6,6)
        amp=rnd.uniform(5,18)
        freq=rnd.uniform(.018,.045)
        phase=rnd.random()*math.pi*2
        pts=[]
        for y in range(-6,h+8,5):
            x=base_x+math.sin(y*freq+phase)*amp+math.sin(y*.008+phase*.3)*amp*.35
            pts.append((x,y))
        d.line(pts,fill=(54,30,18,rnd.randint(70,135)),width=rnd.choice([1,1,2,3]))
        if i%5==0:
            d.line([(x+3,y) for x,y in pts],fill=(220,163,94,28),width=1)
    # a few pores/knots
    for _ in range(7):
        cx=rnd.randrange(w); cy=rnd.randrange(h)
        rx=rnd.randint(12,34); ry=rnd.randint(3,8)
        d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),outline=(54,29,16,90),width=2)
    return im.filter(ImageFilter.GaussianBlur(.22)).resize(size,Image.Resampling.LANCZOS)

def mdf(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=colorize_noise((w,h),SEED+50,(214,211,204),(239,237,231))
    d=ImageDraw.Draw(im,"RGBA")
    # routed vertical grooves with realistic shadow/highlight
    for gx in [int(w*.27),int(w*.49),int(w*.71)]:
        d.rectangle((gx-6,0,gx+5,h),fill=(183,181,175,85))
        d.line((gx-4,0,gx-4,h),fill=(133,132,128,135),width=3)
        d.line((gx+2,0,gx+2,h),fill=(255,255,253,180),width=4)
    return im.filter(ImageFilter.GaussianBlur(.20)).resize(size,Image.Resampling.LANCZOS)

def porcelain(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=colorize_noise((w,h),SEED+60,(125,127,126),(184,185,181))
    d=ImageDraw.Draw(im,"RGBA")
    rnd=random.Random(SEED+61)
    # natural stone veining with multiple branches
    for k in range(8):
        x=rnd.randint(-w//4,w//3); y=rnd.randint(0,h)
        pts=[(x,y)]
        for _ in range(9):
            x+=rnd.randint(max(10,w//18),max(16,w//8))
            y+=rnd.randint(-max(6,h//8),max(6,h//8))
            pts.append((x,y))
        d.line(pts,fill=(239,238,233,rnd.randint(125,210)),width=rnd.randint(2,5))
        if k<4:
            d.line([(a+3,b+3) for a,b in pts],fill=(74,78,78,45),width=1)
    return im.filter(ImageFilter.GaussianBlur(.28)).resize(size,Image.Resampling.LANCZOS)

def stone(size):
    w,h=size[0]*SCALE,size[1]*SCALE
    im=colorize_noise((w,h),SEED+70,(196,188,174),(241,237,226))
    d=ImageDraw.Draw(im,"RGBA")
    rnd=random.Random(SEED+71)
    # quartz/mineral aggregate
    for _ in range(max(900,(w*h)//85)):
        x=rnd.randrange(w); y=rnd.randrange(h)
        rr=rnd.choice([1,1,1,2,2,3])
        c=rnd.choice([(158,151,139,80),(250,247,239,150),(118,116,109,50),(204,193,174,110)])
        d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=c)
    for k in range(4):
        x=rnd.randint(-w//5,w//3); y=rnd.randint(0,h)
        pts=[(x,y)]
        for _ in range(8):
            x+=rnd.randint(max(12,w//16),max(18,w//8))
            y+=rnd.randint(-max(6,h//9),max(6,h//9))
            pts.append((x,y))
        d.line(pts,fill=(149,140,124,80),width=2)
    return im.filter(ImageFilter.GaussianBlur(.30)).resize(size,Image.Resampling.LANCZOS)

MAKERS=[glass,mirror,hpl,bamboo,veneer,mdf,porcelain,stone]

def enhance(path:Path):
    im=Image.open(path).convert("RGB")
    W,H=im.size
    for i,raw in enumerate(BOXES):
        x0,y0,x1,y1=fit_box(raw,W,H)
        size=(x1-x0,y1-y0)
        tex=MAKERS[i](size)
        tex=ImageEnhance.Sharpness(tex).enhance(1.10)
        mask=rounded_top_mask(size,max(6,round(size[0]*.07)))
        im.paste(tex,(x0,y0),mask)
    im.save(path,"WEBP",quality=97,method=6)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",required=True)
    args=ap.parse_args()
    site=Path(args.site)
    for root in ("pages","thumbs"):
        p=site/"assets"/root/"page-032.webp"
        if p.exists():
            enhance(p)
    print("PAGE 32 MATERIALS V2: photorealistic 8-material swatch set rendered at 4x and downsampled.")

if __name__=="__main__":
    main()
