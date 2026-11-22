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
predios=[]
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
            predios.append({"ring":ring[:-1] if ring[0]==ring[-1] else ring,"h":hh,"t":t})
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

# ---------------------------------------------------------------------------------------
# Prédios: limpeza (sobreposição = "tremido"), prédios grandes acinzentados e modelos à mão
# ---------------------------------------------------------------------------------------
KX=111320*math.cos(math.radians(3.712)); KY=110574          # metros por grau
def m2(poly): return abs(area(poly))*KX*KY
def diametro(poly):
    return max(math.hypot((a[0]-b[0])*KX,(a[1]-b[1])*KY) for a in poly for b in poly)
def casco(pts):
    pts=sorted(set(pts))
    cr=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[]
    for q in pts:
        while len(lo)>=2 and cr(lo[-2],lo[-1],q)<=0: lo.pop()
        lo.append(q)
    up=[]
    for q in reversed(pts):
        while len(up)>=2 and cr(up[-2],up[-1],q)<=0: up.pop()
        up.append(q)
    return lo[:-1]+up[:-1]
def area(p): return sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2

# (a) tira lascas minúsculas
for b in predios: b["a"]=m2(b["ring"])
predios=[b for b in predios if b["a"]>=8]
# (b) sobreposição: se um prédio está mais de 45% dentro de outro maior, some o menor
CEL=0.0004; grade={}
for i,b in enumerate(predios):
    xs=[q[0] for q in b["ring"]]; ys=[q[1] for q in b["ring"]]
    b["bb"]=(min(xs),min(ys),max(xs),max(ys)); b["casco"]=casco([tuple(q) for q in b["ring"]]); b["rm"]=False
    for cx in range(int(b["bb"][0]/CEL),int(b["bb"][2]/CEL)+1):
        for cy in range(int(b["bb"][1]/CEL),int(b["bb"][3]/CEL)+1): grade.setdefault((cx,cy),[]).append(i)
vistos=set(); removidos=0
for ids in grade.values():
    for ia in ids:
        for ib in ids:
            if ia>=ib or (ia,ib) in vistos: continue
            vistos.add((ia,ib)); A,B=predios[ia],predios[ib]
            if A["rm"] or B["rm"]: continue
            a,b_=A["bb"],B["bb"]
            if a[2]<b_[0] or b_[2]<a[0] or a[3]<b_[1] or b_[3]<a[1]: continue
            menor,maior=(A,B) if A["a"]<=B["a"] else (B,A)
            if len(maior["casco"])<3: continue
            inter=clip_poly([tuple(q) for q in menor["ring"]],maior["casco"] if area(maior["casco"])>0 else maior["casco"][::-1])
            if len(inter)>=3 and m2(inter)/menor["a"]>0.45: menor["rm"]=True; removidos+=1
predios=[b for b in predios if not b["rm"]]
# casinhas minúsculas (viram "cubinhos" no 3D e poluem o mapa): menores que 28 m², ou até 45 m² se muito altas
antes=len(predios)
predios=[b for b in predios if b["t"]==5 or not (b["a"]<28 or (b["a"]<45 and b["h"]>=4.5))]
print("casinhas minúsculas removidas:",antes-len(predios))
print("prédios sobrepostos removidos:",removidos)
# (c) encolhe cada prédio ~25 cm para abrir uma fresta entre vizinhos; tons; prédios grandes
grandes=0
for k,b in enumerate(predios):
    c=centroid(b["ring"]+[b["ring"][0]]); f=max(0.88,1-0.5/math.sqrt(b["a"]))
    ring=[(c[0]+(q[0]-c[0])*f,c[1]+(q[1]-c[1])*f) for q in b["ring"]]
    t=b["t"]
    if b["a"]>700 or diametro(b["ring"])>42: t=4; grandes+=1        # estrutura grande: cinza-claro
    h=round(b["h"]+(k%9)*0.03,2)                                    # topos nunca no mesmo plano (evita tremor)
    add("pred",{"type":"Polygon","coordinates":[[r5(q) for q in ring]+[r5(ring[0])]]},{"h":h,"t":t})
print("prédios grandes (cinza):",grandes)

# (d) Moema Távora: não existe no OpenStreetMap; modelado sobre a foto de satélite.
#     Pontos em pixels da foto (953x645, norte para cima). 1 px = 0,075 m.
#     Escala e posição escolhidas por busca: máxima folga das ruas e nenhuma invasão dos vizinhos
#     (o pixel (520,62), na Rua Marcílio Dias, ficou 4 m a leste e 5 m a sul do ponto de referência).
M_ESC=0.075; M_LNG=-38.5500944+4/KX; M_LAT=-3.712199+0.0002207-5/KY
def px(p): return (M_LNG+(p[0]-520)*M_ESC/KX, M_LAT-(p[1]-62)*M_ESC/KY)
def circ(c,r,n=14): return [(c[0]+r*math.cos(2*math.pi*i/n),c[1]+r*math.sin(2*math.pi*i/n)) for i in range(n)]
MODELOS=[
  # (pontos em px, altura, base, tom)   tom: 2 telhado, 4 cinza-claro (ginásio/tanque), 5 árvore
  ([(132,26),(500,160),(418,376),(45,258)],9.0,0,4),                                  # ginásio (telhado metálico)
  ([(508,152),(565,128),(918,238),(902,360),(792,625),(735,608),(212,432),(246,346),
    (445,382),(768,462),(772,336),(540,262)],7.0,0,2),                                # prédio em U (telhado cerâmico)
  (circ((525,218),22),11.0,0,4),                                                       # caixa-d'água
  (circ((590,335),68),8.0,2.5,5),                                                      # árvore do pátio
  (circ((125,455),85),8.0,2.5,5),                                                      # árvore grande
  (circ((600,600),50),7.0,2.5,5),
  (circ((340,572),38),6.0,2.5,5),
]
ESC=[px(q) for pts,_,_,_ in MODELOS[:2] for q in pts]
zona=casco(ESC)
ant=len(out)
# tira qualquer prédio do OSM que invada a área da escola
def dentro_poly(pt,poly):
    x,y=pt;c=False
    for i in range(len(poly)):
        a,b=poly[i],poly[i-1]
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: c=not c
    return c
n0=len(out)
out[:]=[f for f in out if not (f["properties"]["k"]=="pred" and dentro_poly(centroid(f["geometry"]["coordinates"][0]),zona))]
print("prédios do OSM removidos da área da escola:",n0-len(out))
for pts,h,base,tom in MODELOS:
    ring=[px(q) for q in pts]
    add("pred",{"type":"Polygon","coordinates":[[r5(q) for q in ring]+[r5(ring[0])]]},{"h":h,"b":base,"t":tom})
print(cont)
fc={"type":"FeatureCollection","features":out}
SAIDA = os.path.join(RAIZ, "public/dados/pirambu.geojson")
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
json.dump(fc, open(SAIDA, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print("gravado em", SAIDA, round(os.path.getsize(SAIDA) / 1e6, 2), "MB")
