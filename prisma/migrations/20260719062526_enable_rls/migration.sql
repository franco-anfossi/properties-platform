-- Habilita Row Level Security en nuestras tablas del schema public.
-- La app accede SOLO server-side vía Prisma con el rol `postgres` (BYPASSRLS),
-- así que RLS + sin políticas = tablas inaccesibles desde la Data API (anon/authenticated)
-- sin afectar el acceso de la aplicación. Defensa en profundidad.

ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_dispatches" ENABLE ROW LEVEL SECURITY;