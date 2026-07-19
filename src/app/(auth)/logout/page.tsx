import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";

// Superficie mínima de logout. El stream de UI shell moverá esto al header;
// aquí sirve como endpoint usable y para verificar el flujo de cierre de sesión.
export default async function LogoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/15 dark:bg-zinc-950">
      {user ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Cerrar sesión
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sesión iniciada como{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {user.email}
            </span>
          </p>
          <form action={logout} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Cerrar sesión
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            No hay sesión activa
          </h1>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            >
              Iniciar sesión
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
