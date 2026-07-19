import { Resend } from "resend";
import { getEmailConfig } from "./config";
import type { RenderedEmail } from "./render";

export interface SendResult {
  dryRun: boolean;
  id?: string;
}

// Envía el correo con Resend, o hace DRY-RUN (loguea) si no hay una key real configurada.
// En dry-run el flujo completo (incluida la idempotencia) se puede probar sin la key.
export async function sendEmail(msg: RenderedEmail): Promise<SendResult> {
  const config = getEmailConfig();

  if (config.to.length === 0) {
    throw new Error(
      "EMAIL_TO no está configurado: no hay destinatarios para el correo diario.",
    );
  }

  if (config.dryRun) {
    console.info(
      `[email:dry-run] (RESEND_API_KEY placeholder/ausente) NO se envía. ` +
        `to=${config.to.join(", ")} from=${config.from} subject="${msg.subject}"`,
    );
    console.info(`[email:dry-run] cuerpo (texto plano):\n${msg.text}`);
    return { dryRun: true };
  }

  const resend = new Resend(config.apiKey);
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: config.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  if (error) {
    throw new Error(
      `Resend rechazó el envío: ${error.message ?? JSON.stringify(error)}`,
    );
  }

  return { dryRun: false, id: data?.id };
}
