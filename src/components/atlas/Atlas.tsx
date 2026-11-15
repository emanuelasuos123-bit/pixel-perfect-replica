import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { places, type Place } from "@/data/atlas";
import { areaFoco, areaFocoAnel, areaOcultaAnel, caixaFoco as bounds, caixaLimite, limitarAoAnel } from "@/data/limites";
import { mapStyle } from "./mapStyle";
import { PlacePanel } from "./PlacePanel";
import { Welcome, hasSeenWelcome, markWelcomeSeen } from "./Welcome";

// ---- Ajustes de navegação (mude aqui, sem mexer no resto) ----
// Direção da câmera: sempre olhando do território para o mar.
const ORIENTACAO_BASE = -12;
// Quanto o usuário pode girar para cada lado (graus). Com 0 o giro fica travado.
// Girar muito mostraria a visão mar→cidade, que enxerga Fortaleza inteira e pesa.
const GIRO_MAXIMO = 35;
// Inclinação máxima (graus). Valores menores pesam menos.
const INCLINACAO_MAXIMA = 60;
// A inclinação permitida cresce com o zoom: afastado inclina um pouco menos (a vista alcança
// mais longe), aproximado inclina até o máximo. O centro do mapa já fica preso à área de foco.
const INCLINACAO_AFASTADO = 48;
const ZOOM_SEM_INCLINAR = 15.0; // até aqui vale só a inclinação do afastado
const ZOOM_INCLINACAO_TOTAL = 17.2; // a partir daqui, a inclinação máxima
// Zoom máximo: impede aproximar até ver uma única casa.
const ZOOM_MAXIMO = 17.5;
// Folga (em níveis de zoom) abaixo da vista que mostra o limite inteiro. 0 = exatamente essa vista.
const AFASTAMENTO_FOLGA = 0.1;
// Escurecimento da área ao redor do foco (0 = nada, 1 = preto).
const OPACIDADE_ESCURA = 0.62;

const MUNDO: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
// Polígono "mundo inteiro" com um buraco no formato da área indicada.
const mascara = (buraco: [number, number][]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "Polygon" as const, coordinates: [MUNDO, buraco] },
});

