import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { searchProperties, SOURCE } from "../portal-inmobiliario";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

function respondWith(html: string, status = 200): typeof fetch {
  return (async () => new Response(html, { status })) as typeof fetch;
}

describe("searchProperties", () => {
  it("returns status 'ok' with normalized results on a populated page", async () => {
    const outcome = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: respondWith(fixture("search-las-condes.html")) },
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.source).toBe(SOURCE);
    expect(outcome.httpStatus).toBe(200);
    expect(outcome.results).toHaveLength(6);
    expect(outcome.results[0].title).toBe("Las Condes 7520");
    expect(typeof outcome.durationMs).toBe("number");
  });

  it("returns status 'empty' when the page has no listings", async () => {
    const outcome = await searchProperties(
      { query: "Comuna Inexistente" },
      { fetchImpl: respondWith(fixture("empty-results.html")) },
    );
    expect(outcome.status).toBe("empty");
    expect(outcome.results).toEqual([]);
  });

  it("returns status 'blocked' on HTTP 403/429", async () => {
    const blocked = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: respondWith("", 403) },
    );
    expect(blocked.status).toBe("blocked");
    expect(blocked.httpStatus).toBe(403);

    const rateLimited = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: respondWith("", 429) },
    );
    expect(rateLimited.status).toBe("blocked");
  });

  it("returns status 'error' (never throws) on a network failure", async () => {
    const failing = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    const outcome = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: failing, retries: 0 },
    );
    expect(outcome.status).toBe("error");
    expect(outcome.results).toEqual([]);
    expect(outcome.error).toBeTruthy();
  });

  it("returns status 'error' on a 5xx response", async () => {
    const outcome = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: respondWith("", 500), retries: 0 },
    );
    expect(outcome.status).toBe("error");
    expect(outcome.httpStatus).toBe(500);
  });

  it("returns status 'error' (never throws) when the HTML shape changed", async () => {
    // Página con el marcador polycard pero JSON roto → 0 propiedades pese a haber bloques.
    const outcome = await searchProperties(
      { query: "Las Condes" },
      { fetchImpl: respondWith(fixture("malformed.html")) },
    );
    expect(outcome.status).toBe("error");
    expect(outcome.results).toEqual([]);
  });
});
