"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { logEvent, EventType } from "@/lib/events";
import {
  searchPayload,
  scrapePayload,
  clickPayload,
  favoritePayload,
  DEMO_USER_ID,
} from "@/lib/traceability";
import { createClient } from "@/lib/supabase/server";

// Siembra un recorrido completo login → búsqueda → scraping → click → favorito para el usuario
// actual (o el usuario demo si no hay sesión), compartiendo un session_id. Sirve para demostrar
// en vivo que una sola query reconstruye el recorrido.
export async function seedDemoJourney(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? DEMO_USER_ID;

  const sessionId = randomUUID();
  const searchId = randomUUID();
  const externalId = `MLC-${Math.floor(1_000_000_000 + performance.now())}`;
  const url = `https://www.portalinmobiliario.com/${externalId}`;
  const title = "Departamento 2D/2B, Providencia";

  // Orden explícito, secuencial: garantiza created_at monótono para el recorrido.
  await logEvent({
    userId,
    sessionId,
    type: EventType.LOGIN,
    payload: { method: "password", email: user?.email ?? "demo@pruff.com" },
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.SEARCH,
    payload: searchPayload({
      query: "Providencia",
      comuna: "Providencia",
      searchId,
    }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.SCRAPE,
    payload: scrapePayload({
      source: "portal-inmobiliario",
      status: "ok",
      resultCount: 28,
      durationMs: 980,
      httpStatus: 200,
      query: "Providencia",
      searchId,
    }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.CLICK,
    payload: clickPayload({ externalId, url, title }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.FAVORITE_ADD,
    payload: favoritePayload({ externalId, url, title, price: "UF 6.500" }),
  });

  revalidatePath("/debug/traceability");
}
