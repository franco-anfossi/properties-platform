import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getEmailConfig } from "./config";
import { zonedDayRange, formatTimeInZone } from "./dates";
import { renderHistoryEmail, type SearchEntry } from "./render";
import { sendEmail } from "./send";

export type DispatchOutcome = "sent" | "skipped" | "failed";

export interface UserDispatchResult {
  userId: string;
  userLabel: string;
  searchCount: number;
  outcome: DispatchOutcome;
  dryRun?: boolean;
  error?: string;
}

export interface DailyHistorySummary {
  dispatchDate: string;
  timeZone: string;
  dryRun: boolean;
  usersWithActivity: number;
  sent: number;
  skipped: number;
  failed: number;
  results: UserDispatchResult[];
}

// Lee de forma defensiva un string de un payload JSON arbitrario.
function readString(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function readNumber(payload: unknown, key: string): number | null {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

// Best-effort: resuelve el email de cada usuario desde auth.users (gestionado por Supabase Auth).
// Si el rol de DB no puede leer el schema `auth`, degradamos a la etiqueta por UUID.
async function resolveUserEmails(
  userIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (userIds.length === 0) return emails;
  try {
    const rows = await prisma.$queryRaw<{ id: string; email: string | null }[]>(
      Prisma.sql`SELECT id::text AS id, email FROM auth.users WHERE id IN (${Prisma.join(
        userIds.map((id) => Prisma.sql`${id}::uuid`),
      )})`,
    );
    for (const row of rows) {
      if (row.email) emails.set(row.id, row.email);
    }
  } catch (err) {
    console.warn(
      `[daily-history] no se pudo leer auth.users (se usa UUID como etiqueta): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return emails;
}

function labelFor(userId: string, emails: Map<string, string>): string {
  return emails.get(userId) ?? `user ${userId.slice(0, 8)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

// Job diario: por cada usuario con búsquedas en el día de `now`, arma y envía el correo,
// registrando el dispatch para garantizar idempotencia (un envío por usuario por día).
export async function runDailyHistory(now: Date): Promise<DailyHistorySummary> {
  const config = getEmailConfig();
  const range = zonedDayRange(now, config.timeZone);

  const events = await prisma.event.findMany({
    where: {
      type: "SEARCH",
      createdAt: { gte: range.startUtc, lt: range.endUtc },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true, payload: true, createdAt: true },
  });

  // Agrupa las búsquedas por usuario (ya vienen ordenadas por hora ascendente).
  const byUser = new Map<string, SearchEntry[]>();
  for (const event of events) {
    const query = readString(event.payload, "query");
    // Sin query legible no hay búsqueda que reportar; se ignora (robustez ante payloads raros).
    if (!query) continue;
    const entry: SearchEntry = {
      time: formatTimeInZone(event.createdAt, config.timeZone),
      query,
      comuna: readString(event.payload, "comuna"),
      resultCount: readNumber(event.payload, "resultCount"),
    };
    const list = byUser.get(event.userId);
    if (list) list.push(entry);
    else byUser.set(event.userId, [entry]);
  }

  const userIds = [...byUser.keys()];
  const emails = await resolveUserEmails(userIds);

  const results: UserDispatchResult[] = [];
  for (const [userId, searches] of byUser) {
    const userLabel = labelFor(userId, emails);
    results.push(
      await dispatchForUser({
        userId,
        userLabel,
        searches,
        dispatchDate: range.dispatchDate,
        dispatchDateUtc: range.dispatchDateUtc,
        timeZone: config.timeZone,
      }),
    );
  }

  const summary: DailyHistorySummary = {
    dispatchDate: range.dispatchDate,
    timeZone: config.timeZone,
    dryRun: config.dryRun,
    usersWithActivity: userIds.length,
    sent: results.filter((r) => r.outcome === "sent").length,
    skipped: results.filter((r) => r.outcome === "skipped").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    results,
  };
  return summary;
}

// Reserva el slot de idempotencia y, si es nuevo, envía. Si el envío falla, libera la reserva
// para que una corrida posterior reintente (at-least-once, sin duplicar).
async function dispatchForUser(args: {
  userId: string;
  userLabel: string;
  searches: SearchEntry[];
  dispatchDate: string;
  dispatchDateUtc: Date;
  timeZone: string;
}): Promise<UserDispatchResult> {
  const {
    userId,
    userLabel,
    searches,
    dispatchDate,
    dispatchDateUtc,
    timeZone,
  } = args;
  const base = { userId, userLabel, searchCount: searches.length };

  // 1) Reserva atómica vía unique(user_id, dispatch_date). Si ya existe → ya se envió hoy.
  try {
    await prisma.emailDispatch.create({
      data: { userId, dispatchDate: dispatchDateUtc },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ...base, outcome: "skipped" };
    }
    throw err;
  }

  // 2) Reserva nueva → enviar (o dry-run).
  try {
    const rendered = renderHistoryEmail({
      userLabel,
      dispatchDate,
      timeZone,
      searches,
    });
    const result = await sendEmail(rendered);
    return { ...base, outcome: "sent", dryRun: result.dryRun };
  } catch (err) {
    // 3) Falló el envío → liberar la reserva para permitir reintento.
    await prisma.emailDispatch
      .deleteMany({ where: { userId, dispatchDate: dispatchDateUtc } })
      .catch(() => {
        /* si el rollback falla, el próximo run lo verá como ya enviado; se prioriza no crashear */
      });
    return {
      ...base,
      outcome: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