export function Atlas() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, HTMLDivElement>>({});
  const [active, setActive] = useState<Place | null>(null);
  const selectedId = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome());
  const [orientationOpen, setOrientationOpen] = useState(false);
  // Guarda a versão mais recente da ação "tocou no mapa", pois o mapa é criado uma única vez.
  const mapClickRef = useRef<() => void>(() => {});

  const closeWelcome = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  const overview = () =>
    map.current?.fitBounds(bounds, { padding: 60, pitch: 20, bearing: ORIENTACAO_BASE, duration: 1600 });

  useEffect(() => {
    let cancelled = false;
    const created: Marker[] = [];
    import("maplibre-gl").then((mod) => {
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !el.current) return;
      const m = new ml.Map({ container: el.current, style: mapStyle, bounds, maxBounds: caixaLimite, minZoom: 12.5, maxZoom: ZOOM_MAXIMO, fitBoundsOptions: { padding: 60 }, pitch: 20, bearing: ORIENTACAO_BASE, maxPitch: INCLINACAO_MAXIMA, attributionControl: { compact: true } });
      map.current = m;
      // Inclinar pode (dois dedos para cima/baixo no celular; botão direito no computador).
      // Girar fica limitado: a câmera nunca vira para o lado da cidade/mar aberto.
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      // Mantém o centro dentro da área de foco e o giro dentro do limite. Aplicado ao SOLTAR o gesto (e não durante o arrasto, o que
      // interromperia a inclinação): o mapa volta suavemente para dentro do permitido.
      m.on("moveend", () => {
        const c = m.getCenter();
        const alvo = limitarAoAnel([c.lng, c.lat], areaFocoAnel);
        const foraDoFoco = alvo[0] !== c.lng || alvo[1] !== c.lat;
        const b = m.getBearing();
        const giro = Math.min(ORIENTACAO_BASE + GIRO_MAXIMO, Math.max(ORIENTACAO_BASE - GIRO_MAXIMO, b));
        if (foraDoFoco || giro !== b) {
          m.easeTo({ ...(foraDoFoco ? { center: alvo } : {}), bearing: giro, duration: 350 });
        }
      });
      // Tocar/clicar no mapa (sem arrastar) fecha o painel. Arrastar apenas move o mapa:
      // o MapLibre não dispara "click" quando houve arrasto.
      m.on("click", (e) => {
        const target = e.originalEvent?.target as HTMLElement | null;
        if (target?.closest?.(".atlas-marker")) return; // clique em um ponto não fecha
        mapClickRef.current();
      });
      // Afastamento máximo = a vista que mostra o limite inteiro (a mesma de "Voltar ao território").
      // Recalculado conforme o tamanho da tela, então vale para celular em pé, deitado e PC.
      const travarAfastamento = () => {
        const zoom = m.cameraForBounds(bounds, { padding: 60 })?.zoom;
        if (zoom !== undefined) m.setMinZoom(Math.max(12.5, zoom - AFASTAMENTO_FOLGA));
      };
      m.on("resize", travarAfastamento);
      const limitarInclinacao = () => {
        const t = Math.min(1, Math.max(0, (m.getZoom() - ZOOM_SEM_INCLINAR) / (ZOOM_INCLINACAO_TOTAL - ZOOM_SEM_INCLINAR)));
        const maximo = INCLINACAO_AFASTADO + t * (INCLINACAO_MAXIMA - INCLINACAO_AFASTADO);
        m.setMaxPitch(maximo);
      };
      m.on("zoom", limitarInclinacao);
      m.on("load", () => {
        travarAfastamento();
        limitarInclinacao();
        // Área ao redor do foco: escura, mas ainda visível.
        m.addSource("mask", { type: "geojson", data: mascara(areaFocoAnel) });
        m.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#050a14", "fill-opacity": OPACIDADE_ESCURA } }, "road-labels");
        // Mais longe: coberta por completo (o usuário não vê).
        m.addSource("mask-oculta", { type: "geojson", data: mascara(areaOcultaAnel) });
        m.addLayer({ id: "mask-oculta", type: "fill", source: "mask-oculta", paint: { "fill-color": "#0b1424", "fill-opacity": 1 } });
        // Contorno luminoso do limite.
        m.addSource("territory", { type: "geojson", data: areaFoco });
        m.addLayer({ id: "territory-glow", type: "line", source: "territory", paint: { "line-color": "#6cc4ff", "line-width": 8, "line-blur": 8, "line-opacity": 0.35 } });
        m.addLayer({ id: "territory-line", type: "line", source: "territory", paint: { "line-color": "#8fd3ff", "line-width": 1.4 } });

        places.forEach((p) => {
          const d = document.createElement("div");
          d.className = "atlas-marker";
          d.dataset["centro"] = String(p.category === "centro");
          d.title = p.name;
          d.setAttribute("aria-label", p.name);
          d.setAttribute("role", "button");
          d.tabIndex = 0;
          d.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(p); } });
          d.addEventListener("click", (e) => { e.stopPropagation(); select(p); });
          markers.current[p.id] = d;
          created.push(new ml.Marker({ element: d }).setLngLat(p.coords).addTo(m));
          // MapLibre define um rótulo genérico ao adicionar o marcador.
          d.setAttribute("aria-label", p.name);
        });
      });
    });
    return () => { cancelled = true; requestVersion.current += 1; created.forEach((x) => x.remove()); map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // marker visual states
  useEffect(() => {
    places.forEach((p) => {
      const d = markers.current[p.id];
      if (!d) return;
      d.dataset["state"] = active ? (p.id === active.id ? "active" : "dim") : "";
    });
  }, [active]);

  function select(p: Place) {
    requestVersion.current += 1;
    selectedId.current = p.id;
    setActive(p);
    setOrientationOpen(false);
    const desktop = window.innerWidth >= 768;
    map.current?.flyTo({
      center: p.coords, zoom: ZOOM_MAXIMO - 0.1, pitch: 52, bearing: ORIENTACAO_BASE - 8, duration: 2000, essential: true,
      padding: desktop ? { right: window.innerWidth * 0.4, left: 0, top: 0, bottom: 0 } : { bottom: window.innerHeight * 0.5, top: 0, left: 0, right: 0 },
    });
  }

  function close() {
    requestVersion.current += 1;
    selectedId.current = null;
    setActive(null);
    map.current?.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
    overview();
  }

  // Toque no mapa: esconde a orientação e, se houver painel aberto, fecha (igual ao X).
  mapClickRef.current = () => {
    setOrientationOpen(false);
    if (selectedId.current) close();
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0"><div ref={el} className="h-full w-full" /></div>

      {/* Cabeçalho e orientação */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-3 md:left-6 md:top-6">
        <div className="[text-shadow:0_1px_8px_rgba(0,0,0,0.85)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Cybercartografia</p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl"><span className="md:hidden">Grande Pirambu</span><span className="hidden md:inline">Comunidade do Grande Pirambu</span></h1>
          <p className="text-sm font-medium text-foreground">Atlas do território, dos moradores e das histórias.</p>
        </div>
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <button
            onClick={() => setOrientationOpen((o) => !o)}
            aria-expanded={orientationOpen}
            aria-controls="orientacao-texto"
            className="glass flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-accent ring-1 ring-accent/70 hover:text-foreground"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>
            Orientação
          </button>
          {orientationOpen && (
            <p id="orientacao-texto" className="glass w-72 max-w-full rounded-lg px-4 py-3 text-xs leading-relaxed">
              Clique nos pontos para descobrir mais sobre a comunidade do Grande Pirambu!
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`absolute bottom-6 left-4 z-10 flex-col items-start gap-2 md:left-6 ${active ? "hidden md:flex" : "flex"}`}>
        <div className="flex gap-2">
          <button onClick={close} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-primary">Voltar ao território</button>
        </div>
      </div>

      {/* Botão para rever as boas-vindas / sobre o projeto */}
      <button
        onClick={() => setWelcomeOpen(true)}
        aria-label="Sobre o projeto"
        className="glass absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold hover:text-primary md:right-6 md:top-6"
      >
        ?
      </button>

      {active && <PlacePanel key={active.id} place={active} onClose={close} />}

      {welcomeOpen && <Welcome onClose={closeWelcome} />}
    </div>
  );
}
