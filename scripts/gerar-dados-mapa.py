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
def circ_m(c,r,n=14): return [(c[0]+r*math.cos(2*math.pi*i/n)/KX,c[1]+r*math.sin(2*math.pi*i/n)/KY) for i in range(n)]
def poligono(ring,h,b,cor): add("pred",{"type":"Polygon","coordinates":[[r6(q) for q in ring]+[r6(ring[0])]]},{"h":h,"b":b,"t":3,"cor":cor})
r6=lambda p:[round(p[0],6),round(p[1],6)]
for pts,h,base,tom in MODELOS:
    if tom==5:   # palmeira (tronco fino + copa em estrela, duas camadas)
        ring=[px(q) for q in pts]; c=centroid(ring+[ring[0]]); r=max(3.8,max(math.hypot((q[0]-c[0])*KX,(q[1]-c[1])*KY) for q in ring)*0.55)
        def est_m(rr,fi):
            return [(c[0]+(rr if i%2==0 else rr*0.38)*math.cos(math.pi*i/5+fi)/KX,c[1]+(rr if i%2==0 else rr*0.38)*math.sin(math.pi*i/5+fi)/KY) for i in range(10)]
        poligono(circ_m(c,0.45,6),9.5,0,"#8a6a45")
        poligono(est_m(r,0),10.2,9.4,"#4f7f38"); poligono(est_m(r*0.8,math.pi/10),10.9,10.2,"#6a9a44")
        continue
    ring=[px(q) for q in pts]
    add("pred",{"type":"Polygon","coordinates":[[r5(q) for q in ring]+[r5(ring[0])]]},{"h":h,"b":base,"t":tom})

# ---------------------------------------------------------------------------------------
# (e) Maquete do Polo do Pirambu (Areninha, quadras, arquibancadas, muretas, árvores)
#     Desenhada sobre a foto de satélite do Google Maps (1145x585 px, norte para cima).
#     A foto é ajustada ao mapa por mínimos quadrados: os 4 cantos do campo (foto) contra os
#     4 cantos do campo no OpenStreetMap (metros a partir do ponto do Polo). Escala resultante ~0,22 m/px.
# ---------------------------------------------------------------------------------------
POLO=(-38.5444985,-3.714376)
CAMPO_PX=[(385,108),(822,196),(768,487),(326,391)]            # NO, NE, SE, SO (foto)
CAMPO_M=[(-93.5,62.6),(2.1,41.6),(-10.2,-20.3),(-105.7,0.7)]  # mesmos cantos no OSM (m)
zp=[complex(x,-y) for x,y in CAMPO_PX]; zm=[complex(x,y) for x,y in CAMPO_M]
pm=sum(zp)/4; mm_=sum(zm)/4
A=sum((a-pm).conjugate()*(b-mm_) for a,b in zip(zp,zm))/sum(abs(a-pm)**2 for a in zp)
def pg(q):  # pixel da foto -> [lng, lat]
    z=A*(complex(q[0],-q[1])-pm)+mm_
    return (POLO[0]+z.real/KX, POLO[1]+z.imag/KY)
print("maquete: escala %.3f m/px, giro %.1f graus"%(abs(A),math.degrees(math.atan2(A.imag,A.real))))
r6=lambda p:[round(p[0],6),round(p[1],6)]
def poly_g(pts): 
    r=[pg(q) for q in pts]; return {"type":"Polygon","coordinates":[[r6(q) for q in r]+[r6(r[0])]]}
def chao(pts,cor): add("chao",poly_g(pts),{"cor":cor})
def linha(pts): add("marca",{"type":"LineString","coordinates":[r6(pg(q)) for q in pts]})
def bloco(pts,h,cor,b=0): add("pred",poly_g(pts),{"h":h,"b":b,"t":3,"cor":cor})
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
NO,NE,SE,SO=CAMPO_PX
def Pc(u,v):  # u: oeste->leste (0..1), v: norte->sul (0..1) dentro do campo
    return lerp(lerp(NO,NE,u),lerp(SO,SE,u),v)
