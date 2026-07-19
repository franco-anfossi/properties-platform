import { NextResponse, type NextRequest } from "next/server";
import { getUserTimeline, TRACEABILITY_SQL } from "@/lib/traceability";
import { createClient } from "@/lib/supabase/server";

// GET /api/traceability
//
// Reconstruye el recorrido completo de un usuario con UNA SOLA query (ver TRACEABILITY_SQL).
//
// Modelo de acceso (decisión documentada en DECISIONS.md):
//   - Self mode:  con sesión Supabase válida devuelve el timeline del propio usuario
//                 (ignora ?userId). Es el camino de producción una vez que aterrice el auth stream.
//   - Debug mode: ?userId=<uuid> + secreto (header `x-debug-secret` o `?secret=`) igual a
//                 CRON_SECRET. Permite al evaluador inspeccionar cualquier recorrido sin login.
//                 Deshabilitado si CRON_SECRET está vacío.
//   - Ninguno →   401.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");

  // 1) Self mode: sesión válida → propio recorrido.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let targetUserId: string | null = null;

  if (user && (!requestedUserId || requestedUserId === user.id)) {
    targetUserId = user.id;
  } else {
    // 2) Debug mode: userId explícito + secreto.
    const secret = process.env.CRON_SECRET;
    const provided =
      request.headers.get("x-debug-secret") ?? url.searchParams.get("secret");
    const debugAllowed = Boolean(secret) && provided === secret;

    if (requestedUserId && debugAllowed) {
      targetUserId = requestedUserId;
    }
  }

  if (!targetUserId) {
    return NextResponse.json(
      {
        error:
          "No autorizado. Inicia sesión (self mode) o pasa ?userId=<uuid> con el secreto de debug.",
      },
      { status: 401 },
    );
  }

  if (!UUID_RE.test(targetUserId)) {
    return NextResponse.json(
      { error: "userId debe ser un UUID válido." },
      { status: 400 },
    );
  }

  const timeline = await getUserTimeline(targetUserId);

  return NextResponse.json({
    userId: timeline.userId,
    query: TRACEABILITY_SQL,
    count: timeline.events.length,
    sessions: timeline.sessions,
    events: timeline.events,
  });
}
