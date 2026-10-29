import { afterEach, expect, it, vi } from "vitest";
import { streetPath, TIMEOUT_MS } from "@/lib/trajectory";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("aborts a street request after exactly 4000ms and fails silently", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    signal = options.signal;
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
  })));
  const result = streetPath([1, 2], [3, 4]);
  expect(TIMEOUT_MS).toBe(4000);
  await vi.advanceTimersByTimeAsync(3999);
  expect(signal?.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signal?.aborted).toBe(true);
  expect(await result).toBeNull();
});

it("reuses successful street geometry without another request", async () => {
  const coords = [[5, 6], [5.1, 6.1], [7, 8]];
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [{ geometry: { coordinates: coords } }] }) });
  vi.stubGlobal("fetch", fetcher);
  expect(await streetPath([5, 6], [7, 8])).toEqual(coords);
  expect(await streetPath([5, 6], [7, 8])).toEqual(coords);
  expect(fetcher).toHaveBeenCalledTimes(1);
});