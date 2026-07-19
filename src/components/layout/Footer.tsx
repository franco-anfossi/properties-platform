import { Logo } from "./Logo";

/** Footer global. Informativo y sobrio. */
export function Footer() {
  return (
    <footer className="border-border bg-card/40 mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo />
          <p>Catálogo de propiedades en vivo desde Portal Inmobiliario.</p>
        </div>
        <p className="text-xs">
          Prueba de ingreso Pruff · Datos obtenidos en vivo, no almacenados.
        </p>
      </div>
    </footer>
  );
}
