import { categories, people, projects, stories, type Place } from "@/data/atlas";

function Empty() {
  return <p className="text-sm italic text-muted-foreground">Aguardando material.</p>;
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
  const cat = place.category === "centro" ? "Referência territorial" : categories.find((c) => c.id === place.category)?.label;
  const rel = {
    people: people.filter((p) => place.people.includes(p.id)),
    projects: projects.filter((p) => place.projects.includes(p.id)),
    stories: stories.filter((s) => place.stories.includes(s.id) || s.placeId === place.id),
  };
  const images = place.media.filter((m) => m.type === "image");
  const videos = place.media.filter((m) => m.type === "video");

  return (
    <aside className="glass absolute inset-x-0 bottom-0 z-20 max-h-[60vh] overflow-y-auto rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-500 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[40vw] md:rounded-none md:slide-in-from-right">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" />
      <button onClick={onClose} aria-label="Fechar" className="absolute right-5 top-5 text-muted-foreground hover:text-foreground">✕</button>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">{cat}</p>
      <h2 className="mt-1 pr-8 font-display text-2xl font-semibold leading-tight">{place.name}</h2>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {place.coords[1].toFixed(5)}, {place.coords[0].toFixed(5)}
      </p>

      <div className="mt-5 space-y-5">
        {images[0] ? <img src={images[0].url} alt={images[0].caption ?? place.name} className="w-full rounded-lg" /> : (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Imagem principal · aguardando material</div>
        )}
        <Section title="Descrição">{place.description ? <p className="text-sm leading-relaxed">{place.description}</p> : <Empty />}</Section>
        <Section title="História">{place.history ? <p className="text-sm leading-relaxed">{place.history}</p> : <Empty />}</Section>
        <Section title="Galeria">
          {images.length > 1 ? <div className="grid grid-cols-2 gap-2">{images.slice(1).map((m) => <img key={m.url} src={m.url} alt={m.caption ?? ""} className="rounded" />)}</div> : <Empty />}
        </Section>
        <Section title="Vídeo">{videos.length ? videos.map((v) => <video key={v.url} src={v.url} controls className="w-full rounded" />) : <Empty />}</Section>
        <Section title="Pessoas relacionadas">{rel.people.length ? <ul className="text-sm">{rel.people.map((p) => <li key={p.id}>{p.name}{p.role && ` — ${p.role}`}</li>)}</ul> : <Empty />}</Section>
        <Section title="Projetos relacionados">{rel.projects.length ? <ul className="text-sm">{rel.projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul> : <Empty />}</Section>
        <Section title="Voz do Pirambu">{rel.stories.length ? rel.stories.map((s) => <blockquote key={s.id} className="text-sm italic">{s.transcript}</blockquote>) : <Empty />}</Section>
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
