import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { people, projects, stories, type Place, type Media } from "@/data/atlas";

// Basta mudar para true para reativar vídeo e Voz do Pirambu.
const SHOW_VIDEO = false;
const SHOW_STORIES = false;
export const INTERVALO_MS = 2500;

function Photos({ photos, name }: { photos: Media[]; name: string }) {
  const [opened, setOpened] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const image = useRef<HTMLImageElement>(null);
  const previous = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(motion.matches);
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  function advance(offset: number) {
    // Guarda apenas os pixels anteriores para o fade, sem manter outra foto carregada no DOM.
    const img = image.current;
    const canvas = previous.current;
    const ctx = canvas?.getContext("2d");
    if (img?.complete && img.naturalWidth && canvas && ctx) {
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (canvas.width - img.naturalWidth * scale) / 2, (canvas.height - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
    }
    setIndex((i) => (i + offset + photos.length) % photos.length);
  }

  useEffect(() => {
    if (!opened || paused || reduced || photos.length < 2) return;
    const timer = window.setInterval(() => advance(1), INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [opened, paused, reduced, photos.length, index]);

  useEffect(() => {
    if (!opened || photos.length < 2) return;
    const next = photos[(index + 1) % photos.length];
    const preload = new Image();
    preload.decoding = "async";
    preload.src = next.url;
    return () => { preload.src = ""; };
  }, [opened, index, photos]);

  const current = photos[index];
  if (!current) return null;
  if (!opened) return (
    <Button variant="outline" onClick={() => setOpened(true)} className="h-auto min-h-11 w-full whitespace-normal py-4">
      <Images aria-hidden="true" /> Toque para ver as fotos ({photos.length})
    </Button>
  );

  return (
    <div>
      <Button variant="ghost" onClick={() => setPaused((p) => !p)} disabled={photos.length === 1 || reduced}
        aria-label={paused ? "Retomar fotos" : "Pausar fotos"} aria-pressed={paused}
        className="relative block aspect-video h-auto w-full overflow-hidden rounded-lg bg-muted p-0 hover:bg-muted disabled:opacity-100">
        <canvas ref={previous} width={960} height={540} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <img ref={image} key={current.url} src={current.url} alt={current.caption || `Foto ${index + 1} de ${name}`}
          loading="lazy" decoding="async" className="relative h-full w-full object-cover animate-in fade-in duration-500 motion-reduce:animate-none" />
        {photos.length > 1 && !reduced && <span className="glass absolute bottom-2 right-2 rounded-full p-2">{paused ? <Play /> : <Pause />}</span>}
      </Button>
      {photos.length > 1 && (
        <div className="flex min-h-11 items-center justify-between gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Foto anterior" onClick={() => advance(-1)}><ChevronLeft /></Button>
          <div className="flex flex-wrap justify-center gap-1" aria-label={`Foto ${index + 1} de ${photos.length}`}>
            {photos.map((photo, i) => <span key={`${photo.url}-${i}`} aria-hidden="true" className={`h-2 w-2 rounded-full ${i === index ? "bg-primary" : "bg-muted-foreground/40"}`} />)}
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Próxima foto" onClick={() => advance(1)}><ChevronRight /></Button>
        </div>
      )}
      {(current.caption || current.source?.label) && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{[current.caption, current.source?.label].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">{title}</h3>
      {children}
    </section>
  );
}

export function PlacePanel({ place, onClose }: { place: Place; onClose: () => void }) {
  const rel = {
    people: people.filter((p) => place.people.includes(p.id)),
    projects: projects.filter((p) => place.projects.includes(p.id)),
    stories: stories.filter((s) => place.stories.includes(s.id) || s.placeId === place.id),
  };
  const images = place.media.filter((m) => m.type === "image");
  const videos = place.media.filter((m) => m.type === "video");

  return (
    <aside aria-label={place.name} className="glass absolute inset-x-0 bottom-0 z-20 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-500 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[40vw] md:rounded-none md:slide-in-from-right">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" />
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 h-11 w-11 text-muted-foreground hover:text-foreground"><X /></Button>
      <h2 className="mt-1 pr-10 font-display text-2xl font-semibold leading-tight">{place.name}</h2>

      <div className="mt-5 space-y-5">
        {images[0] && <img src={images[0].url} alt={images[0].caption || place.name} loading="lazy" decoding="async" className="aspect-video w-full rounded-lg object-cover" />}
        {place.description && <Section title="Importância para a comunidade"><p className="text-sm leading-relaxed">{place.description}</p></Section>}
        {place.history && <Section title="História"><p className="text-sm leading-relaxed">{place.history}</p></Section>}
        {!place.description && !place.history && <p className="text-sm text-muted-foreground">Ainda reunindo informações sobre este lugar.</p>}
        {images.length > 1 && <Section title="Carrossel de fotos"><Photos key={place.id} photos={images.slice(1)} name={place.name} /></Section>}
        {rel.people.length > 0 && <Section title="Pessoas relacionadas"><ul className="text-sm">{rel.people.map((p) => <li key={p.id}>{p.name}{p.role && ` — ${p.role}`}</li>)}</ul></Section>}
        {rel.projects.length > 0 && <Section title="Projetos relacionados"><ul className="text-sm">{rel.projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul></Section>}
        {SHOW_VIDEO && videos.length > 0 && <Section title="Vídeo">{videos.map((v) => <video key={v.url} src={v.url} controls preload="none" className="w-full rounded" />)}</Section>}
        {SHOW_STORIES && rel.stories.length > 0 && <Section title="Voz do Pirambu">{rel.stories.map((s) => <blockquote key={s.id} className="text-sm italic">{s.transcript}{s.audio && <audio src={s.audio} controls preload="none" className="mt-2 w-full" />}</blockquote>)}</Section>}
        <Section title="Fontes">
          <ul className="space-y-1 text-sm">
            {place.sources.map((s) => (
              <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">{s.label}</a> : s.label}</li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}
