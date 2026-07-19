// Verificación end-to-end de la trazabilidad, sin auth ni HTTP.
//
// Siembra un recorrido completo (login → búsqueda → scraping → click → favorito) para un userId
// sintético (la tabla `events` no tiene FK cross-schema, así que un UUID inventado es válido),
// lo reconstruye con la query única y comprueba invariantes. Al final borra lo sembrado.
//
// Correr:  npm run verify:traceability

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logEvent, EventType } from "@/lib/events";
import {
  getUserTimeline,
  searchPayload,
  scrapePayload,
  clickPayload,
  favoritePayload,
} from "@/lib/traceability";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
  } else {
    console.error(`  ❌ ${msg}`);
    failures++;
  }
}

async function main() {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const searchId = randomUUID();
  const externalId = `MLC-${randomUUID().slice(0, 8)}`;
  const url = `https://www.portalinmobiliario.com/${externalId}`;

  console.log(`\n▶ Sembrando recorrido para userId=${userId}\n`);

  await logEvent({
    userId,
    sessionId,
    type: EventType.LOGIN,
    payload: { method: "password", email: "verify@pruff.com" },
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.SEARCH,
    payload: searchPayload({ query: "Ñuñoa", comuna: "Ñuñoa", searchId }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.SCRAPE,
    payload: scrapePayload({
      source: "portal-inmobiliario",
      status: "ok",
      resultCount: 28,
      durationMs: 940,
      httpStatus: 200,
      searchId,
    }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.CLICK,
    payload: clickPayload({ externalId, url, title: "Casa 3D/2B, Ñuñoa" }),
  });
  await logEvent({
    userId,
    sessionId,
    type: EventType.FAVORITE_ADD,
    payload: favoritePayload({
      externalId,
      url,
      title: "Casa 3D/2B, Ñuñoa",
      price: "UF 8.200",
    }),
  });

  // --- La query única reconstruye el recorrido ---
  const timeline = await getUserTimeline(userId);

  console.log("\n▶ Timeline reconstruido:\n");
  console.log(`  query: ${timeline.query}`);
  for (const session of timeline.sessions) {
    console.log(`\n  sesión ${session.sessionId}`);
    for (const s of session.steps) {
      const corr = s.correlationKey ? `  ↳ ${s.correlationKey}` : "";
      console.log(`    ${s.icon} [${s.type}] ${s.label}${corr}`);
    }
  }

  console.log("\n▶ Invariantes:\n");
  const steps = timeline.sessions.flatMap((s) => s.steps);
  assert(timeline.sessions.length === 1, "un solo recorrido (una sesión)");
  assert(steps.length === 5, "exactamente 5 pasos");
  assert(
    JSON.stringify(steps.map((s) => s.type)) ===
      JSON.stringify([
        EventType.LOGIN,
        EventType.SEARCH,
        EventType.SCRAPE,
        EventType.CLICK,
        EventType.FAVORITE_ADD,
      ]),
    "orden login → search → scrape → click → favorite",
  );

  const search = steps.find((s) => s.type === EventType.SEARCH)!;
  const scrape = steps.find((s) => s.type === EventType.SCRAPE)!;
  const click = steps.find((s) => s.type === EventType.CLICK)!;
  const fav = steps.find((s) => s.type === EventType.FAVORITE_ADD)!;
  assert(
    search.correlationKey === searchId && scrape.correlationKey === searchId,
    "SEARCH ↔ SCRAPE enlazados por searchId",
  );
  assert(
    click.correlationKey === externalId && fav.correlationKey === externalId,
    "CLICK ↔ FAVORITE_ADD enlazados por externalId",
  );

  // --- Limpieza: no dejar basura en la DB compartida ---
  const { count } = await prisma.event.deleteMany({ where: { userId } });
  console.log(`\n▶ Limpieza: ${count} eventos borrados.\n`);

  await prisma.$disconnect();

  if (failures > 0) {
    console.error(`✖ ${failures} aserción(es) fallaron.`);
    process.exit(1);
  }
  console.log(
    "✔ Trazabilidad verificada: una sola query reconstruye el recorrido.",
  );
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
