// Render puro del correo digest diario. Sin I/O: recibe datos ya normalizados y devuelve
// asunto + HTML + texto plano. Un solo correo por día con una sección por usuario. Testeable.

export interface SearchEntry {
  time: string; // "HH:mm" en la zona del envío
  query: string;
  comuna?: string | null;
  resultCount?: number | null;
}

export interface UserHistory {
  label: string; // email del usuario o "user <id-corto>"
  searches: SearchEntry[];
}

export interface DigestEmailInput {
  dispatchDate: string; // "YYYY-MM-DD"
  timeZone: string;
  users: UserHistory[]; // un bloque por usuario con actividad ese día
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

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

// Renderiza el digest diario: un correo con el historial de búsquedas de cada usuario.
export function renderDigestEmail(input: DigestEmailInput): RenderedEmail {
  const { dispatchDate, timeZone, users } = input;

  const totalSearches = users.reduce((n, u) => n + u.searches.length, 0);
  const subject = `Historial de búsquedas de la plataforma — ${dispatchDate} — ${plural(users.length, "usuario", "usuarios")}`;

  const userBlocks = users
    .map((user) => {
      const rows = user.searches
        .map((s) => {
          const desc = escapeHtml(describeSearch(s));
          const count =
            typeof s.resultCount === "number"
              ? plural(s.resultCount, "resultado", "resultados")
              : "—";
          return `
            <tr>
              <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#666;white-space:nowrap;font-variant-numeric:tabular-nums;">${escapeHtml(s.time)}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#111;">${desc}</td>
              <td style="padding:9px 12px;border-bottom:1px solid #eee;color:#666;white-space:nowrap;">${escapeHtml(count)}</td>
            </tr>`;
        })
        .join("");

      return `
        <tr>
          <td style="padding:20px 28px 0;">
            <p style="margin:0;font-size:14px;color:#111;"><strong>${escapeHtml(user.label)}</strong> <span style="color:#999;">· ${escapeHtml(plural(user.searches.length, "búsqueda", "búsquedas"))}</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              <thead>
                <tr>
                  <th align="left" style="padding:6px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Hora</th>
                  <th align="left" style="padding:6px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Búsqueda</th>
                  <th align="left" style="padding:6px 12px;border-bottom:2px solid #e6e8eb;color:#888;font-weight:600;">Resultados</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>`;
    })
    .join("");

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
                <p style="margin:8px 0 0;font-size:14px;color:#111;"><strong>Fecha:</strong> ${escapeHtml(dispatchDate)} <span style="color:#999;">(${escapeHtml(timeZone)})</span></p>
                <p style="margin:4px 0 0;font-size:14px;color:#111;"><strong>Total:</strong> ${escapeHtml(plural(users.length, "usuario", "usuarios"))} · ${escapeHtml(plural(totalSearches, "búsqueda", "búsquedas"))}</p>
              </td>
            </tr>
            ${userBlocks}
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0;font-size:12px;color:#999;">Resumen automático de la actividad de búsqueda en la plataforma.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: string[] = [
    `Pruff Propiedades — Historial de búsquedas del día`,
    `Fecha: ${dispatchDate} (${timeZone})`,
    `Total: ${plural(users.length, "usuario", "usuarios")} · ${plural(totalSearches, "búsqueda", "búsquedas")}`,
  ];
  for (const user of users) {
    textLines.push(
      ``,
      `${user.label} — ${plural(user.searches.length, "búsqueda", "búsquedas")}`,
    );
    for (const s of user.searches) {
      const count =
        typeof s.resultCount === "number"
          ? ` — ${plural(s.resultCount, "resultado", "resultados")}`
          : "";
      textLines.push(`  ${s.time}  ${describeSearch(s)}${count}`);
    }
  }
  textLines.push(
    ``,
    `Resumen automático de la actividad de búsqueda en la plataforma.`,
  );

  return { subject, html, text: textLines.join("\n") };
}
