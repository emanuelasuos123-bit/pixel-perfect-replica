// Atlas data model. All facts here come from OpenStreetMap; fields without
// verified material stay empty and render as "aguardando material".
import boundary from "./boundary.json";

export type CategoryId = "turismo" | "cultura" | "historia" | "arte" | "projetos" | "lazer";

export const categories: { id: CategoryId; label: string }[] = [
  { id: "turismo", label: "Turismo" },
  { id: "cultura", label: "Cultura" },
  { id: "historia", label: "História" },
  { id: "arte", label: "Arte" },
  { id: "projetos", label: "Projetos e comunidade" },
  { id: "lazer", label: "Lazer" },
];

export type Source = { label: string; url?: string };
export type Media = { type: "image" | "video" | "audio"; url: string; caption?: string; source?: Source };

export type Place = {
  id: string;
  name: string;
  category: CategoryId | "centro";
  coords: [number, number]; // [lng, lat]
  description?: string;
  history?: string;
  media: Media[];
  people: string[];
  projects: string[];
  stories: string[];
  sources: Source[];
  years?: [number, number]; // timeline visibility, future use
};

export type Person = { id: string; name: string; role?: string; bio?: string; places: string[]; projects: string[]; works: string[]; sources: Source[] };
export type Project = { id: string; name: string; responsible?: string; description?: string; places: string[]; people: string[]; media: Media[]; sources: Source[] };
export type Story = { id: string; title: string; personId?: string; placeId?: string; transcript?: string; audio?: string; sources: Source[] };

const osm = (type: string, id: number): Source => ({
  label: `OpenStreetMap — ${type}/${id}`,
  url: `https://www.openstreetmap.org/${type}/${id}`,
});

const base = { media: [], people: [], projects: [], stories: [] };

export const territory = boundary as GeoJSON.Feature<GeoJSON.Polygon>;

export const places: Place[] = [
  { ...base, id: "centro", name: "Centro do Pirambu", category: "centro", coords: [-38.5534973, -3.7102184], sources: [osm("relation", 5522180)] },
  { ...base, id: "igreja-maanaim", name: "Igreja Restitui Maanaim", category: "cultura", coords: [-38.5540619, -3.7090532], sources: [osm("way", 686871081)] },
  { ...base, id: "dom-helio", name: "Centro Educacional Dom Hélio Campos", category: "projetos", coords: [-38.5531523, -3.7095799], sources: [osm("way", 686856933)] },
  { ...base, id: "hilberto", name: "Escola Hilberto Silva", category: "projetos", coords: [-38.5556224, -3.7122631], sources: [osm("way", 950117975)] },
  { ...base, id: "flavio-marcilio", name: "Escola Governador Flávio Marcílio", category: "projetos", coords: [-38.5583483, -3.7109752], sources: [osm("way", 950121477)] },
  { ...base, id: "moema", name: "Centro Educacional Moema Távora", category: "projetos", coords: [-38.5500944, -3.712199], sources: [osm("way", 950115008)] },
  { ...base, id: "cristo-redentor", name: "Escola Cristo Redentor", category: "projetos", coords: [-38.5586555, -3.7091321], sources: [osm("way", 950123198)] },
  { ...base, id: "tertuliano", name: "Escola Tertuliano Cambraia", category: "projetos", coords: [-38.5550373, -3.7130773], sources: [osm("node", 6967597192)] },
];

export const people: Person[] = [];
export const projects: Project[] = [];
export const stories: Story[] = []; // "Voz do Pirambu"

export const CENTER = places[0];
