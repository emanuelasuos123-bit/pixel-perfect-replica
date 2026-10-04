import type { StyleSpecification } from "maplibre-gl";

// Dark blue cartography on OpenFreeMap (OpenStreetMap data). Map paint colors
// live here because the map canvas cannot read CSS variables.
export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1424" } },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": "#071a33" } },
    { id: "landuse", type: "fill", source: "omt", "source-layer": "landuse", paint: { "fill-color": "#0f1c30", "fill-opacity": 0.6 } },
    { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": "#0f2a33", "fill-opacity": 0.7 } },
    {
      id: "roads-minor", type: "line", source: "omt", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "path", "track"]]],
      paint: { "line-color": "#22344f", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 4] },
    },
    {
      id: "roads-major", type: "line", source: "omt", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary", "trunk", "motorway"]]],
      paint: { "line-color": "#2f4a70", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 8] },
    },
    {
      id: "buildings", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 14,
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 4], 0, "#1a3358", 20, "#3a6aa8"],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 4],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    },
    {
      id: "road-labels", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 15.5,
      layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11 },
      paint: { "text-color": "#7f97b8", "text-halo-color": "#0b1424", "text-halo-width": 1.2 },
    },
  ],
};
