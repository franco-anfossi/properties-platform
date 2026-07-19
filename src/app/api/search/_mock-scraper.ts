// ─────────────────────────────────────────────────────────────────────────────
// TEMP-MOCK — Mock local del scraper mientras `src/lib/scraper` es un stub Parte-0.
//
// El módulo real (`searchProperties`) todavía lanza. Para poder desarrollar y
// verificar este stream de punta a punta, `scraper.ts` cae a este mock cuando el
// real no está disponible. Cuando el scraper real se mergee, BORRAR este archivo
// y quitar el fallback en `scraper.ts` (buscar el marcador `TEMP-MOCK`).
//
// No persiste nada; imita la forma exacta de `SearchOutcome` del contrato real.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PropertyResult,
  SearchOutcome,
  SearchParams,
} from "@/lib/scraper/types";

const FIXTURES: PropertyResult[] = [
  {
    externalId: "MLC-1768620109",
    title: "Departamento 2D/2B con vista, Providencia",
    price: "UF 4.850",
    currency: "UF",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_2X_700001-MLC.jpg",
    url: "https://www.portalinmobiliario.com/MLC-1768620109-departamento-providencia",
  },
  {
    externalId: "MLC-1768620110",
    title: "Casa 3D/3B con patio, Ñuñoa",
    price: "UF 9.200",
    currency: "UF",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_2X_700002-MLC.jpg",
    url: "https://www.portalinmobiliario.com/MLC-1768620110-casa-nunoa",
  },
  {
    externalId: "MLC-1768620111",
    title: "Studio amoblado, Santiago Centro",
    price: "$85.000.000",
    currency: "CLP",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_2X_700003-MLC.jpg",
    url: "https://www.portalinmobiliario.com/MLC-1768620111-studio-santiago",
  },
  {
    externalId: "MLC-1768620112",
    title: "Departamento 1D/1B nuevo, Las Condes",
    price: "UF 3.400",
    currency: "UF",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_2X_700004-MLC.jpg",
    url: "https://www.portalinmobiliario.com/MLC-1768620112-departamento-las-condes",
  },
  {
    externalId: "MLC-1768620113",
    title: "Oficina 45m², La Reina",
    price: null, // el portal a veces no expone precio: la UI debe tolerarlo
    currency: null,
    imageUrl: null, // imagen ausente: la card cae a un placeholder
    url: "https://www.portalinmobiliario.com/MLC-1768620113-oficina-la-reina",
  },
  {
    externalId: "MLC-1768620114",
    title: "Casa mediterránea 4D/4B, Vitacura",
    price: "UF 21.500",
    currency: "UF",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_2X_700006-MLC.jpg",
    url: "https://www.portalinmobiliario.com/MLC-1768620114-casa-vitacura",
  },
];

// Simula la latencia real del portal (~1 s) sin frenar demasiado el dev loop.
const MOCK_LATENCY_MS = 600;

export async function mockSearchOutcome(
  params: SearchParams,
): Promise<SearchOutcome> {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));

  // Query con "zzz" → simula un resultado vacío (para probar ese estado en la UI).
  const isEmpty = params.query.toLowerCase().includes("zzz");
  const results = isEmpty ? [] : FIXTURES;

  return {
    status: isEmpty ? "empty" : "ok",
    source: "portal-inmobiliario (TEMP-MOCK)",
    results,
    durationMs: Date.now() - start,
    httpStatus: 200,
  };
}
