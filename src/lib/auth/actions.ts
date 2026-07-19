"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventType, logEvent } from "@/lib/events";

// Estado que las páginas de auth muestran (error de credenciales o null si todo ok).
export type AuthState = { error: string } | null;

const DEFAULT_REDIRECT = "/search";

// Solo permitimos redirigir a rutas internas ("/algo"), nunca a otro host (open-redirect).
function safeRedirectTo(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return DEFAULT_REDIRECT;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

// Traduce los mensajes de GoTrue (inglés) a algo claro para el usuario.
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ese email ya está registrado. Inicia sesión.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("email address") && m.includes("invalid"))
    return "El email no es válido.";
  if (m.includes("rate limit"))
    return "Demasiados intentos. Espera un momento y reintenta.";
  return message || "Ocurrió un error. Intenta de nuevo.";
}

// La trazabilidad nunca debe tumbar el auth: si logEvent falla, lo logueamos y seguimos.
async function safeLogLogin(userId: string | undefined, email: string) {
  if (!userId) return;
  try {
    await logEvent({
      userId,
      type: EventType.LOGIN,
      payload: { email, method: "password" },
    });
  } catch (err) {
    console.error("logEvent(LOGIN) falló:", err);
  }
}

// Firma pensada para `useActionState` tras `login.bind(null, redirectTo)`:
// el cliente la invoca como (prevState, formData).
export async function login(
  redirectTo: string | undefined,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Ingresa tu email y contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: mapAuthError(error.message) };

  await safeLogLogin(data.user?.id, email);
  redirect(safeRedirectTo(redirectTo));
}

export async function register(
  redirectTo: string | undefined,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Ingresa tu email y contraseña." };
  if (password.length < 6)
    return { error: "La contraseña debe tener al menos 6 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: mapAuthError(error.message) };

  // Con la confirmación de email desactivada (mailer_autoconfirm=true), signUp
  // deja sesión iniciada de inmediato. Si por config eso cambiara, avisamos.
  if (!data.session) {
    return {
      error:
        "Cuenta creada, pero falta confirmar el email antes de iniciar sesión.",
    };
  }

  await safeLogLogin(data.user?.id, email);
  redirect(safeRedirectTo(redirectTo));
}

// Server Action de logout: limpia la sesión y vuelve a /login.
// El stream de UI shell la envolverá en el header con <form action={logout}>.
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
