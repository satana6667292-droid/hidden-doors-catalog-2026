#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, math, random
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

W,H=1600,1132
WHITE=(255,255,255); DARK=(38,38,38); GRAY=(128,128,128)
BORDER=(222,222,219); CARD=(250,250,248); GREEN=(86,190,51)
FB='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FR='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def F(path,size): return ImageFont.truetype(path,size)

def rounded(d,box,r,fill,outline=BORDER,width=2):
    d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)

def fit(src,size,centering=(.5,.5)):
    return ImageOps.fit(src,size,Image.Resampling.LANCZOS,centering=centering)

def paste_round(base,src,xy,size,r=14,centering=(.5,.5)):
    crop=fit(src,size,centering)
    m=Image.new('L',size,0)
    ImageDraw.Draw(m).rounded_rectangle((0,0,size[0]-1,size[1]-1),radius=r,fill=255)
    base.paste(crop,xy,m)

def wrap(d,text,font,maxw):
    out=[]; cur=''
    for w in text.split():
        t=(cur+' '+w).strip()
        if d.textbbox((0,0),t,font=font)[2] <= maxw:
            cur=t
        else:
            if cur: out.append(cur)
            cur=w
    if cur: out.append(cur)
    return out

def load_asset(asset_dir:Path,name:str):
    parts=sorted(asset_dir.glob(name+'.b64.part*'))
    if not parts: raise RuntimeError(f'PANELS MASTER missing asset {name}')
    data=''.join(p.read_text().strip() for p in parts)
    return Image.open(BytesIO(base64.b64decode(data))).convert('RGB')

def wood_swatch(size,seed=1,light=True):
    random.seed(seed); w,h=size
    base=(190,158,120) if light else (137,111,86)
    im=Image.new('RGB',size,base); px=im.load()
    for x in range(w):
        wave=8*math.sin(x/12)+5*math.sin(x/37)
        for y in range(h):
            n=random.randint(-8,8); val=int(wave+n)
            px[x,y]=tuple(max(0,min(255,c+val)) for c in base)
    d=ImageDraw.Draw(im)
    step=28 if light else 34
    line=(140,110,80) if light else (92,73,56)
    for x in range(0,w,step):
        d.line((x,0,x+random.randint(-5,5),h),fill=line,width=1)
    return im.filter(ImageFilter.GaussianBlur(.4))

def hpl_swatch(size):
    w,h=size
    im=Image.new('RGB',size,(70,72,72)); d=ImageDraw.Draw(im)
    d.rectangle((int(w*.58),0,int(w*.76),h),fill=(28,30,31))
    d.rectangle((int(w*.77),0,int(w*.93),h),fill=(123,118,109))
    d.rectangle((int(w*.94),0,w,h),fill=(222,214,201))
    return im

def add_material_card(base,box,title,desc,swatch):
    d=ImageDraw.Draw(base); rounded(d,box,16,CARD)
    x0,y0,x1,y1=box; pad=16; sw_h=82
    paste_round(base,swatch,(x0+pad,y0+pad),(x1-x0-2*pad,sw_h),10)
    d.rectangle((x0+16,y0+115,x0+22,y0+150),fill=GREEN)
    d.text((x0+38,y0+111),title,font=F(FB,17),fill=DARK)
    yy=y0+145
    for line in wrap(d,desc,F(FR,13),x1-x0-56):
        d.text((x0+38,yy),line,font=F(FR,13),fill=GRAY); yy+=18

def save_page(im,site,physical):
    page=site/'assets'/'pages'/f'page-{physical:03d}.webp'
    thumb=site/'assets'/'thumbs'/f'page-{physical:03d}.webp'
    im.save(page,'WEBP',quality=96,method=6)
    im.resize((360,255),Image.Resampling.LANCZOS).save(thumb,'WEBP',quality=92,method=6)

