// Trajetos por ruas; somente respostas válidas ficam no cache em memória.
const cache = new Map<string, [number, number][]>();
export const TIMEOUT_MS = 4000;

export async function streetPath(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  const key = `${from.join(",")};${to.join(",")}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const coords = j.routes?.[0]?.geometry?.coordinates;
    if (controller.signal.aborted || !Array.isArray(coords) || coords.length < 2 ||
      !coords.every((c: unknown) => Array.isArray(c) && c.length === 2 && c.every((v: unknown) => typeof v === "number" && Number.isFinite(v)))) return null;
    cache.set(key, coords);
    return coords;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
