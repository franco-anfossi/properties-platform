// Read-side de la trazabilidad. La escritura de eventos vive en `@/lib/events` (logEvent);
// aquí reconstruimos el recorrido de un usuario a partir del spine `events`.
//
// Requisito central del desafío: reconstruir `login → búsqueda → scraping → click → favorito`
// con UNA SOLA query. El modelo lo permite porque `events` es append-only y trae todo lo
// necesario (user_id, session_id, type, payload JSONB, created_at) con índice (user_id, created_at).

import { prisma } from "@/lib/prisma";
import { EventType } from "@/generated/prisma/client";

export { EventType };

// La query única, literal, para mostrar en docs / página de debug. `getUserTimeline` usa el
// equivalente tipado de Prisma (`findMany`), que compila exactamente a este SELECT.
export const TRACEABILITY_SQL =
  "SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC";

// UUID fijo del usuario demo — permite sembrar y visualizar un recorrido ANTES de que aterrice
// el stream de auth (events no tiene FK cross-schema, así que un UUID sintético es válido).
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

// ---------------------------------------------------------------------------
// Contrato de payload por EventType (deliverable de coordinación).
//
// Claves de correlación que hacen el recorrido reconstruible y enlazable:
//   - session_id (columna) agrupa un recorrido completo.
//   - searchId enlaza SEARCH ↔ SCRAPE (una búsqueda y su scraping asociado).
//   - externalId enlaza CLICK ↔ FAVORITE_* (la misma propiedad).
//
// Convención: camelCase (JS-native, igual que los campos Prisma). El lector es defensivo y
// también acepta las variantes snake_case que aparecían de forma ilustrativa en el diseño.
// ---------------------------------------------------------------------------

// Nota: usamos `type` (no `interface`) a propósito. Los object-literal types obtienen firma de
// índice implícita, requisito para ser asignables al `Prisma.InputJsonValue` que acepta logEvent.

export type LoginPayload = {
  method?: string; // "password" | "oauth" | ...
  email?: string;
};

export type SearchPayload = {
  query: string; // dirección o comuna buscada
  comuna?: string;
  searchId?: string; // correlación con el SCRAPE resultante
  filters?: Record<string, string | number | boolean | null>;
};

export type ScrapePayload = {
  source: string; // ej: "portal-inmobiliario"
  status: "ok" | "empty" | "blocked" | "error";
  resultCount: number;
  durationMs: number;
  httpStatus?: number;
  query?: string;
  searchId?: string; // correlación con el SEARCH que lo originó
  error?: string;
};

export type ClickPayload = {
  externalId: string; // id de la publicación en el portal
  url: string;
  title?: string;
};

export type FavoritePayload = {
  externalId: string;
  url?: string;
  title?: string;
  price?: string;
};

// Builders opcionales: azúcar tipado para que los streams productores (scraper, favoritos,
// auth) emitan payloads conformes al contrato. logEvent sigue aceptando cualquier JSON.
export const searchPayload = (p: SearchPayload): SearchPayload => p;
export const scrapePayload = (p: ScrapePayload): ScrapePayload => p;
export const clickPayload = (p: ClickPayload): ClickPayload => p;
export const favoritePayload = (p: FavoritePayload): FavoritePayload => p;

// ---------------------------------------------------------------------------
// Tipos de la reconstrucción.
// ---------------------------------------------------------------------------

// Fila cruda tal como sale de la query única.
export interface RawEvent {
  id: string;
  userId: string;
  sessionId: string | null;
  type: EventType;
  payload: unknown;
  createdAt: Date;
}

// Un paso legible del timeline (derivado de una fila).
export interface TimelineStep {
  id: string;
  at: string; // ISO
  type: EventType;
  icon: string;
  label: string; // resumen corto de una línea
  detail: string; // detalle secundario (puede ir vacío)
  correlationKey: string | null; // searchId o externalId, para enlazar pasos
}

// Un recorrido (agrupado por session_id).
export interface TimelineSession {
  sessionId: string | null;
  startedAt: string;
  endedAt: string;
  steps: TimelineStep[];
}

export interface UserTimeline {
  userId: string;
  query: string;
  events: RawEvent[];
  sessions: TimelineSession[];
}

// ---------------------------------------------------------------------------
// Reconstrucción (puro, sin I/O — testeable con fixtures).
// ---------------------------------------------------------------------------

