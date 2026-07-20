// Configuración del correo diario, derivada de env. Un único punto de verdad para
// `from`/`to`, las credenciales SMTP, y si corremos en modo DRY-RUN (sin credenciales).
//
// Usamos SMTP (Gmail) en vez de Resend: Resend no envía a destinatarios arbitrarios sin un
// dominio verificado, mientras que SMTP con una cuenta Gmail (app password) puede enviar a
// cualquier dirección sin dominio propio. Ver DECISIONS.md.

// Zona horaria con la que definimos "el día" (la plataforma es chilena).
export const EMAIL_TIME_ZONE = "America/Santiago";

export interface SmtpCreds {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Detecta si hay credenciales SMTP reales. Sin ellas caemos a DRY-RUN (se loguea el correo en
// vez de enviarlo), para que el flujo completo (incluida la idempotencia) se pueda probar.
function readSmtpCreds(): SmtpCreds | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  if (/reemplazar|placeholder|xxxx|your[-_]?/i.test(pass)) return null;

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    user,
    pass,
  };
}

function parseRecipients(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean);
}

export interface EmailConfig {
  from: string;
  to: string[];
  smtp: SmtpCreds | null;
  dryRun: boolean;
  timeZone: string;
}

// Se resuelve en cada lectura (no al import) para que los tests / distintos entornos puedan
// variar env sin reiniciar el módulo.
export function getEmailConfig(): EmailConfig {
  const smtp = readSmtpCreds();
  const defaultFrom = smtp
    ? `Pruff Propiedades <${smtp.user}>`
    : "Pruff Propiedades <no-reply@example.com>";

  return {
    // Gmail reescribe el remitente a la cuenta autenticada; mantenemos el display name.
    from: process.env.EMAIL_FROM?.trim() || defaultFrom,
    to: parseRecipients(process.env.EMAIL_TO),
    smtp,
    dryRun: smtp === null,
    timeZone: EMAIL_TIME_ZONE,
  };
}
