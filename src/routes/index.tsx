import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const Atlas = lazy(() => import("@/components/atlas/Atlas").then((m) => ({ default: m.Atlas })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pirambu — Mapa digital interativo" },
      { name: "description", content: "Atlas cybercartográfico do Pirambu, Fortaleza: lugares, pessoas, histórias, arte e projetos do território." },
      { property: "og:title", content: "Pirambu — Mapa digital interativo" },
      { property: "og:description", content: "Conhecer o Pirambu através do território, das pessoas e das histórias que existem nele." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <main className="fixed inset-0 bg-background">
      {ready && (
        <Suspense fallback={null}>
          <Atlas />
        </Suspense>
      )}
    </main>
  );
}
