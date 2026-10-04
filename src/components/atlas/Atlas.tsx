import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CENTER, categories, places, territory, type CategoryId, type Place } from "@/data/atlas";
import { mapStyle } from "./mapStyle";
import { streetPath } from "@/lib/trajectory";
import { PlacePanel } from "./PlacePanel";

const ring = territory.geometry.coordinates[0] as [number, number][];
const bounds = ring.reduce(
  (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
  [180, 90, -180, -90],
) as [number, number, number, number];

export function Atlas() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, HTMLDivElement>>({});
  const [active, setActive] = useState<Place | null>(null);
  const [filters, setFilters] = useState<Set<CategoryId>>(new Set(categories.map((c) => c.id)));
  const [query, setQuery] = useState("");
  const [layersOpen, setLayersOpen] = useState(false);
  const routeAnim = useRef<number>(0);

  const overview = () =>
    map.current?.fitBounds(bounds, { padding: 60, pitch: 20, bearing: -12, duration: 1600 });

  useEffect(() => {
    let cancelled = false;
    const created: Marker[] = [];
    import("maplibre-gl").then(({ default: ml }) => {
      if (cancelled || !el.current) return;
      const m = new ml.Map({ container: el.current, style: mapStyle, bounds, fitBoundsOptions: { padding: 60 }, pitch: 20, bearing: -12, maxPitch: 60, attributionControl: { compact: true } });
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
        m.addSource("links", {
          type: "geojson",
          data: { type: "FeatureCollection", features: places.slice(1).map((p) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [CENTER.coords, p.coords] } })) },
        });
        m.addLayer({ id: "links", type: "line", source: "links", paint: { "line-color": "#f2c46b", "line-width": 0.6, "line-opacity": 0.18, "line-dasharray": [2, 4] } });
        m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f2c46b", "line-width": 9, "line-blur": 6, "line-opacity": 0.35 } });
        m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffd98a", "line-width": 2.4 } });

        places.forEach((p) => {
          const d = document.createElement("div");
          d.className = "atlas-marker";
          d.dataset.centro = String(p.category === "centro");
          d.title = p.name;
          d.setAttribute("aria-label", p.name);
          d.addEventListener("click", (e) => { e.stopPropagation(); select(p); });
          markers.current[p.id] = d;
          created.push(new ml.Marker({ element: d }).setLngLat(p.coords).addTo(m));
        });
      });
    });
    return () => { cancelled = true; created.forEach((x) => x.remove()); map.current?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // marker visual states
  useEffect(() => {
    places.forEach((p) => {
      const d = markers.current[p.id];
      if (!d) return;
      const visible = p.category === "centro" || filters.has(p.category);
      d.dataset.state = !visible ? "hidden" : active ? (p.id === active.id ? "active" : p.id === "centro" ? "" : "dim") : "";
    });
    map.current?.getLayer("links") && map.current.setPaintProperty("links", "line-opacity", active ? 0 : 0.18);
  }, [filters, active]);

  const setRoute = (coords: [number, number][]) => {
    const src = map.current?.getSource("route") as GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
  };

  async function select(p: Place) {
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
    if (!path) return;
    let i = 0;
    const step = () => {
      i += Math.max(1, Math.ceil(path.length / 60));
      setRoute(path.slice(0, i));
      if (i < path.length) routeAnim.current = requestAnimationFrame(step);
    };
    step();
  }

  function close() {
    setActive(null);
    cancelAnimationFrame(routeAnim.current);
    setRoute([]);
    map.current?.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
    overview();
  }

  const results = useMemo(
    () => (query.trim() ? places.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())) : []),
    [query],
  );

  const toggle = (id: CategoryId) =>
    setFilters((f) => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div ref={el} className="absolute inset-0" />

      {/* Title + search */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-3 md:left-6 md:top-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Cybercartografia · Fortaleza</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Pirambu</h1>
          <p className="text-xs text-muted-foreground">Atlas do território, das pessoas e das histórias.</p>
        </div>
        <div className="pointer-events-auto relative w-72 max-w-full">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar lugar, pessoa, projeto…"
            className="glass w-full rounded-full px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
          {results.length > 0 && (
            <ul className="glass absolute mt-2 w-full overflow-hidden rounded-xl text-sm">
              {results.map((p) => (
                <li key={p.id}>
                  <button className="w-full px-4 py-2 text-left hover:bg-secondary" onClick={() => { setQuery(""); select(p); }}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-4 z-10 flex flex-col items-start gap-2 md:left-6">
        {layersOpen && (
          <div className="glass flex flex-col gap-1 rounded-xl p-3 text-sm">
            {categories.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="accent-primary" checked={filters.has(c.id)} onChange={() => toggle(c.id)} />
                {c.label}
              </label>
            ))}
            <span className="mt-1 text-[11px] text-muted-foreground">Pessoas · em breve</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setLayersOpen((o) => !o)} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-primary">Camadas</button>
          <button onClick={close} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-primary">Voltar ao território</button>
          <button onClick={() => select(CENTER)} className="glass rounded-full px-4 py-2 text-xs font-medium hover:text-accent">Centro</button>
        </div>
      </div>

      {active && <PlacePanel place={active} onClose={close} />}
    </div>
  );
}
