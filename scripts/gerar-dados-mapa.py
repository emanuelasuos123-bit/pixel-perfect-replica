"""Gera public/dados/pirambu.geojson a partir de uma exportação do Overpass Turbo (GeoJSON).

Como usar:
  1. Em overpass-turbo.eu, rode a consulta abaixo e use Exportar -> GeoJSON -> baixar.
  2. python3 scripts/gerar-dados-mapa.py caminho/do/export.geojson
O script recorta tudo pelo contorno externo de src/data/limites.ts (casco convexo da área "oculta").

Consulta (Overpass QL):
  [out:json][timeout:90];
  (
    way["building"](-3.7210,-38.5650,-3.6985,-38.5355);
    way["highway"](-3.7210,-38.5650,-3.6985,-38.5355);
    way["natural"~"coastline|beach|sand|water"](-3.7210,-38.5650,-3.6985,-38.5355);
    way["man_made"~"groyne|pier|breakwater"](-3.7210,-38.5650,-3.6985,-38.5355);
    way["leisure"](-3.7210,-38.5650,-3.6985,-38.5355);
    way["landuse"](-3.7210,-38.5650,-3.6985,-38.5355);
    relation["building"](-3.7210,-38.5650,-3.6985,-38.5355);
  );
  (._;>;);
  out body;
Dados: © colaboradores do OpenStreetMap (ODbL). Mantenha o crédito no mapa.
"""
import re, sys, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import json, math, hashlib
SRC = sys.argv[1] if len(sys.argv) > 1 else "export.geojson"
_lim = open(os.path.join(RAIZ, "src/data/limites.ts"), encoding="utf-8").read()
def _lista(nome):
    m = re.search(r"const " + nome + r": \[number, number\]\[\] = \[(.*?)\n\];", _lim, re.S)
    return [tuple(float(x) for x in t) for t in re.findall(r"\[(-?[\d.]+), (-?[\d.]+)\]", m.group(1))]
Q = _lista("oculta")
def hull(pts):
    pts=sorted(set(pts)); 
    def cr(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[]; 
    for p in pts:
        while len(lo)>=2 and cr(lo[-2],lo[-1],p)<=0: lo.pop()
        lo.append(p)
    up=[]
    for p in reversed(pts):
        while len(up)>=2 and cr(up[-2],up[-1],p)<=0: up.pop()
        up.append(p)
    return lo[:-1]+up[:-1]   # anti-horário
H=hull(Q)
def inside_convex(pt,poly):   # poly anti-horário
    x,y=pt
    for i in range(len(poly)):
        a,b=poly[i],poly[(i+1)%len(poly)]
        if (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])<-1e-12: return False
    return True
