// Atlas data model. All facts here come from OpenStreetMap; fields without
// verified material stay empty and render as "aguardando material".
import boundary from "./boundary.json";
import type { Feature, Polygon } from "geojson";

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

// Fotos registradas pela equipe de cybercartografia; as pessoas retratadas autorizaram o uso.
const FOTO_EQUIPE: Source = { label: "Foto: equipe de cybercartografia" };

const base = { media: [], people: [], projects: [], stories: [] };

export const territory = boundary as unknown as Feature<Polygon>;

export const places: Place[] = [
  { ...base, id: "moema", name: "Centro Educacional Moema Távora", category: "projetos", coords: [-38.5500944, -3.712199], sources: [osm("way", 950115008)] },
  {
    ...base,
    id: "polo",
    name: "Polo",
    category: "lazer",
    coords: [-38.5444985, -3.714376],
    description:
      "O Polo do Pirambu é um espaço público destinado ao esporte, ao lazer e à convivência comunitária. Sua estrutura conta com um campo de futebol com grama sintética, vestiários, arquibancadas, duas quadras poliesportivas, um campo de areia, espaço de ginástica e parque infantil. O lugar atende pessoas de diferentes idades e também promove atividades esportivas gratuitas, como escolinhas de futebol para crianças, jovens e adolescentes, e até atividade de corrida em grupo, assim incentivando a inclusão social e a qualidade de vida, fazendo com que relacionamentos e histórias se desenvolvam neste lugar.",
    history:
      "Antes de se tornar uma Areninha, o espaço onde hoje está localizado o equipamento já funcionou como kartódromo e campo de futebol. Posteriormente, passou por uma transformação promovida pela Prefeitura de Fortaleza, sendo entregue à população durante a gestão do prefeito Roberto Cláudio, em uma cerimônia realizada no dia 12 de março. A iniciativa fez parte de um projeto municipal de implantação de espaços esportivos em comunidades, especialmente em áreas que enfrentavam problemas sociais e de violência. Além da construção da estrutura, foi prevista a participação dos moradores na administração do espaço por meio de um Conselho Gestor comunitário. Histórico elaborado com base nas informações divulgadas pela Prefeitura de Fortaleza.",
    media: [
      { type: "image", url: "/lugares/polo/foto-01.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-02.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-03.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-04.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-05.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-06.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-07.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-08.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-09.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-10.jpg", source: FOTO_EQUIPE },
      { type: "image", url: "/lugares/polo/foto-11.jpg", source: FOTO_EQUIPE },
    ],
    sources: [{ label: "Publicação da Prefeitura de Fortaleza" }],
  },
];

export const people: Person[] = [];
export const projects: Project[] = [];
export const stories: Story[] = []; // "Voz do Pirambu"

