import { territory } from "./atlas";

// Folgas em graus: oeste/sul diminuem os mínimos; leste/norte aumentam os máximos.
export const OESTE = 0.009;
export const LESTE = 0.006;
export const SUL = 0.009;
export const NORTE = 0.003;

export const caixaTerritorio = territory.geometry.coordinates[0].reduce(
  (b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)],
  [180, 90, -180, -90],
) as [number, number, number, number];

// Limite de navegação ampliado ao redor do contorno real do território.
export const caixaLimite: [number, number, number, number] = [
  caixaTerritorio[0] - OESTE,
  caixaTerritorio[1] - SUL,
  caixaTerritorio[2] + LESTE,
  caixaTerritorio[3] + NORTE,
];