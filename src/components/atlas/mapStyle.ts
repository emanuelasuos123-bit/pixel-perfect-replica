import type { StyleSpecification } from "maplibre-gl";

// Mapa ilustrado do Pirambu, desenhado só com os dados recortados da área
// (public/dados/pirambu.geojson, do OpenStreetMap). Não há mapa fora do limite.
// As cores vivem aqui porque o canvas do mapa não lê variáveis de CSS.
//
// Cores principais (mude à vontade):
const COR = {
  fundo: "#0b1424", // além do limite
  mar: "#1a8fa5",
  marRaso: "#62d2c4", // faixa clara perto da costa
  terra: "#d6c4a5", // chão entre as casas
  areia: "#efdfae",
  verde: "#9bb872",
  praca: "#e3d3b5",
  quadra: "#7fa65c",
  espigao: "#cdb88f",
  ruaMenor: "#6c6c72",
  ruaMaior: "#505057",
  ruaPedestre: "#9a958a",
  casas: ["#b9644d", "#a85a46", "#c97d66", "#9b5645"] as const, // tons de telhado
  grandes: "#d9dbdd", // estruturas grandes (prédios, galpões, ginásios): cinza-claro
  arvore: "#5f8f3f",
};

const filtro = (k: string): ["==", ["get", string], string] => ["==", ["get", "k"], k];

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    pirambu: {
      type: "geojson",
      data: "/dados/pirambu.geojson",
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": COR.fundo } },
    { id: "mar", type: "fill", source: "pirambu", filter: filtro("mar"), paint: { "fill-color": COR.mar } },
    {
      id: "mar-raso", type: "line", source: "pirambu", filter: filtro("costa"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COR.marRaso, "line-opacity": 0.75,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 24, 16, 70, 18, 170],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 34, 18, 80],
      },
    },
    { id: "terra", type: "fill", source: "pirambu", filter: filtro("terra"), paint: { "fill-color": COR.terra } },
    { id: "areia", type: "fill", source: "pirambu", filter: filtro("areia"), paint: { "fill-color": COR.areia } },
    { id: "praca", type: "fill", source: "pirambu", filter: filtro("praca"), paint: { "fill-color": COR.praca } },
    { id: "verde", type: "fill", source: "pirambu", filter: filtro("verde"), paint: { "fill-color": COR.verde } },
    { id: "quadra", type: "fill", source: "pirambu", filter: filtro("quadra"), paint: { "fill-color": COR.quadra } },
    // Maquete do Polo: pisos coloridos e linhas de marcação (campo, quadras, areia).
    { id: "chao", type: "fill", source: "pirambu", filter: filtro("chao"), paint: { "fill-color": ["get", "cor"] } },
    {
      id: "marca", type: "line", source: "pirambu", filter: filtro("marca"), minzoom: 15,
      paint: { "line-color": "#f4f7f0", "line-opacity": 0.9, "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.4, 18, 2] },
    },
    {
      id: "espigao", type: "line", source: "pirambu", filter: filtro("espigao"),
      layout: { "line-cap": "round" },
      paint: { "line-color": COR.espigao, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.5, 18, 9] },
    },
    {
      id: "espuma", type: "line", source: "pirambu", filter: filtro("costa"),
      paint: { "line-color": "#f6f1e0", "line-opacity": 0.85, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 18, 3] },
    },
    {
      id: "ruas-pedestre", type: "line", source: "pirambu", filter: ["all", filtro("via"), ["==", ["get", "c"], 3]],
      paint: { "line-color": COR.ruaPedestre, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 18, 3] },
    },
    {
      id: "ruas-menores", type: "line", source: "pirambu", filter: ["all", filtro("via"), ["==", ["get", "c"], 2]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COR.ruaMenor, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 5] },
    },
    {
      id: "ruas-maiores", type: "line", source: "pirambu", filter: ["all", filtro("via"), ["==", ["get", "c"], 1]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": COR.ruaMaior, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 10] },
    },
    {
      id: "casas", type: "fill-extrusion", source: "pirambu", filter: filtro("pred"), minzoom: 13.5,
      paint: {
        "fill-extrusion-color": ["case", ["has", "cor"], ["get", "cor"], ["match", ["get", "t"], 0, COR.casas[0], 1, COR.casas[1], 2, COR.casas[2], 4, COR.grandes, 5, COR.arvore, COR.casas[3]]],
        "fill-extrusion-height": ["coalesce", ["get", "h"], 5],
        "fill-extrusion-base": ["coalesce", ["get", "b"], 0],
        "fill-extrusion-opacity": 0.95,
      },
    },
    {
      id: "road-labels", type: "symbol", source: "pirambu", filter: ["all", filtro("via"), ["has", "n"]], minzoom: 15.5,
      layout: { "symbol-placement": "line", "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 11 },
      paint: { "text-color": "#f4f0e8", "text-halo-color": "#2a2a2f", "text-halo-width": 1.6 },
    },
  ],
};
