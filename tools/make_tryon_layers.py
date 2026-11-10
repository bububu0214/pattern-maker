# Builds the try-on layers (mask, shade, lines) in site/img from hand-traced outlines.
# Run: python3 tools/make_tryon_layers.py
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops
import os
I=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'img') + '/'
G = {
 'vest': dict(src='plaid-vest.jpg',
   poly=[(286,238),(318,242),(326,252),(452,525),(583,262),(592,248),(600,252),(705,305),(708,360),(715,470),(740,570),(760,600),(798,622),(792,700),(795,900),(782,950),(520,976),(445,966),(360,964),(150,953),(116,926),(108,800),(100,618),(130,603),(165,575),(190,500),(200,420),(198,305)],
   holes=[(450,560,12),(452,672,12),(450,790,12)],
   lines=[[(452,525),(455,862)],[(445,966),(455,862),(520,976)]]),
 'blouse': dict(src='blouse-embroid.jpg',
   poly=[(199,245),(255,205),(287,192),(287,205),(300,245),(340,275),(400,293),(450,298),(510,292),(560,275),(595,245),(603,205),(603,192),(645,205),(704,240),(705,700),(705,918),(600,923),(450,925),(300,923),(203,918),(201,600)],
   holes=[],
   buttons=[(447,y,10) for y in (410,520,630,740,850)],
   lines=[[(465,300),(465,922)]]),
}
for k,g in G.items():
    im=Image.open(I+g['src']).convert('RGB'); W,H=im.size
    S=2  # supersample for smooth edges
    m=Image.new('L',(W*S,H*S),0); d=ImageDraw.Draw(m)
    d.polygon([(x*S,y*S) for x,y in g['poly']],fill=255)
    for x,y,r in g['holes']: d.ellipse([(x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S],fill=0)
    m=m.resize((W,H),Image.LANCZOS)
    # shading: heavily blurred luminance inside the garment, so the old print doesn't show through
    L=ImageOps.grayscale(im)
    inside=Image.composite(L, Image.new('L',(W,H),0), m)
    blurL=inside.filter(ImageFilter.GaussianBlur(28)); blurM=m.filter(ImageFilter.GaussianBlur(28))
    px=[]; out=Image.new('L',(W,H),255); o=out.load(); bl=blurL.load(); bm=blurM.load(); mm=m.load()
    vals=[bl[x,y]/bm[x,y] for y in range(0,H,4) for x in range(0,W,4) if mm[x,y]>200 and bm[x,y]>0]
    lo,hi=min(vals),max(vals)
    for y in range(H):
        for x in range(W):
            if bm[x,y]>8:
                v=(bl[x,y]/bm[x,y]-lo)/(hi-lo+1e-6)
                o[x,y]=int(255*(0.80+0.20*max(0,min(1,v))))
    # edge darkening for a bit of volume
    edge=ImageOps.invert(m.filter(ImageFilter.GaussianBlur(10)))
    out=ImageChops.subtract(out, edge.point(lambda p: int(p*0.25)))
    out.save(I+f'tryon-{k}-shade.png', optimize=True)
    rgba=Image.new('RGBA',(W,H),(255,255,255,0)); rgba.putalpha(m); rgba.save(I+f'tryon-{k}-mask.png', optimize=True)
    ln=Image.new('L',(W*S,H*S),0); d=ImageDraw.Draw(ln)
    pts=[(x*S,y*S) for x,y in g['poly']]; d.line(pts+[pts[0]],fill=150,width=3*S, joint='curve')
    for seg in g['lines']: d.line([(x*S,y*S) for x,y in seg],fill=130,width=2*S)
    for x,y,r in g['holes']: d.ellipse([(x-r-1)*S,(y-r-1)*S,(x+r+1)*S,(y+r+1)*S],outline=120,width=2*S)
    ln=ln.resize((W,H),Image.LANCZOS).filter(ImageFilter.GaussianBlur(.8))
    lines=Image.new('RGBA',(W,H),(30,24,20,0)); lines.putalpha(ln)
    if g.get('buttons'):
        bt=Image.new('RGBA',(W*S,H*S),(0,0,0,0)); d=ImageDraw.Draw(bt)
        for x,y,r in g['buttons']:
            x,y,r=x*S,y*S,r*S
            d.ellipse([x-r+2,y-r+3,x+r+2,y+r+3],fill=(40,30,25,70))           # shadow
            d.ellipse([x-r,y-r,x+r,y+r],fill=(238,233,224,255),outline=(150,140,128,255),width=2)
            d.ellipse([x-r*.55,y-r*.55,x+r*.55,y+r*.55],outline=(205,198,188,255),width=2)
            for dx,dy in ((-3,-3),(3,-3),(-3,3),(3,3)): d.ellipse([x+dx*S/2-2,y+dy*S/2-2,x+dx*S/2+2,y+dy*S/2+2],fill=(150,140,128,255))
        lines.alpha_composite(bt.resize((W,H),Image.LANCZOS))
    lines.save(I+f'tryon-{k}-lines.png', optimize=True)
    print(k,'ok')
