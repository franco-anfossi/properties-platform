-- El correo diario pasa de "uno por usuario por día" a un único digest por día:
-- email_dispatches ahora se identifica por dispatch_date (único) y guarda user_count (auditoría).

-- DropIndex
DROP INDEX "email_dispatches_user_id_dispatch_date_key";

-- AlterTable
ALTER TABLE "email_dispatches" DROP COLUMN "user_id",
ADD COLUMN     "user_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "email_dispatches_dispatch_date_key" ON "email_dispatches"("dispatch_date");