def mureta(pts,larg=4.5,h=0.9,cor="#d9733f",pular=()):
    n=len(pts)
    for i in range(n):
        if i in pular: continue
        a,b=pts[i],pts[(i+1)%n]; dx,dy=b[0]-a[0],b[1]-a[1]; d=math.hypot(dx,dy) or 1
        nx,ny=-dy/d*larg/2,dx/d*larg/2
        bloco([(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)],h,cor)
def cx(c,r,n=24): return [(c[0]+r*math.cos(2*math.pi*i/n),c[1]+r*math.sin(2*math.pi*i/n)) for i in range(n+1)]

todos=[]
# quadras ao lado do campo (cimento/piso claro) com muretas laranja
Q1=[(160,240),(230,127),(298,163),(228,276)]
Q2=[(262,12),(402,48),(372,158),(240,122)]
chao(Q2,"#b9bec3"); chao(Q1,"#a3bcc6"); todos+=Q1+Q2
# quadra 1 (piso claro): meio de quadra com círculo azul, duas meias-luas verdes e linhas brancas
_A,_B,_D=Q1[0],Q1[1],Q1[3]
_ab=(_B[0]-_A[0],_B[1]-_A[1]); _ad=(_D[0]-_A[0],_D[1]-_A[1]); _L=math.hypot(*_ab); _W=math.hypot(*_ad)
def Qp(u,v): return (_A[0]+_ab[0]*u+_ad[0]*v,_A[1]+_ab[1]*u+_ad[1]*v)
_ex=(_ab[0]/_L,_ab[1]/_L); _ey=(_ad[0]/_W,_ad[1]/_W)
def meia(extremo,r):
    c=Qp(extremo,.5); sg=1 if extremo==0 else -1
    return [(c[0]+r*(sg*math.cos(t)*_ex[0]+math.sin(t)*_ey[0]),c[1]+r*(sg*math.cos(t)*_ex[1]+math.sin(t)*_ey[1]))
            for t in [(-90+i*15)*math.pi/180 for i in range(13)]]
for ex_ in (0,1):
    chao(meia(ex_,_W*.42),"#6aa87a"); linha(meia(ex_,_W*.42))
linha([Qp(.04,.06),Qp(.96,.06),Qp(.96,.94),Qp(.04,.94),Qp(.04,.06)]); linha([Qp(.5,.06),Qp(.5,.94)])
chao(cx(Qp(.5,.5),_W*.13,20),"#3f7fc4"); linha(cx(Qp(.5,.5),_W*.2))
# quadra 2 (piso cinza): linhas laterais, linha de meio e linhas de ataque
_a,_b,_c,_d=Q2
def Q2p(u,v): return lerp(lerp(_a,_b,u),lerp(_d,_c,u),v)
linha([Q2p(.05,.07),Q2p(.95,.07),Q2p(.95,.93),Q2p(.05,.93),Q2p(.05,.07)]); linha([Q2p(.5,.07),Q2p(.5,.93)])
linha([Q2p(.3,.07),Q2p(.3,.93)]); linha([Q2p(.7,.07),Q2p(.7,.93)])
mureta(Q1); mureta(Q2)
# campo de grama sintética
chao([NO,NE,SE,SO],"#2f6b3d")
margem=[Pc(-0.012,-0.02),Pc(1.012,-0.02),Pc(1.012,1.02),Pc(-0.012,1.02)]
mureta(margem,pular=(2,))                                      # lado sul fica com as arquibancadas
todos+=[NO,NE,SE,SO]
# marcações do campo (linhas brancas)
linha([NO,NE,SE,SO,NO]); linha([Pc(.5,0),Pc(.5,1)]); linha(cx(Pc(.5,.5),41))
for u0,u1 in ((0,.165),(1,.835)):
    linha([Pc(u0,.2),Pc(u1,.2),Pc(u1,.8),Pc(u0,.8)])
for u0,u1 in ((0,.055),(1,.945)):
    linha([Pc(u0,.37),Pc(u1,.37),Pc(u1,.63),Pc(u0,.63)])
