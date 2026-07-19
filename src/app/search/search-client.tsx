"use client";

import { useState } from "react";
import type { PropertyResult } from "@/lib/scraper/types";
import type { SearchResponse } from "@/app/api/search/types";
import { PropertyCard } from "./property-card";

type ViewState = "idle" | "loading" | "success" | "empty" | "error";

/**
 * UI de búsqueda. Controla el form, llama a `POST /api/search`, guarda el `sessionId`
 * del recorrido (para el tracking de clicks) y renderiza los resultados. El scraping
 * en vivo puede tardar hasta ~30 s, así que el estado de carga es tolerante.
 */
export function SearchClient() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ViewState>("idle");
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || state === "loading") return;

    setState("loading");
    setErrorMsg(null);
    setLastQuery(trimmed);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "No pudimos completar la búsqueda.");
      }

      const data = (await res.json()) as SearchResponse;
      setSessionId(data.sessionId);

      if (data.status === "ok" && data.results.length > 0) {
        setResults(data.results);
        setState("success");
      } else if (data.status === "empty" || data.results.length === 0) {
        setResults([]);
        setState("empty");
      } else {
        setResults([]);
        setErrorMsg(data.error ?? "El portal no respondió como esperábamos.");
        setState("error");
      }
    } catch (err) {
      setResults([]);
      setErrorMsg(
        err instanceof Error ? err.message : "Ocurrió un error inesperado.",
      );
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Comuna o dirección (ej: Providencia, Ñuñoa…)"
          aria-label="Comuna o dirección"
          autoFocus
          className="flex-1 rounded-lg border border-black/[.12] bg-white px-4 py-3 text-sm text-zinc-900 transition-colors outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[.14] dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={state === "loading" || query.trim().length === 0}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {state === "loading" ? "Buscando…" : "Buscar"}
        </button>
      </form>

      <ResultsArea
        state={state}
        results={results}
        sessionId={sessionId}
        errorMsg={errorMsg}
        lastQuery={lastQuery}
      />
    </div>
  );
}

function ResultsArea({
  state,
  results,
  sessionId,
  errorMsg,
  lastQuery,
}: {
  state: ViewState;
  results: PropertyResult[];
  sessionId: string | null;
  errorMsg: string | null;
  lastQuery: string;
}) {
  if (state === "idle") {
    return (
      <Placeholder
        title="Busca propiedades en vivo"
        body="Escribe una comuna o dirección y consultamos Portal Inmobiliario en tiempo real. Los resultados enlazan a la publicación original."
      />
    );
  }

  if (state === "loading") {
    return <SkeletonGrid />;
  }

  if (state === "error") {
    return (
      <Placeholder
        tone="error"
        title="No pudimos completar la búsqueda"
        body={errorMsg ?? "Intenta nuevamente en unos segundos."}
      />
    );
  }

  if (state === "empty") {
    return (
      <Placeholder
        title="Sin resultados"
        body={`No encontramos propiedades para “${lastQuery}”. Prueba con otra comuna o dirección.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {results.length} resultado{results.length === 1 ? "" : "s"} para{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          “{lastQuery}”
        </span>
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((property) => (
          <PropertyCard
            key={property.externalId}
            property={property}
            sessionId={sessionId}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-xl border border-black/[.06] bg-white dark:border-white/[.08] dark:bg-zinc-900"
        >
          <div className="aspect-[4/3] w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-3 p-4">
            <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Placeholder({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center ${
        tone === "error"
          ? "border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
          : "border-black/[.12] dark:border-white/[.14]"
      }`}
    >
      <h2
        className={`text-base font-semibold ${
          tone === "error"
            ? "text-red-700 dark:text-red-400"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {title}
      </h2>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}
