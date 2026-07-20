// Render puro del correo de historial. Sin I/O: recibe datos ya normalizados y devuelve
// asunto + HTML + texto plano. Testeable con fixtures.

export interface SearchEntry {
  time: string; // "HH:mm" en la zona del envío
  query: string;
  comuna?: string | null;
  resultCount?: number | null;
}

export interface HistoryEmailInput {
  userLabel: string; // email del usuario o "user <id-corto>"
  dispatchDate: string; // "YYYY-MM-DD"
  timeZone: string;
  searches: SearchEntry[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function describeSearch(entry: SearchEntry): string {
  const parts = [entry.query];
  if (entry.comuna && entry.comuna !== entry.query) parts.push(entry.comuna);
  return parts.filter(Boolean).join(" · ");
}

export function renderHistoryEmail(input: HistoryEmailInput): RenderedEmail {
  const { userLabel, dispatchDate, timeZone, searches } = input;

  const subject = `Historial de búsquedas — ${userLabel} — ${dispatchDate}`;

  const rows = searches
    .map((s) => {
      const desc = escapeHtml(describeSearch(s));
      const count =
        typeof s.resultCount === "number"
          ? `${s.resultCount} resultado${s.resultCount === 1 ? "" : "s"}`
          : "—";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapeHtml(s.time)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#111;">${desc}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#666;white-space:nowrap;">${escapeHtml(count)}</td>
        </tr>`;
    })
    .join("");

  const countLine = `${searches.length} búsqueda${searches.length === 1 ? "" : "s"}`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8eb;">
            <tr>
              <td style="padding:24px 28px 8px;">
                <h1 style="margin:0;font-size:18px;color:#111;">Pruff Propiedades</h1>
                <p style="margin:6px 0 0;font-size:14px;color:#666;">Historial de búsquedas del día</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;">
                <p style="margin:0;font-size:14px;color:#111;"><strong>Usuario:</strong> ${escapeHtml(userLabel)}</p>
                <p style="margin:4px 0 0;font-size:14px;color:#111;"><strong>Fecha:</strong> ${escapeHtml(dispatchDate)} <span style="color:#999;">(${escapeHtml(timeZone)})</span></p>
                <p style="margin:4px 0 16px;font-size:14px;color:#111;"><strong>Total:</strong> ${escapeHtml(countLine)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:8px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Hora</th>
                      <th align="left" style="padding:8px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Búsqueda</th>
                      <th align="left" style="padding:8px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Resultados</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <p style="margin:0;font-size:12px;color:#999;">Resumen automático de tu actividad de búsqueda en la plataforma.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    `Pruff Propiedades — Historial de búsquedas del día`,
    ``,
    `Usuario: ${userLabel}`,
    `Fecha: ${dispatchDate} (${timeZone})`,
    `Total: ${countLine}`,
    ``,
    ...searches.map((s) => {
      const count =
        typeof s.resultCount === "number"
          ? ` — ${s.resultCount} resultado(s)`
          : "";
      return `  ${s.time}  ${describeSearch(s)}${count}`;
    }),
    ``,
    `Resumen automático de tu actividad de búsqueda en la plataforma.`,
  ];

  return { subject, html, text: textLines.join("\n") };
}
