import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Las migraciones usan la conexión DIRECTA de Supabase (5432, no el pooler).
  datasource: {
    url: env("DIRECT_URL"),
  },
});
