import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getEmailConfig } from "./config";
import { zonedDayRange, formatTimeInZone } from "./dates";
import {
  renderDigestEmail,
  type SearchEntry,
  type UserHistory,
} from "./render";
import { sendEmail } from "./send";

export type DispatchOutcome = "sent" | "skipped" | "failed";

export interface DailyHistorySummary {
  dispatchDate: string;
  timeZone: string;
  dryRun: boolean;
  usersWithActivity: number;
  totalSearches: number;
  outcome: DispatchOutcome; // sent | skipped (ya enviado o sin actividad) | failed
  reason?: string; // detalle cuando skipped/failed
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

// Job diario: arma UN correo digest con el historial de búsquedas de todos los usuarios con
// actividad ese día y lo envía a los destinatarios (EMAIL_TO). Idempotente por día:
// correr el job dos veces el mismo día no reenvía (unique(dispatch_date)).
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
  const totalSearches = [...byUser.values()].reduce((n, s) => n + s.length, 0);
  const base = {
    dispatchDate: range.dispatchDate,
    timeZone: config.timeZone,
    dryRun: config.dryRun,
    usersWithActivity: userIds.length,
    totalSearches,
  };

  // Sin actividad → no hay correo que enviar ese día.
  if (userIds.length === 0) {
    return { ...base, outcome: "skipped", reason: "sin actividad hoy" };
  }

  const emails = await resolveUserEmails(userIds);
  const users: UserHistory[] = userIds
    .map((id) => ({ label: labelFor(id, emails), searches: byUser.get(id)! }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const dispatch = await reserveAndSendDigest(range, users, config.timeZone);
  return { ...base, ...dispatch };
}

// Reserva atómica del slot del día (unique(dispatch_date)) y, si es nuevo, envía el digest.
// Si el envío falla, libera la reserva para que una corrida posterior reintente (at-least-once,
// sin duplicar el correo del día).
async function reserveAndSendDigest(
  range: { dispatchDate: string; dispatchDateUtc: Date },
  users: UserHistory[],
  timeZone: string,
): Promise<{ outcome: DispatchOutcome; reason?: string }> {
  // 1) Reserva. Si ya existe la fila del día → ya se envió hoy.
  try {
    await prisma.emailDispatch.create({
      data: { dispatchDate: range.dispatchDateUtc, userCount: users.length },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { outcome: "skipped", reason: "ya enviado hoy" };
    }
    throw err;
  }

  // 2) Reserva nueva → enviar (o dry-run).
  try {
    const rendered = renderDigestEmail({
      dispatchDate: range.dispatchDate,
      timeZone,
      users,
    });
    await sendEmail(rendered);
    return { outcome: "sent" };
  } catch (err) {
    // 3) Falló el envío → liberar la reserva para permitir reintento sin duplicar.
    await prisma.emailDispatch
      .deleteMany({ where: { dispatchDate: range.dispatchDateUtc } })
      .catch(() => {
        /* si el rollback falla, el próximo run lo verá como ya enviado; se prioriza no crashear */
      });
    return {
      outcome: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
