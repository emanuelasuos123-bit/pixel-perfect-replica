import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { people, projects, stories, type Place, type Media } from "@/data/atlas";

// Basta mudar para true para reativar vídeo e Voz do Pirambu.
const SHOW_VIDEO = false;
const SHOW_STORIES = false;
export const INTERVALO_MS = 2500;

// Carrossel: a primeira foto já aparece; o visitante passa com as setas, deslizando o dedo
// ou tocando em "Passar fotos" (que liga a troca automática). As demais só são baixadas
// quando a pessoa começa a interagir, e sempre apenas a próxima.
function Photos({ photos, name }: { photos: Media[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(true);
  const image = useRef<HTMLImageElement>(null);
  const previous = useRef<HTMLCanvasElement>(null);
  const startX = useRef<number | null>(null);

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

  function go(offset: number) {
    setTouched(true);
    advance(offset);
  }

  useEffect(() => {
    if (!playing || reduced || photos.length < 2) return;
    const timer = window.setInterval(() => advance(1), INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [playing, reduced, photos.length, index]);

  useEffect(() => {
    if (!touched || photos.length < 2) return;
    const next = photos[(index + 1) % photos.length];
    if (!next) return;
    const preload = new Image();
    preload.decoding = "async";
    preload.src = next.url;
    return () => { preload.src = ""; };
  }, [touched, index, photos]);

  const current = photos[index];
  if (!current) return null;
  const many = photos.length > 1;

  return (
    <div>
      <div
        role="group"
        aria-label={`Fotos de ${name}`}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => { startX.current = e.clientX; }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (many && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { startX.current = null; }}
      >
        <canvas ref={previous} width={960} height={720} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <img ref={image} key={current.url} src={current.url} alt={current.caption || `Foto ${index + 1} de ${name}`}
          loading="lazy" decoding="async" draggable={false} className="relative h-full w-full select-none object-cover animate-in fade-in duration-500 motion-reduce:animate-none" />
        {many && (
          <>
            <Button variant="ghost" size="icon" aria-label="Foto anterior" onClick={() => go(-1)}
              className="glass absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full"><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" aria-label="Próxima foto" onClick={() => go(1)}
              className="glass absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full"><ChevronRight /></Button>
            <span className="glass absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-medium">{index + 1} / {photos.length}</span>
            {!reduced && (
              <Button variant="ghost" onClick={() => { setTouched(true); setPlaying((p) => !p); }}
                aria-label={playing ? "Pausar fotos" : "Passar fotos"} aria-pressed={playing}
                className="glass absolute bottom-2 right-2 h-11 gap-2 rounded-full px-4 text-xs font-semibold">
                {playing ? <><Pause aria-hidden="true" /> Pausar</> : <><Play aria-hidden="true" /> Passar fotos</>}
              </Button>
            )}
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
          {photos.map((photo, i) => <span key={`${photo.url}-${i}`} className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-2 bg-muted-foreground/40"}`} />)}
        </div>
      )}
      {(current.caption || current.source?.label) && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{[current.caption, current.source?.label].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

// Texto longo, na medida certa para cada tela:
// celular: letra 15px e só 4 linhas, com "Ler mais"; computador: texto inteiro em letra 16px.
// A frase final de crédito ("Informações baseadas…", "Histórico elaborado…") vira uma nota pequena.
function TextoLongo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const corte = text.search(/\s(Informações baseadas|Histórico elaborado)/);
  const principal = corte > 0 ? text.slice(0, corte) : text;
  const nota = corte > 0 ? text.slice(corte).trim() : "";
  return (
    <div>
      <p className={`text-[15px] leading-relaxed md:text-base md:leading-7 md:line-clamp-none ${open ? "" : "line-clamp-4"}`}>{principal}</p>
      {principal.length > 180 && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 text-sm font-medium text-primary md:hidden">
          {open ? "Ler menos" : "Ler mais"}
        </button>
      )}
      {nota && <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">{nota}</p>}
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

  const hero = images[0];

  return (
    <aside aria-label={place.name} className="glass absolute inset-x-0 bottom-0 z-20 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-500 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[40vw] md:rounded-none md:slide-in-from-right">
      {/* Banner: a foto principal ocupa toda a largura; o topo escurece (azul-marinho) para o nome aparecer bem. */}
      <div className="relative">
        {hero ? (
          <>
            <img src={hero.url} alt={hero.caption || place.name} decoding="async" className="block aspect-[16/10] w-full object-cover md:aspect-[4/3]" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b from-[#0a1830] via-[#0a1830]/70 to-transparent" />
          </>
        ) : (
          <div className="h-24" />
        )}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 flex justify-center pt-2 md:hidden"><span className="h-1 w-10 rounded-full bg-white/40" /></div>
        <h2 className="absolute inset-x-0 top-0 pb-3 pl-6 pr-16 pt-7 font-display text-4xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] md:pt-8 md:text-5xl">{place.name}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 h-11 w-11 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"><X /></Button>
      </div>

      <div className="space-y-5 px-6 pt-5">
        {place.description && <Section title="Importância para a comunidade"><TextoLongo text={place.description} /></Section>}
        {place.history && <Section title="História"><TextoLongo text={place.history} /></Section>}
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
