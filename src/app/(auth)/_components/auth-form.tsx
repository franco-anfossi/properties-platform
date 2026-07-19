"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/lib/auth/actions";

// Server Action ya "bindeada" con redirectTo → firma que espera useActionState.
type AuthAction = (prev: AuthState, formData: FormData) => Promise<AuthState>;

type Props = {
  mode: "login" | "register";
  action: AuthAction;
};

const COPY = {
  login: {
    title: "Iniciar sesión",
    subtitle: "Ingresa para buscar propiedades.",
    submit: "Entrar",
    pending: "Entrando…",
    altText: "¿No tienes cuenta?",
    altHref: "/register",
    altLink: "Crear una",
    autoComplete: "current-password",
  },
  register: {
    title: "Crear cuenta",
    subtitle: "Regístrate para empezar a buscar.",
    submit: "Registrarme",
    pending: "Creando…",
    altText: "¿Ya tienes cuenta?",
    altHref: "/login",
    altLink: "Iniciar sesión",
    autoComplete: "new-password",
  },
} as const;

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    action,
    null,
  );
  const copy = COPY[mode];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {copy.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {copy.subtitle}
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contraseña
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={copy.autoComplete}
            placeholder="••••••••"
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />
        </label>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? copy.pending : copy.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {copy.altText}{" "}
        <Link
          href={copy.altHref}
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          {copy.altLink}
        </Link>
      </p>
    </div>
  );
}
