import { describe, expect, it, vi } from "vitest";

import { fetchSearchHtml, ScraperFetchError } from "../fetch";

const OK = () => new Response("<html>ok</html>", { status: 200 });

describe("fetchSearchHtml", () => {
  it("returns status and body on a successful response", async () => {
    const fetchImpl = vi.fn(async () => OK());
    const res = await fetchSearchHtml("https://example.test", { fetchImpl });
    expect(res.httpStatus).toBe(200);
    expect(res.html).toBe("<html>ok</html>");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends a browser User-Agent header", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => OK());
    await fetchSearchHtml("https://example.test", { fetchImpl });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("user-agent")).toMatch(/Mozilla\/5\.0/);
  });

  it("retries on network errors and then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new TypeError("network down");
      return OK();
    });
    const res = await fetchSearchHtml("https://example.test", {
      fetchImpl,
      retries: 2,
      backoffMs: 0,
    });
    expect(res.httpStatus).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("throws a typed ScraperFetchError after exhausting retries", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      fetchSearchHtml("https://example.test", {
        fetchImpl,
        retries: 2,
        backoffMs: 0,
      }),
    ).rejects.toBeInstanceOf(ScraperFetchError);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
  });

  it("retries on 5xx but not on 4xx", async () => {
    const server500 = vi.fn(async () => new Response("", { status: 503 }));
    await fetchSearchHtml("https://example.test", {
      fetchImpl: server500,
      retries: 1,
      backoffMs: 0,
    });
    expect(server500).toHaveBeenCalledTimes(2); // reintenta el 5xx

    const client403 = vi.fn(async () => new Response("", { status: 403 }));
    const res = await fetchSearchHtml("https://example.test", {
      fetchImpl: client403,
      retries: 2,
      backoffMs: 0,
    });
    expect(res.httpStatus).toBe(403);
    expect(client403).toHaveBeenCalledTimes(1); // no reintenta 4xx
  });
});
