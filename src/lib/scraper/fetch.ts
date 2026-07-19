// Capa de red del scraper: un fetch con User-Agent de navegador, timeout por request y
// reintentos acotados. Aísla la robustez de red del parsing y de la orquestación.

export type FetchErrorKind = "timeout" | "network";

/** Error tipado de red. Distinto de un HTTP 4xx/5xx (que sí devuelve respuesta). */
export class ScraperFetchError extends Error {
  readonly kind: FetchErrorKind;

  constructor(kind: FetchErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScraperFetchError";
    this.kind = kind;
  }
}

// UA de navegador real: el portal server-renderiza igual, pero evitamos heurísticas anti-bot.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface FetchSearchHtmlOptions {
  fetchImpl?: typeof fetch; // inyectable para tests
  timeoutMs?: number;
  retries?: number; // reintentos además del primer intento
  backoffMs?: number; // espera base entre reintentos (lineal)
}

export interface FetchSearchHtmlResult {
  httpStatus: number;
  html: string;
}

const DEFAULTS = {
  timeoutMs: 15_000,
  retries: 2,
  backoffMs: 300,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<FetchSearchHtmlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-CL,es;q=0.9",
      },
    });
    const html = await response.text();
    return { httpStatus: response.status, html };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ScraperFetchError("timeout", `Timeout tras ${timeoutMs}ms`, {
        cause: err,
      });
    }
    throw new ScraperFetchError("network", `Fallo de red: ${String(err)}`, {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hace GET del HTML de una página de resultados. Reintenta ante fallos de red, timeout y 5xx
 * (backoff lineal). No reintenta 4xx: son respuestas deterministas (bloqueo/no encontrado) que
 * el orquestador clasifica. Lanza `ScraperFetchError` sólo si agota los reintentos por red/timeout.
 */
export async function fetchSearchHtml(
  url: string,
  options: FetchSearchHtmlOptions = {},
): Promise<FetchSearchHtmlResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;
  const backoffMs = options.backoffMs ?? DEFAULTS.backoffMs;

  let lastError: ScraperFetchError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0 && backoffMs > 0) await sleep(backoffMs * attempt);
    try {
      const result = await fetchOnce(url, fetchImpl, timeoutMs);
      if (result.httpStatus >= 500 && attempt < retries) continue; // reintenta 5xx
      return result;
    } catch (err) {
      if (!(err instanceof ScraperFetchError)) throw err;
      lastError = err;
      // seguirá al siguiente intento; si era el último, se lanza abajo
    }
  }
  throw (
    lastError ?? new ScraperFetchError("network", "Fallo de red desconocido")
  );
}
