import { prisma } from "@/lib/prisma";
import { EventType, Prisma } from "@/generated/prisma/client";

export { EventType };

// Único helper de trazabilidad. TODO evento del recorrido pasa por aquí:
// login → búsqueda → scraping → click → favorito.
// Reconstrucción con una sola query:
//   SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC
export async function logEvent(params: {
  userId: string;
  type: EventType;
  sessionId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  return prisma.event.create({
    data: {
      userId: params.userId,
      type: params.type,
      sessionId: params.sessionId ?? null,
      payload: params.payload ?? {},
    },
  });
}
