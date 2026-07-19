import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logEvent, EventType } from "@/lib/events";
import { getFavorites } from "@/lib/favorites";

// API de favoritos (estado propio). El botón cliente decide el método según su estado:
//   POST   → agrega (upsert del snapshot mínimo) + logEvent(FAVORITE_ADD)
//   DELETE → quita + logEvent(FAVORITE_REMOVE)
//   GET    → lista los favoritos del usuario (JSON)
// Sin sesión → 401. Todo pasa por la trazabilidad (events).

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const favorites = await getFavorites(userId);
  return NextResponse.json({ favorites });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { externalId, url, title, price, currency, imageUrl } = (body ??
    {}) as Record<string, unknown>;

  if (
    typeof externalId !== "string" ||
    typeof url !== "string" ||
    typeof title !== "string" ||
    !externalId ||
    !url ||
    !title
  ) {
    return NextResponse.json(
      { error: "externalId, url and title are required" },
      { status: 400 },
    );
  }

  const snapshot = {
    url,
    title,
    price: typeof price === "string" ? price : null,
    currency: typeof currency === "string" ? currency : null,
    imageUrl: typeof imageUrl === "string" ? imageUrl : null,
  };

  // ¿Ya existía? Solo registramos FAVORITE_ADD cuando es un favorito nuevo (traza limpia);
  // el re-marcado solo refresca el snapshot.
  const existing = await prisma.favorite.findUnique({
    where: { userId_externalId: { userId, externalId } },
    select: { id: true },
  });

  const favorite = await prisma.favorite.upsert({
    where: { userId_externalId: { userId, externalId } },
    create: { userId, externalId, ...snapshot },
    update: snapshot,
  });

  if (!existing) {
    await logEvent({
      userId,
      type: EventType.FAVORITE_ADD,
      payload: { externalId, url, title, price: snapshot.price },
    });
  }

  return NextResponse.json({ favorited: true, favorite });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // external_id puede venir en el body o como ?externalId= (para links/beacons simples).
  let externalId: unknown;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    externalId = body?.externalId;
  } catch {
    externalId = new URL(request.url).searchParams.get("externalId");
  }

  if (typeof externalId !== "string" || !externalId) {
    return NextResponse.json(
      { error: "externalId is required" },
      { status: 400 },
    );
  }

  const { count } = await prisma.favorite.deleteMany({
    where: { userId, externalId },
  });

  if (count > 0) {
    await logEvent({
      userId,
      type: EventType.FAVORITE_REMOVE,
      payload: { externalId },
    });
  }

  return NextResponse.json({ favorited: false, removed: count });
}
