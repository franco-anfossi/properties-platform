import { describe, it, expect } from "vitest";
import { renderDigestEmail, type DigestEmailInput } from "./render";

const base: DigestEmailInput = {
  dispatchDate: "2026-07-19",
  timeZone: "America/Santiago",
  users: [
    {
      label: "ana@example.com",
      searches: [{ time: "10:00", query: "Providencia", resultCount: 48 }],
    },
    {
      label: "beto@example.com",
      searches: [
        { time: "11:30", query: "Ñuñoa", resultCount: 50 },
        { time: "12:00", query: "Las Condes", resultCount: null },
      ],
    },
  ],
};

describe("renderDigestEmail", () => {
  it("es UN solo correo con todos los usuarios y el total de búsquedas", () => {
    const { subject, html, text } = renderDigestEmail(base);
    expect(subject).toContain("2 usuarios");
    expect(subject).toContain("2026-07-19");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("beto@example.com");
    // total = 1 + 2 búsquedas
    expect(text).toContain("2 usuarios · 3 búsquedas");
    expect(text).toContain("Providencia");
    expect(text).toContain("Las Condes");
  });

  it("escapa HTML de las búsquedas (no inyecta markup)", () => {
    const { html } = renderDigestEmail({
      ...base,
      users: [
        {
          label: "x@e.com",
          searches: [{ time: "09:00", query: "<script>alert(1)</script>" }],
        },
      ],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("usa singular con un solo usuario/búsqueda", () => {
    const { subject } = renderDigestEmail({ ...base, users: [base.users[0]] });
    expect(subject).toContain("1 usuario");
    expect(subject).not.toContain("1 usuarios");
  });
});
