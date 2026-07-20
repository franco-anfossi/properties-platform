import nodemailer from "nodemailer";
import { getEmailConfig } from "./config";
import type { RenderedEmail } from "./render";

export interface SendResult {
  dryRun: boolean;
  id?: string;
}

// Envía el correo por SMTP (Gmail), o hace DRY-RUN (loguea) si no hay credenciales SMTP.
// En dry-run el flujo completo (incluida la idempotencia) se puede probar sin credenciales.
export async function sendEmail(msg: RenderedEmail): Promise<SendResult> {
  const config = getEmailConfig();

  if (config.to.length === 0) {
    throw new Error(
      "EMAIL_TO no está configurado: no hay destinatarios para el correo diario.",
    );
  }

  if (!config.smtp) {
    console.info(
      `[email:dry-run] (sin credenciales SMTP) NO se envía. ` +
        `to=${config.to.join(", ")} from=${config.from} subject="${msg.subject}"`,
    );
    console.info(`[email:dry-run] cuerpo (texto plano):\n${msg.text}`);
    return { dryRun: true };
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465, // 465 = SSL directo; 587 = STARTTLS
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  const info = await transport.sendMail({
    from: config.from,
    to: config.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  return { dryRun: false, id: info.messageId };
}
