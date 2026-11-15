import { territory } from "./atlas";

// Folgas em graus: oeste/sul diminuem os mínimos; leste/norte aumentam os máximos.
export const OESTE = 0.009;
// Leste ampliado para incluir o ponto -3.7176084, -38.5394084 (pedido do Emanuel) com uma pequena folga.
export const LESTE = 0.0086;
export const SUL = 0.009;
export const NORTE = 0.003;

export const caixaTerritorio = (territory.geometry.coordinates[0] ?? []).reduce<[number, number, number, number]>(
  (b, point) => {
    const [x, y] = point;
    if (x === undefined || y === undefined) return b;
    return [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  },
  [180, 90, -180, -90],
);

// Limite de navegação ampliado ao redor do contorno real do território.
export const caixaLimite: [number, number, number, number] = [
  caixaTerritorio[0] - OESTE,
  caixaTerritorio[1] - SUL,
  caixaTerritorio[2] + LESTE,
  caixaTerritorio[3] + NORTE,
];