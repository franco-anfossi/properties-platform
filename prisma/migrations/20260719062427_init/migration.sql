-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LOGIN', 'SEARCH', 'SCRAPE', 'CLICK', 'FAVORITE_ADD', 'FAVORITE_REMOVE');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" TEXT,
    "currency" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_dispatches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dispatch_date" DATE NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_user_id_created_at_idx" ON "events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_external_id_key" ON "favorites"("user_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_dispatches_user_id_dispatch_date_key" ON "email_dispatches"("user_id", "dispatch_date");
