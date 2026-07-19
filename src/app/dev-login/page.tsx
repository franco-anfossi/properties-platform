"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TEMP-DEV — Login de prueba SOLO para desarrollo local.
//
// El stream de auth aún no aterriza el `/login` real. Esta página existe para poder
// verificar el flujo protegido (búsqueda) de punta a punta en runtime. Usa el cliente
// browser de Supabase (`signInWithPassword`), que sincroniza la sesión vía cookies
// @supabase/ssr que el middleware/servidor leen.
//
// Se auto-bloquea fuera de desarrollo. Follow-up: BORRAR este archivo cuando exista
// el `/login` real (buscar el marcador `TEMP-DEV`).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("search-tester@example.com");
  const [password, setPassword] = useState("test-password-123");
  const [status, setStatus] = useState<string | null>(null);

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
        No disponible.
      </main>
    );
  }

  async function handle(action: "signin" | "signup") {
    setStatus("Procesando…");
    const supabase = createClient();
    const fn =
      action === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) {
      setStatus(`Error: ${error.message}`);
      return;
    }
    setStatus("OK — redirigiendo a /search…");
    router.push("/search");
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-20">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Login de prueba (dev)
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Temporal — reemplazado por el <code>/login</code> del stream de auth.
        </p>
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.14] dark:bg-zinc-900"
        placeholder="email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.14] dark:bg-zinc-900"
        placeholder="password"
      />
      <div className="flex gap-2">
        <button
          onClick={() => handle("signin")}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => handle("signup")}
          className="flex-1 rounded-lg border border-black/[.12] px-4 py-2 text-sm font-semibold hover:bg-black/[.04] dark:border-white/[.14] dark:hover:bg-white/[.06]"
        >
          Crear usuario
        </button>
      </div>
      {status && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{status}</p>
      )}
    </main>
  );
}