// Lee una clave del payload aceptando camelCase o snake_case, de forma segura.
function read(payload: unknown, ...keys: string[]): unknown {
  if (payload === null || typeof payload !== "object") return undefined;
  const obj = payload as Record<string, unknown>;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Convierte una fila cruda en un paso legible del timeline.
export function describeEvent(e: RawEvent): TimelineStep {
  const p = e.payload;
  const base = {
    id: e.id,
    at: e.createdAt.toISOString(),
    type: e.type,
  };

  switch (e.type) {
    case EventType.LOGIN: {
      const email = str(read(p, "email"));
      const method = str(read(p, "method"));
      return {
        ...base,
        icon: "🔐",
        label: "Inició sesión",
        detail: [email, method && `vía ${method}`].filter(Boolean).join(" · "),
        correlationKey: null,
      };
    }
    case EventType.SEARCH: {
      const query = str(read(p, "query")) ?? "(sin término)";
      const comuna = str(read(p, "comuna"));
      const searchId = str(read(p, "searchId", "search_id")) ?? null;
      return {
        ...base,
        icon: "🔎",
        label: `Buscó "${query}"`,
        detail: comuna ? `Comuna: ${comuna}` : "",
        correlationKey: searchId,
      };
    }
    case EventType.SCRAPE: {
      const source = str(read(p, "source")) ?? "portal";
      const status = str(read(p, "status")) ?? "ok";
      const count = read(p, "resultCount", "result_count");
      const duration = read(p, "durationMs", "duration_ms");
      const searchId = str(read(p, "searchId", "search_id")) ?? null;
      const n = typeof count === "number" ? count : "?";
      const ms = typeof duration === "number" ? ` en ${duration} ms` : "";
      return {
        ...base,
        icon: status === "ok" ? "🛰️" : "⚠️",
        label: `Scraping ${source}: ${status} — ${n} resultados`,
        detail: ms.trim(),
        correlationKey: searchId,
      };
    }
    case EventType.CLICK: {
      const externalId = str(read(p, "externalId", "external_id")) ?? null;
      const title = str(read(p, "title"));
      const url = str(read(p, "url"));
      return {
        ...base,
        icon: "👆",
        label: `Click en ${title ?? externalId ?? "propiedad"}`,
        detail: url ?? "",
        correlationKey: externalId,
      };
    }
    case EventType.FAVORITE_ADD:
    case EventType.FAVORITE_REMOVE: {
      const externalId = str(read(p, "externalId", "external_id")) ?? null;
      const title = str(read(p, "title"));
      const price = str(read(p, "price"));
      const added = e.type === EventType.FAVORITE_ADD;
      return {
        ...base,
        icon: added ? "⭐" : "☆",
        label: `${added ? "Agregó a" : "Quitó de"} favoritos: ${title ?? externalId ?? "propiedad"}`,
        detail: price ?? "",
        correlationKey: externalId,
      };
    }
    default: {
      // Exhaustividad: si se agrega un EventType nuevo, TS obliga a manejarlo aquí.
      return {
        ...base,
        icon: "•",
        label: String(e.type),
        detail: "",
        correlationKey: null,
      };
    }
  }
}

// Agrupa las filas por session_id preservando el orden cronológico. Como la query ya viene
// ordenada por created_at ASC, cada sesión conserva el orden del recorrido.
export function reconstructTimeline(events: RawEvent[]): TimelineSession[] {
  const order: (string | null)[] = [];
  const groups = new Map<string, TimelineStep[]>();
  const meta = new Map<
    string,
    { sessionId: string | null; start: string; end: string }
  >();

  for (const e of events) {
    const key = e.sessionId ?? "∅";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(e.sessionId);
      meta.set(key, {
        sessionId: e.sessionId,
        start: e.createdAt.toISOString(),
        end: e.createdAt.toISOString(),
      });
    }
    const step = describeEvent(e);
    groups.get(key)!.push(step);
    meta.get(key)!.end = step.at;
  }

  return order.map((sessionId) => {
    const key = sessionId ?? "∅";
    const m = meta.get(key)!;
    return {
      sessionId: m.sessionId,
      startedAt: m.start,
      endedAt: m.end,
      steps: groups.get(key)!,
    };
  });
}

// ---------------------------------------------------------------------------
// La query única (I/O). Un solo SELECT reconstruye el recorrido completo.
// ---------------------------------------------------------------------------

export async function getUserTimeline(userId: string): Promise<UserTimeline> {
  // Equivalente tipado de: SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC
  const events = (await prisma.event.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })) as RawEvent[];

  return {
    userId,
    query: TRACEABILITY_SQL,
    events,
    sessions: reconstructTimeline(events),
  };
}
