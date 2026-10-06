#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

W0,H0=1600,1132
FONT_BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
GREEN=(86,190,51)
DARK=(35,35,35)
GRAY=(133,133,133)
BORDER=(220,220,220)
CARD=(250,250,249)
CALLOUT=(247,252,244)
WHITE=(255,255,255)


def font(path,size,scale=1):
    return ImageFont.truetype(path,max(6,round(size*scale)))

def rounded(im,box,r,fill,outline=None,width=1):
    ImageDraw.Draw(im).rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)

def fit_crop(src,size,centering=(.5,.5)):
    return ImageOps.fit(src,size,Image.Resampling.LANCZOS,centering=centering)

def draw_bullets(d,x,y,lines,scale=1,font_size=17,line_gap=8,maxw=480):
    f=font(FONT_REG,font_size,scale)
    bullet_r=max(2,round(4*scale))
    yy=y
    for item in lines:
        words=item.split()
        rows=[]; cur=''
        for w in words:
            test=(cur+' '+w).strip()
            if d.textbbox((0,0),test,font=f)[2] <= maxw:
                cur=test
            else:
                if cur: rows.append(cur)
                cur=w
        if cur: rows.append(cur)
        d.ellipse((x,yy+7*scale-bullet_r,x+2*bullet_r,yy+7*scale+bullet_r),fill=GREEN)
        tx=x+24*scale
        for row in rows:
            d.text((tx,yy),row,font=f,fill=GRAY)
            yy += 22*scale
        yy += line_gap*scale
    return yy

def load_hero_from_parts(asset_dir:Path):
    parts=sorted(asset_dir.glob('artificial-stone-hero.b64.part*'))
    if not parts:
        raise SystemExit('MASTER: artificial stone hero parts missing')
    data=''.join(p.read_text().strip() for p in parts)
    return Image.open(BytesIO(base64.b64decode(data))).convert('RGB')

def build(site:Path):
    im=Image.new('RGB',(W0,H0),WHITE)
    d=ImageDraw.Draw(im)

    rounded(im,(650,14,812,49),10,WHITE,GREEN,2)
    badge_font=font(FONT_BOLD,13)
    badge='В РАБОТЕ'
    bw=d.textbbox((0,0),badge,font=badge_font)[2]
    d.text((731-bw/2,23),badge,font=badge_font,fill=GREEN)
    d.text((50,77),'59 мм — искусственный камень',font=font(FONT_BOLD,42),fill=DARK)
    d.text((50,132),'Интеграция искусственного камня в полотно скрытой двери',font=font(FONT_REG,18),fill=GRAY)

    hero=load_hero_from_parts(Path(__file__).resolve().parent.parent/'material-assets')
    hero_box=(35,177,781,967)
    hw,hh=hero_box[2]-hero_box[0],hero_box[3]-hero_box[1]
    hero_fit=fit_crop(hero,(hw,hh),centering=(.52,.50))
    mask=Image.new('L',(hw,hh),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,hw-1,hh-1),radius=14,fill=255)
    im.paste(hero_fit,(hero_box[0],hero_box[1]),mask)

    f_body=font(FONT_REG,18)
    intro=(
        'Система 59 мм интегрирует искусственный камень непосредственно в дверное полотно. '
        'Материал может использоваться с одной или с двух сторон двери и продолжаться на соседней '
        'стеновой панели, формируя единую интерьерную плоскость.'
    )
    words=intro.split(); rows=[]; cur=''
    for w in words:
        test=(cur+' '+w).strip()
        if d.textbbox((0,0),test,font=f_body)[2] <= 585: cur=test
        else: rows.append(cur); cur=w
    if cur: rows.append(cur)
    yy=183
    for row in rows:
        d.text((812,yy),row,font=f_body,fill=GRAY); yy+=27

    c1=(812,322,1417,610); rounded(im,c1,18,CARD,BORDER,2)
    thumb1=fit_crop(hero,(165,254),centering=(.58,.47))
    m=Image.new('L',thumb1.size,0)
    ImageDraw.Draw(m).rounded_rectangle((0,0,thumb1.width-1,thumb1.height-1),radius=12,fill=255)
    im.paste(thumb1,(832,337),m)
    d.text((1026,341),'Искусственный камень',font=font(FONT_BOLD,22),fill=DARK)
    draw_bullets(d,1028,382,[
        'премиальный материал с натуральной текстурой;',
        'высокая износостойкость и стабильность внешнего вида;',
        'дверь и стена формируют единую поверхность;',
        'высота полотна — до 2950 мм;',
        'цвет и рисунок подбираются под проект.'
    ],font_size=16,maxw=350,line_gap=5)

    c2=(812,624,1417,842); rounded(im,c2,18,CARD,BORDER,2)
    thumb2=fit_crop(hero,(165,170),centering=(.35,.30))
    m2=Image.new('L',thumb2.size,0)
    ImageDraw.Draw(m2).rounded_rectangle((0,0,thumb2.width-1,thumb2.height-1),radius=12,fill=255)
    im.paste(thumb2,(832,640),m2)
    d.text((1028,642),'Сочетание со стеновыми панелями',font=font(FONT_BOLD,21),fill=DARK)
    draw_bullets(d,1028,680,[
        'материал может быть продолжен на стеновых панелях;',
        'создает цельную и монолитную поверхность;',
        'подходит для современных премиальных интерьеров;',
        'фактура и формат подбираются под интерьер.'
    ],font_size=14,maxw=350,line_gap=2)

    c3=(812,855,1417,969); rounded(im,c3,18,CALLOUT,(220,236,214),2)
    d.polygon([(844,881),(879,869),(879,944),(844,933)],outline=GREEN,width=3)
    d.rectangle((882,882,895,938),outline=GREEN,width=3)
    d.text((925,874),'Монументальный интерьерный образ.',font=font(FONT_BOLD,18),fill=DARK)
    d.text((925,904),'Искусственный камень подчеркивает',font=font(FONT_REG,15),fill=GRAY)
    d.text((925,925),'архитектурную цельность двери и стены.',font=font(FONT_REG,15),fill=GRAY)

    d.text((35,983),'Все технические параметры и совместимость материалов подтверждаются для конкретного проекта.',font=font(FONT_REG,11),fill=(150,150,150))

    out=site/'assets/pages/page-038.webp'
    im.save(out,'WEBP',quality=96,method=6)
    thumb=im.resize((360,255),Image.Resampling.LANCZOS)
    thumb.save(site/'assets/thumbs/page-038.webp','WEBP',quality=92,method=6)
    print('MATERIAL MASTER: rebuilt physical 38 with approved artificial-stone hero.')

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--site',required=True)
    args=ap.parse_args()
    build(Path(args.site))
