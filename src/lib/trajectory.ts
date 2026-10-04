// Street-following path between two points via the public OSRM walking router.
export async function streetPath(from: [number, number], to: [number, number]): Promise<[number, number][] | null> {
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.join(",")};${to.join(",")}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j.routes?.[0]?.geometry?.coordinates ?? null;
  } catch {
    return null;
  }
}
