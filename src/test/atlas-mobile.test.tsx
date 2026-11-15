import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { areaFocoAnel, areaOcultaAnel, caixaFoco, caixaLimite, dentroDoAnel } from "@/data/limites";
import { PlacePanel, INTERVALO_MS } from "@/components/atlas/PlacePanel";
import { places, type Place } from "@/data/atlas";

const place: Place = { id: "test", name: "Teste", category: "cultura", coords: [0, 0], media: [], people: [], projects: [], stories: [], sources: [] };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Navigation limits", () => {
  it("keeps every place inside the bright focus area", () => {
    for (const p of places) expect(dentroDoAnel(p.coords, areaFocoAnel), p.name).toBe(true);
  });
  it("keeps the focus area inside the dimmed area and the navigation box", () => {
    for (const point of areaFocoAnel) expect(dentroDoAnel(point, areaOcultaAnel)).toBe(true);
    expect(caixaLimite[0]).toBeLessThan(caixaFoco[0]);
    expect(caixaLimite[1]).toBeLessThan(caixaFoco[1]);
    expect(caixaLimite[2]).toBeGreaterThan(caixaFoco[2]);
    expect(caixaLimite[3]).toBeGreaterThan(caixaFoco[3]);
  });
});

describe("Photo carousel", () => {
  const withPhotos = { ...place, media: [0, 1, 2, 3].map((n) => ({ type: "image" as const, url: `https://example.test/${n}.jpg`, caption: `Photo ${n}` })) };
  it("shows the first carousel photo at once and preloads nothing until interaction", () => {
    const requests: string[] = [];
    vi.stubGlobal("Image", class { decoding = ""; set src(v: string) { if (v) requests.push(v); } });
    const { container } = render(<PlacePanel place={withPhotos} onClose={() => {}} />);
    expect(container.querySelectorAll("img")).toHaveLength(2); // banner + 1ª foto do carrossel
    expect(screen.getByAltText("Photo 1")).toBeTruthy();
    expect(requests).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
    expect(screen.getByAltText("Photo 2")).toBeTruthy();
    expect(requests).toEqual(["https://example.test/3.jpg"]);
  });
  it("starts at 2500ms after tapping play, pauses and cleans up on unmount", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { unmount } = render(<PlacePanel place={withPhotos} onClose={() => {}} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByAltText("Photo 1")).toBeTruthy(); // não troca sozinho antes do toque
    fireEvent.click(screen.getByRole("button", { name: "Passar fotos" }));
    expect(INTERVALO_MS).toBe(2500);
    act(() => vi.advanceTimersByTime(2499));
    expect(screen.getByAltText("Photo 1")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByAltText("Photo 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pausar fotos" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByAltText("Photo 2")).toBeTruthy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not autoplay with reduced motion", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
    render(<PlacePanel place={withPhotos} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Passar fotos" })).toBeNull();
    act(() => vi.advanceTimersByTime(7500));
    expect(screen.getByAltText("Photo 1")).toBeTruthy();
  });
});
