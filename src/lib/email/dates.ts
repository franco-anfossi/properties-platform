// Helpers de fecha puros (sin dependencias externas), basados en Intl para resolver
// offset/DST de una zona horaria. Definen "el día" del envío en la TZ objetivo y lo
// traducen a instantes UTC para consultar `events`.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Descompone un instante en las partes de fecha/hora "de pared" en la zona indicada.
function partsInZone(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

// Offset de la zona respecto de UTC en milisegundos (local - UTC) para ese instante.
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - date.getTime();
}

export interface ZonedDayRange {
  dispatchDate: string; // "YYYY-MM-DD" (fecha calendario en la zona)
  dispatchDateUtc: Date; // medianoche UTC de esa fecha calendario (para columnas @db.Date)
  startUtc: Date; // instante UTC de las 00:00 locales
  endUtc: Date; // instante UTC de las 00:00 locales del día siguiente
  timeZone: string;
}

// Rango [inicio, fin) del día calendario que contiene `now` en `timeZone`, en UTC.
export function zonedDayRange(now: Date, timeZone: string): ZonedDayRange {
  const p = partsInZone(now, timeZone);
  const offset = zoneOffsetMs(now, timeZone);
  // 00:00 locales de hoy, expresado como instante UTC.
  const startUtc = new Date(
    Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0) - offset,
  );
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  const dispatchDate = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  // Guardamos la fecha como medianoche UTC para que el componente de fecha (@db.Date) coincida
  // exactamente con `dispatchDate`, sin corrimientos por zona.
  const dispatchDateUtc = new Date(`${dispatchDate}T00:00:00.000Z`);
  return { dispatchDate, dispatchDateUtc, startUtc, endUtc, timeZone };
}

// "HH:mm" de un instante en la zona indicada (para mostrar la hora de cada búsqueda).
export function formatTimeInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
