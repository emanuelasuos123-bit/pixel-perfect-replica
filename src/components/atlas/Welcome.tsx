import { useEffect, useRef, useState } from "react";

// Chave usada para lembrar que a pessoa já viu as boas-vindas neste aparelho.
// Se mudar o texto de forma importante, troque "v1" por "v2" para mostrar de novo.
export const WELCOME_KEY = "atlas-pirambu-boasvindas-v1";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false; // sem acesso ao armazenamento: mostra as boas-vindas
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* sem armazenamento: tudo bem, só vai aparecer de novo na próxima visita */
  }
}

export function Welcome({ onClose }: { onClose: () => void }) {
  const [about, setAbout] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  // Põe o foco no botão "Explorar" só uma vez, ao abrir.
  useEffect(() => {
    button.current?.focus();
  }, []);

  // Tecla Esc fecha a janela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/65 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ maxHeight: "90dvh" }}
      >
        <h2 id="welcome-title" className="font-display text-3xl font-semibold tracking-tight">
          Atlas do Pirambu
        </h2>
        <p className="mt-3 text-base leading-relaxed">
          Um mapa para conhecer o território, as pessoas e as histórias do Pirambu.
        </p>

        <p className="mt-4 flex items-center gap-4 text-base leading-relaxed text-muted-foreground">
          <span className="atlas-marker pointer-events-none inline-block shrink-0" aria-hidden="true" />
          <span>Toque num ponto do mapa para explorar o lugar.</span>
        </p>

        <button
          ref={button}
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Explorar
        </button>

        <button
          onClick={() => setAbout((v) => !v)}
          aria-expanded={about}
          className="mt-3 min-h-11 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {about ? "Esconder" : "Sobre o projeto"}
        </button>

        {about && (
          <p className="mt-1 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            Este atlas reúne lugares, pessoas, projetos e histórias do Pirambu e mostra como tudo se
            conecta. As informações vêm de dados reais e de fontes indicadas em cada lugar. Onde ainda
            não há material, o mapa avisa.
          </p>
        )}
      </div>
    </div>
  );
}
