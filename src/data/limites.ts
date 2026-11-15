import type { Feature, Polygon } from "geojson";

// Limites do mapa. Coordenadas no formato [longitude, latitude].
//
// Três camadas, de dentro para fora:
//  1. ÁREA DE FOCO (areaFoco): a área clara e navegável. Acompanha o trecho da Av. Presidente
//     Castelo Branco desenhado pelo Emanuel (linha ciano), a costa e o território do Pirambu,
//     incluindo o Polo.
//  2. ÁREA ESCURECIDA: logo ao redor do foco, ainda dá para ver, só mais escura.
//  3. ÁREA OCULTA (areaOcultaAnel): mais longe, fica totalmente coberta (o usuário não vê).
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

// Contorno externo da área escurecida: o foco "engordado" cerca de 250 m.
const oculta: [number, number][] = [
  [-38.561729, -3.714366],
  [-38.557019, -3.716223],
  [-38.554677, -3.716659],
  [-38.552473, -3.716789],
  [-38.550633, -3.71673],
  [-38.548793, -3.717004],
  [-38.546781, -3.7172],
  [-38.544613, -3.71744],
  [-38.541466, -3.717198],
  [-38.537618, -3.714471],
  [-38.542358, -3.711048],
  [-38.544048, -3.709921],
  [-38.54424, -3.707621],
  [-38.548676, -3.704171],
  [-38.552942, -3.701245],
  [-38.557578, -3.701863],
  [-38.560587, -3.705015],
  [-38.562077, -3.709734],
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
export const OESTE = 0.002;
export const LESTE = 0.002;
export const SUL = 0.0026;
export const NORTE = 0.002;

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
