import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logEvent, EventType } from "@/lib/events";
import type { ClickRequestBody } from "./types";

/**
 * POST /api/click
 *
 * Registra el CLICK del usuario sobre un resultado ANTES de abrir la URL original.
 * Es el eslabón `click` del recorrido trazable; hereda el `sessionId` de la búsqueda
 * para agrupar todo el recorrido. Devuelve 204 (sin cuerpo): el tracking no debe
 * frenar la apertura de la pestaña nueva en el cliente.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: ClickRequestBody;
  try {
    body = (await request.json()) as ClickRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const externalId =
    typeof body.externalId === "string" ? body.externalId.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!externalId || !isHttpUrl(url)) {
    return NextResponse.json(
      { error: "externalId y una url http(s) válida son obligatorios" },
      { status: 400 },
    );
  }

  await logEvent({
    userId: user.id,
    sessionId: body.sessionId ?? null,
    type: EventType.CLICK,
    payload: { external_id: externalId, url },
  });

  return new NextResponse(null, { status: 204 });
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
