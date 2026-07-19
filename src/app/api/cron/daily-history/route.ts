import { type NextRequest, NextResponse } from "next/server";
import { runDailyHistory } from "@/lib/email/daily-history";

// Usa Prisma + node-postgres → requiere runtime Node y ejecución dinámica (nunca cacheado).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron invoca con `Authorization: Bearer <CRON_SECRET>`. Rechazamos cualquier otra cosa.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// GET /api/cron/daily-history — job diario del historial de búsquedas.
// Idempotente: correr dos veces el mismo día no duplica correos.
// Param opcional `?now=<ISO>` (solo autorizado) para probar un día distinto sin esperar al cron.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowParam = request.nextUrl.searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  if (Number.isNaN(now.getTime())) {
    return NextResponse.json(
      { error: "Parámetro `now` inválido (se esperaba fecha ISO)." },
      { status: 400 },
    );
  }

  try {
    const summary = await runDailyHistory(now);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:daily-history] fallo inesperado:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