# arquibancadas (3 degraus) ao longo da lateral sul
dx,dy=((SO[0]-NO[0])+(SE[0]-NE[0]))/2,((SO[1]-NO[1])+(SE[1]-NE[1]))/2; dn=math.hypot(dx,dy); nx,ny=dx/dn,dy/dn
for u0,u1 in ((.02,.45),(.51,.96)):
    for k,(d0,d1) in enumerate(((18,26),(26,34),(34,42))):
        a,b=Pc(u0,1),Pc(u1,1)
        bloco([(a[0]+nx*d0,a[1]+ny*d0),(b[0]+nx*d0,b[1]+ny*d0),(b[0]+nx*d1,b[1]+ny*d1),(a[0]+nx*d1,a[1]+ny*d1)],0.6*(k+1),"#aab4bb")
        todos+=[(a[0]+nx*42,a[1]+ny*42),(b[0]+nx*42,b[1]+ny*42)]
# construções pequenas e areia
chao([(680,110),(780,125),(775,175),(680,165)],"#e6d3a0")
bloco([(455,45),(528,60),(520,115),(455,100)],4.0,"#e6e2d8")
bloco([(578,130),(635,138),(632,155),(578,148)],3.0,"#b9644d")
todos+=[(455,45),(528,60),(680,110),(780,125),(775,175)]
chao([(895,335),(945,268),(985,300),(938,368)],"#9aa0a6"); chao([(805,525),(880,396),(958,452),(925,545)],"#848a91")
# postes de iluminação (altos, finos)
for u,v in ((.04,-.05),(.5,-.05),(.96,-.05),(.04,1.05),(.96,1.05)):
    c=Pc(u,v); bloco(cx(c,3,4),16.0,"#8d9399")
# árvores (copa arredondada em 3 camadas sobre um tronco) e palmeiras (tronco fino + copa em estrela)
def estrela(c,r,n=5,fi=0.0):
    pts=[]
    for i in range(2*n):
        rr=r if i%2==0 else r*0.38; a=math.pi*i/n+fi
        pts.append((c[0]+rr*math.cos(a),c[1]+rr*math.sin(a)))
    return pts
def palmeira(c,r=16):
    bloco(cx(c,2.2,6),9.5,"#8a6a45")
    bloco(estrela(c,r,5),10.2,"#4f7f38",9.4)
    bloco(estrela(c,r*0.8,5,math.pi/10),10.9,"#6a9a44",10.2)
def arvore(c,r): palmeira(c,max(15,r*0.8))
for c,r in (((190,432),22),((222,462),24),((255,440),20),((238,500),20),((205,478),18),((292,447),20),((318,478),17),((170,420),16),((200,405),14),((335,512),17),((360,545),15),((445,545),15),((470,520),13),((568,553),14),((600,535),12),
               ((835,18),24),((880,30),22),((930,60),30),((975,40),24),((1050,146),22),((1085,166),28),((1115,125),25),((1120,200),20),((1125,228),17),((1000,95),20),((850,60),14)): arvore(c,r)
for c in ((352,186),(356,236),(300,286),(294,338),(282,372),(358,16),(386,32),(1095,335),(1100,352),(1050,426),(1078,423),(190,132),(285,292),(325,312),(330,360),(440,472),(520,468),(498,482),(312,420)): palmeira(c)
todos+=[(190,432),(255,500),(185,430)]
ZMQ=casco([pg(q) for q in todos])
def centro_ring(f): return centroid(f["geometry"]["coordinates"][0])
n0=len(out)
out[:]=[f for f in out if not (f["properties"]["k"] in ("pred","quadra") and "cor" not in f["properties"] and "b" not in f["properties"]
        and dentro_poly(centro_ring(f),ZMQ))]
print("OSM (prédios/quadras) trocados pela maquete do Polo:",n0-len(out))
print(cont)
fc={"type":"FeatureCollection","features":out}
SAIDA = os.path.join(RAIZ, "public/dados/pirambu.geojson")
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
json.dump(fc, open(SAIDA, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print("gravado em", SAIDA, round(os.path.getsize(SAIDA) / 1e6, 2), "MB")