def clip_poly(subject,clip):  # Sutherland–Hodgman, clip convexo anti-horário
    out=subject
    for i in range(len(clip)):
        a,b=clip[i],clip[(i+1)%len(clip)]
        ins=lambda p:(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=0
        def inter(p,q):
            dx,dy=q[0]-p[0],q[1]-p[1]; ex,ey=b[0]-a[0],b[1]-a[1]
            den=dx*ey-dy*ex
            t=((a[0]-p[0])*ey-(a[1]-p[1])*ex)/den
            return (p[0]+t*dx,p[1]+t*dy)
        inp=out; out=[]
        if not inp: break
        s=inp[-1]
        for e in inp:
            if ins(e):
                if not ins(s): out.append(inter(s,e))
                out.append(e)
            elif ins(s): out.append(inter(s,e))
            s=e
    return out
def clip_line(line,clip):   # devolve lista de trechos dentro do convexo (Cyrus–Beck por segmento)
    trechos=[];atual=[]
    for i in range(len(line)-1):
        p,q=line[i],line[i+1]; t0,t1=0.0,1.0; ok=True
        dx,dy=q[0]-p[0],q[1]-p[1]
        for j in range(len(clip)):
            a,b=clip[j],clip[(j+1)%len(clip)]
            nx,ny=-(b[1]-a[1]),(b[0]-a[0])         # normal para dentro (anti-horário)
            num=nx*(p[0]-a[0])+ny*(p[1]-a[1]); den=nx*dx+ny*dy
            if abs(den)<1e-15:
                if num<0: ok=False;break
            else:
                t=-num/den
                if den>0: t0=max(t0,t)
                else: t1=min(t1,t)
            if t0>t1: ok=False;break
        if not ok:
            if len(atual)>1: trechos.append(atual)
            atual=[]; continue
        a1=(p[0]+dx*t0,p[1]+dy*t0); b1=(p[0]+dx*t1,p[1]+dy*t1)
        if not atual or atual[-1]!=a1:
            if len(atual)>1: trechos.append(atual)
            atual=[a1]
        atual.append(b1)
        if t1<1.0:
            trechos.append(atual); atual=[]
    if len(atual)>1: trechos.append(atual)
    return trechos
r5=lambda p:[round(p[0],5),round(p[1],5)]
def centroid(ring): 
    n=len(ring)-1 if ring[0]==ring[-1] else len(ring)
    return (sum(p[0] for p in ring[:n])/n,sum(p[1] for p in ring[:n])/n)
d=json.load(open(SRC)); fs=d["features"]
out=[]
# ---- costa -> linha única (leste->oeste)
segs=[f["geometry"]["coordinates"] for f in fs if f["properties"].get("natural")=="coastline"]
key=lambda p:(round(p[0],6),round(p[1],6))
start=min(segs,key=lambda s:-max(s[0][0],s[-1][0]))   # trecho mais a leste
if start[0][0]<start[-1][0]: start=start[::-1]
cadeia=list(start); usados=[id(start)]; resto=[s for s in segs if s is not start]
while resto:
    fim=key(cadeia[-1]); achou=False
    for s in resto:
        if key(s[0])==fim: cadeia+=s[1:]; resto.remove(s); achou=True; break
        if key(s[-1])==fim: cadeia+=s[::-1][1:]; resto.remove(s); achou=True; break
    if not achou: print("cadeia quebrada, sobram",len(resto)); break
print("costa:",len(cadeia),"pontos; leste",cadeia[0],"oeste",cadeia[-1])
E_,W_=cadeia[0],cadeia[-1]
terra=cadeia+[(W_[0]-0.03,W_[1]),(W_[0]-0.03,-3.75),(E_[0]+0.03,-3.75),(E_[0]+0.03,E_[1])]
mar=cadeia+[(W_[0]-0.03,W_[1]),(W_[0]-0.03,-3.67),(E_[0]+0.03,-3.67),(E_[0]+0.03,E_[1])]
def area(p): return sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2
for nome,poly in (("terra",terra),("mar",mar)):
    if area(poly)<0: poly=poly[::-1]
    c=clip_poly(poly,H)
    print(nome,len(c),"pontos")
    out.append({"type":"Feature","properties":{"k":nome},"geometry":{"type":"Polygon","coordinates":[[r5(p) for p in c]+[r5(c[0])]]}})
out.append({"type":"Feature","properties":{"k":"costa"},"geometry":{"type":"LineString","coordinates":[r5(p) for p in cadeia if inside_convex(p,H)]}})
# ---- demais feições
def altura(p):
    h=p.get("height")
    if h:
        try: return max(2.5,min(60,float(str(h).replace("m","").replace(",",".").strip())))
        except: pass
    l=p.get("building:levels")
    if l:
        try: return max(2.5,min(60,float(l)*3+0.5))
        except: pass
    return 5.0
MAJ={"primary","secondary","tertiary","trunk","primary_link","secondary_link","tertiary_link","trunk_link"}
MIN={"residential","service","living_street","unclassified"}
cont={}
def add(k,geom,props=None):
    pr={"k":k}; pr.update(props or {}); out.append({"type":"Feature","properties":pr,"geometry":geom}); cont[k]=cont.get(k,0)+1
for f in fs:
    p=f["properties"]; g=f["geometry"]
    if g["type"]=="Polygon":
        ring=g["coordinates"][0]
        if not inside_convex(centroid(ring),H): continue
        if "building" in p:
            if p["building"] in ("roof","carport","pavilion"): hh=3.0
            else: hh=altura(p)
            t=int(hashlib.md5(p["@id"].encode()).hexdigest(),16)%4
            add("pred",{"type":"Polygon","coordinates":[[r5(q) for q in ring]]},{"h":round(hh,1),"t":t})
        elif p.get("leisure") in ("pitch","sports_centre"): add("quadra",{"type":"Polygon","coordinates":[[r5(q) for q in ring]]})
        elif p.get("leisure") in ("park","playground"): add("verde",{"type":"Polygon","coordinates":[[r5(q) for q in ring]]})
        elif p.get("natural")=="sand": add("areia",{"type":"Polygon","coordinates":[[r5(q) for q in ring]]})
        elif p.get("highway")=="pedestrian": add("praca",{"type":"Polygon","coordinates":[[r5(q) for q in ring]]})
    elif g["type"]=="LineString":
        hw=p.get("highway"); mm=p.get("man_made")
        if mm in ("breakwater","groyne","pier"):
            for tr in clip_line(g["coordinates"],H): add("espigao",{"type":"LineString","coordinates":[r5(q) for q in tr]})
        elif hw in MAJ or hw in MIN or hw=="pedestrian":
            cl=1 if hw in MAJ else (2 if hw in MIN else 3)
            for tr in clip_line(g["coordinates"],H):
                pr={"c":cl}
                if p.get("name"): pr["n"]=p["name"]
                add("via",{"type":"LineString","coordinates":[r5(q) for q in tr]},pr)
print(cont)
fc={"type":"FeatureCollection","features":out}
SAIDA = os.path.join(RAIZ, "public/dados/pirambu.geojson")
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
json.dump(fc, open(SAIDA, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print("gravado em", SAIDA, round(os.path.getsize(SAIDA) / 1e6, 2), "MB")
