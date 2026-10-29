import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CENTER, places, territory, type Place } from "@/data/atlas";
import { caixaTerritorio as bounds, caixaLimite } from "@/data/limites";
import { mapStyle } from "./mapStyle";
import { streetPath } from "@/lib/trajectory";
import { PlacePanel } from "./PlacePanel";
import { Welcome, hasSeenWelcome, markWelcomeSeen } from "./Welcome";

const ring = territory.geometry.coordinates[0] as [number, number][];

export function Atlas() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, HTMLDivElement>>({});
  const [active, setActive] = useState<Place | null>(null);
  const selectedId = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const routeAnim = useRef<number>(0);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !hasSeenWelcome());

  const closeWelcome = () => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  };

  const overview = () =>
    map.current?.fitBounds(bounds, { padding: 60, pitch: 20, bearing: -12, duration: 1600 });

  useEffect(() => {
    let cancelled = false;
    const created: Marker[] = [];
    import("maplibre-gl").then((mod) => {
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !el.current) return;
      const m = new ml.Map({ container: el.current, style: mapStyle, bounds, maxBounds: caixaLimite, minZoom: 12.5, fitBoundsOptions: { padding: 60 }, pitch: 20, bearing: -12, maxPitch: 60, attributionControl: { compact: true } });
      map.current = m;
      m.on("load", () => {
        m.addSource("mask", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ring] } },
        });
        m.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#050a14", "fill-opacity": 0.62 } }, "road-labels");
        m.addSource("territory", { type: "geojson", data: territory });
        m.addLayer({ id: "territory-glow", type: "line", source: "territory", paint: { "line-color": "#6cc4ff", "line-width": 8, "line-blur": 8, "line-opacity": 0.35 } });
        m.addLayer({ id: "territory-line", type: "line", source: "territory", paint: { "line-color": "#8fd3ff", "line-width": 1.4 } });
        m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f2c46b", "line-width": 9, "line-blur": 6, "line-opacity": 0.35 } });
        m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffd98a", "line-width": 2.4 } });

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
    return () => { cancelled = true; requestVersion.current += 1; cancelAnimationFrame(routeAnim.current); created.forEach((x) => x.remove()); map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // marker visual states
  useEffect(() => {
    places.forEach((p) => {
      const d = markers.current[p.id];
      if (!d) return;
      d.dataset["state"] = active ? (p.id === active.id ? "active" : p.id === "centro" ? "" : "dim") : "";
    });
  }, [active]);

  const setRoute = (coords: [number, number][]) => {
    const src = map.current?.getSource("route") as GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
  };

  async function select(p: Place) {
    const version = ++requestVersion.current;
    selectedId.current = p.id;
    setActive(p);
    cancelAnimationFrame(routeAnim.current);
    setRoute([]);
    const desktop = window.innerWidth >= 768;
    map.current?.flyTo({
      center: p.coords, zoom: 17.4, pitch: 52, bearing: -20, duration: 2000, essential: true,
      padding: desktop ? { right: window.innerWidth * 0.4, left: 0, top: 0, bottom: 0 } : { bottom: window.innerHeight * 0.5, top: 0, left: 0, right: 0 },
    });
    if (p.id === CENTER.id) return;
    const path = await streetPath(CENTER.coords, p.coords);
    if (!path || version !== requestVersion.current || selectedId.current !== p.id) return;
    let i = 0;
    const step = () => {
      if (version !== requestVersion.current) return;
      i += Math.max(1, Math.ceil(path.length / 60));
      setRoute(path.slice(0, i));
      if (i < path.length) routeAnim.current = requestAnimationFrame(step);
    };
    step();
  }

  function close() {
    requestVersion.current += 1;
    selectedId.current = null;
    setActive(null);
    cancelAnimationFrame(routeAnim.current);
    setRoute([]);
    map.current?.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
    overview();
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0"><div ref={el} className="h-full w-full" /></div>

      {/* Cabeçalho e orientação */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-3 md:left-6 md:top-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Cybercartografia</p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl"><span className="md:hidden">Grande Pirambu</span><span className="hidden md:inline">Comunidade do Grande Pirambu</span></h1>
          <p className="text-xs text-muted-foreground">Atlas do território, das pessoas e das histórias.</p>
        </div>
        <p className="glass w-72 max-w-full rounded-lg px-4 py-2 text-xs leading-relaxed">Clique nos pontos para descobrir mais sobre a comunidade do Grande Pirambu!</p>
      </div>

      {/* Controls */}
      <div className={`absolute bottom-6 left-4 z-10 flex-col items-start gap-2 md:left-6 ${active ? "hidden md:flex" : "flex"}`}>
        <div className="flex gap-2">
          <button onClick={close} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-primary">Voltar ao território</button>
          <button onClick={() => select(CENTER)} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-accent">Centro</button>
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