def build(site:Path):
    assets=Path(__file__).resolve().parent.parent/'panel-assets'
    green=load_asset(assets,'green-door.webp')
    detail=load_asset(assets,'pvc-detail.webp')
    beige=load_asset(assets,'beige-door.webp')

    # physical 41 / public 38 — left page
    p=Image.new('RGB',(W,H),WHITE); d=ImageDraw.Draw(p)
    # outer logo zone intentionally blank; LOGO MASTER fills it.
    title='Стеновые панели'; ft=F(FB,42)
    tw=d.textbbox((0,0),title,font=ft)[2]
    d.text((1540-tw,54),title,font=ft,fill=DARK)
    sub='Материалы и конструкции'; fs=F(FR,18)
    sw=d.textbbox((0,0),sub,font=fs)[2]
    d.text((1540-sw,107),sub,font=fs,fill=GRAY)

    rounded(d,(45,162,632,900),18,CARD)
    paste_round(p,beige,(60,177),(557,570),12,centering=(.50,.47))
    d.text((60,770),'Скрытая дверь в стеновых панелях',font=F(FB,17),fill=DARK)
    d.text((60,802),'Единая интерьерная плоскость без видимых наличников',font=F(FR,13),fill=GRAY)
    d.text((60,821),'и коробов.',font=F(FR,13),fill=GRAY)

    intro=('Стеновые панели объединяют эстетику, функциональность и скрытые двери '
           'в единую архитектурную поверхность. Различные материалы и варианты '
           'фрезеровки позволяют создавать индивидуальные интерьерные решения.')
    yy=168
    for line in wrap(d,intro,F(FR,15),820):
        d.text((675,yy),line,font=F(FR,15),fill=GRAY); yy+=22

    boxes=[(675,280,1068,492),(1100,280,1493,492),(675,515,1068,727),(1100,515,1493,727)]
    swatches=[wood_swatch((361,82),3,True),detail,wood_swatch((361,82),7,False),hpl_swatch((361,82))]
    data=[
      ('Натуральный шпон','Натуральная древесная текстура. Рисунок и тон подбираются под проект.'),
      ('МДФ в ПВХ пленке','Практичное декоративное покрытие с широким выбором цветов, текстур и вариантов фрезеровки.'),
      ('EGGER','Современные декоры и древесные текстуры для цельных интерьерных решений.'),
      ('HPL пластик','Износостойкое покрытие для современных интерьеров и зон с повышенной нагрузкой.')
    ]
    for box,(t,desc),swat in zip(boxes,data,swatches):
        add_material_card(p,box,t,desc,swat)

    rounded(d,(675,755,1493,850),16,CARD)
    d.rectangle((690,775,696,815),fill=GREEN)
    d.text((713,773),'Конструктивные возможности',font=F(FB,14),fill=DARK)
    d.line((985,770,985,835),fill=(210,210,210),width=1)
    note=('Индивидуальные размеры, варианты рисунка фрезеровки и интеграция '
          'скрытой двери в единую стеновую плоскость.')
    yy=772
    for line in wrap(d,note,F(FR,12),470):
        d.text((1005,yy),line,font=F(FR,12),fill=GRAY); yy+=17

    save_page(p,site,41)

    # physical 42 / public 39 — right page
    q=Image.new('RGB',(W,H),WHITE); e=ImageDraw.Draw(q)
    # binding-side heading; outer logo zone intentionally blank.
    e.text((50,55),'Стеновые панели — интерьерные решения',font=F(FB,39),fill=DARK)
    e.text((50,105),'ПВХ-пленка с фрезеровкой и скрытой дверью',font=F(FR,18),fill=GRAY)

    rounded(e,(45,165,720,962),18,CARD)
    paste_round(q,green,(60,180),(645,690),12,centering=(.5,.47))
    e.text((60,890),'Вертикальная фрезеровка',font=F(FB,17),fill=DARK)
    e.text((60,918),'Строгая геометрия и чистые линии для современных интерьеров.',font=F(FR,12),fill=GRAY)

    rounded(e,(748,165,1540,445),18,CARD)
    paste_round(q,detail,(763,180),(762,150),12)
    e.rectangle((763,351,769,385),fill=GREEN)
    e.text((785,347),'Фактура и цвет',font=F(FB,17),fill=DARK)
    e.text((785,375),'Широкие возможности фрезеровки и цветовых решений в ПВХ-пленке.',font=F(FR,12),fill=GRAY)

    rounded(e,(748,475,1540,962),18,CARD)
    paste_round(q,beige,(763,490),(762,375),12,centering=(.53,.43))
    e.rectangle((763,884,769,918),fill=GREEN)
    e.text((785,880),'Декоративная геометрия',font=F(FB,17),fill=DARK)
    e.text((785,908),'Индивидуальные рисунки фрезеровки и скрытая дверь в едином стиле.',font=F(FR,12),fill=GRAY)

    save_page(q,site,42)
    print('WALL PANELS MASTER: rebuilt physical 41-42 from approved spread.')

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--site',required=True); args=ap.parse_args()
    build(Path(args.site))
