import type { Feature, Polygon } from "geojson";

// Limites do mapa. Coordenadas no formato [longitude, latitude].
//
// Três camadas, de dentro para fora:
//  1. ÁREA DE FOCO (areaFoco): a área clara e navegável. Acompanha o trecho da Av. Presidente
//     Castelo Branco desenhado pelo Emanuel (linha ciano), a costa e o território do Pirambu,
//     incluindo o Polo.
//  2. ÁREA ESCURECIDA: logo ao redor do foco, ainda dá para ver, só mais escura.
//  3. ÁREA DOS DADOS (areaOcultaAnel): o limite do mapa. Além dele não há nada para ver.
//
// Para ajustar o contorno depois, edite os pontos abaixo (dá para desenhar em geojson.io e
// copiar as coordenadas). Mantenha o primeiro ponto repetido no fim de cada lista.

const foco: [number, number][] = [
  [-38.559591, -3.71278],
  [-38.556397, -3.714039],
  [-38.554405, -3.71441],
  [-38.552443, -3.714526],
  [-38.550503, -3.714464],
  [-38.548519, -3.714759],
  [-38.546549, -3.714951],
  [-38.544575, -3.71517],
  [-38.542041, -3.714975],
  [-38.5408, -3.7144],
  [-38.5435, -3.713],
  [-38.5462, -3.7112],
  [-38.5464, -3.7088],
  [-38.55, -3.706],
  [-38.5535, -3.7036],
  [-38.5565, -3.704],
  [-38.5586, -3.7062],
  [-38.5598, -3.71],
];

// Contorno externo dos dados do mapa: o foco "engordado" cerca de 500 m, em forma convexa.
// Os dados em public/dados/pirambu.geojson são recortados por este contorno (veja scripts/).
// Entre o foco e este contorno o mapa aparece escurecido; fora dele não existe mapa.
const oculta: [number, number][] = [
  [-38.564354, -3.709467],
  [-38.563866, -3.715952],
  [-38.55764, -3.718406],
  [-38.55495, -3.718907],
  [-38.544651, -3.719711],
  [-38.540891, -3.719422],
  [-38.534436, -3.714542],
  [-38.54208, -3.706442],
  [-38.547351, -3.702342],
  [-38.552385, -3.69889],
  [-38.558656, -3.699726],
  [-38.562574, -3.70383],
];

const fechar = (anel: [number, number][]): [number, number][] => [...anel, anel[0] as [number, number]];

export const areaFocoAnel = fechar(foco);
export const areaOcultaAnel = fechar(oculta);

export const areaFoco: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [areaFocoAnel] },
};

// Caixa [oeste, sul, leste, norte] que envolve a área de foco.
export const caixaFoco = foco.reduce<[number, number, number, number]>(
  (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
  [180, 90, -180, -90],
);

// Folgas (em graus) da caixa de navegação ao redor da área de foco.
export const OESTE = 0.0045;
export const LESTE = 0.0045;
export const SUL = 0.0050;
export const NORTE = 0.0045;

// O MapLibre só aceita caixa retangular para limitar o arraste e o afastamento (zoom out).
export const caixaLimite: [number, number, number, number] = [
  caixaFoco[0] - OESTE,
  caixaFoco[1] - SUL,
  caixaFoco[2] + LESTE,
  caixaFoco[3] + NORTE,
];

// Verdadeiro se o ponto [lng, lat] está dentro do anel.
export function dentroDoAnel(ponto: [number, number], anel: [number, number][]): boolean {
  const [x, y] = ponto;
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i] as [number, number];
    const [xj, yj] = anel[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Ponto mais próximo do anel quando o ponto está fora dele (usado para segurar o centro do mapa
// dentro da área de foco). Se o ponto já está dentro, devolve o próprio ponto.
export function limitarAoAnel(ponto: [number, number], anel: [number, number][]): [number, number] {
  if (dentroDoAnel(ponto, anel)) return ponto;
  const kx = Math.cos((-3.712 * Math.PI) / 180); // longitude "encolhe" com a latitude
  let melhor: [number, number] = ponto;
  let menor = Infinity;
  for (let i = 0; i < anel.length - 1; i++) {
    const [ax, ay] = anel[i] as [number, number];
    const [bx, by] = anel[i + 1] as [number, number];
    const dx = (bx - ax) * kx;
    const dy = by - ay;
    const comp = dx * dx + dy * dy;
    let t = comp === 0 ? 0 : (((ponto[0] - ax) * kx) * dx + (ponto[1] - ay) * dy) / comp;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + (bx - ax) * t;
    const qy = ay + (by - ay) * t;
    const d = ((ponto[0] - qx) * kx) ** 2 + (ponto[1] - qy) ** 2;
    if (d < menor) {
      menor = d;
      melhor = [qx, qy];
    }
  }
  return melhor;
}
