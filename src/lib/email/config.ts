// Configuración del correo diario, derivada de env. Un único punto de verdad para
// `from`/`to`, la key de Resend, y si corremos en modo DRY-RUN (sin key real).

// Zona horaria con la que definimos "el día" (la plataforma es chilena).
export const EMAIL_TIME_ZONE = "America/Santiago";

// La key de Resend real tiene formato `re_<token largo alfanumérico>`. La plantilla del repo
// trae `re_REEMPLAZAR`, que pasa el prefijo pero no es real. Detectamos placeholders para caer
// a DRY-RUN sin bloquear el flujo (el envío real se activa solo con configurar la key).
function looksLikeRealResendKey(key: string | undefined): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  if (!/^re_[A-Za-z0-9]{20,}$/.test(trimmed)) return false;
  if (/reemplazar|replace|placeholder|xxx|your[-_]?key/i.test(trimmed))
    return false;
  return true;
}

function parseRecipients(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);
}

export interface EmailConfig {
  apiKey: string | undefined;
  from: string;
  to: string[];
  dryRun: boolean;
  timeZone: string;
}

// Se resuelve en cada lectura (no al import) para que los tests / distintos entornos puedan
// variar env sin reiniciar el módulo.
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  return {
    apiKey,
    from: process.env.EMAIL_FROM ?? "Pruff Propiedades <onboarding@resend.dev>",
    to: parseRecipients(process.env.EMAIL_TO),
    dryRun: !looksLikeRealResendKey(apiKey),
    timeZone: EMAIL_TIME_ZONE,
  };
}
