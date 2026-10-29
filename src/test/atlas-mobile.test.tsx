import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { caixaLimite, caixaTerritorio, OESTE, LESTE, SUL, NORTE } from "@/data/limites";
import { PlacePanel, INTERVALO_MS } from "@/components/atlas/PlacePanel";
import type { Place } from "@/data/atlas";

const place: Place = { id: "test", name: "Teste", category: "cultura", coords: [0, 0], media: [], people: [], projects: [], stories: [], sources: [] };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Navigation margins", () => {
  it("expands west by 0.009 degrees", () => { expect(OESTE).toBe(0.009); expect(caixaLimite[0]).toBeCloseTo(caixaTerritorio[0] - 0.009, 10); });
  it("expands east by 0.006 degrees", () => { expect(LESTE).toBe(0.006); expect(caixaLimite[2]).toBeCloseTo(caixaTerritorio[2] + 0.006, 10); });
  it("expands south by 0.009 degrees", () => { expect(SUL).toBe(0.009); expect(caixaLimite[1]).toBeCloseTo(caixaTerritorio[1] - 0.009, 10); });
  it("expands north by 0.003 degrees", () => { expect(NORTE).toBe(0.003); expect(caixaLimite[3]).toBeCloseTo(caixaTerritorio[3] + 0.003, 10); });
});

describe("Opt-in photos", () => {
  const withPhotos = { ...place, media: [0, 1, 2, 3].map((n) => ({ type: "image" as const, url: `https://example.test/${n}.jpg`, caption: `Photo ${n}` })) };
  it("does not load extra photos before opening and preloads only the next", () => {
    const requests: string[] = [];
    vi.stubGlobal("Image", class { decoding = ""; set src(v: string) { if (v) requests.push(v); } });
    const { container } = render(<PlacePanel place={withPhotos} onClose={() => {}} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(requests).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Toque para ver/ }));
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(requests).toEqual(["https://example.test/2.jpg"]);
  });
  it("advances at 2500ms, pauses on touch and cleans up on unmount", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { unmount } = render(<PlacePanel place={withPhotos} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Toque para ver/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Toque para ver/ }));
    act(() => vi.advanceTimersByTime(7500));
    expect(screen.getByAltText("Photo 1")).toBeTruthy();
  });
});