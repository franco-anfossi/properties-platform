import Link from "next/link";

// Barra de navegación mínima (aditiva; no toca el layout global). Usada por /favorites e /history
// para poder navegar entre secciones y verificar en runtime. Si más adelante un shell global la
// reemplaza, se retira sin fricción.
const LINKS = [
  { href: "/search", label: "Buscar" },
  { href: "/favorites", label: "Favoritos" },
  { href: "/history", label: "Historial" },
];

export function AppNav({
  active,
}: {
  active?: "search" | "favorites" | "history";
}) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <Link
          href="/"
          className="mr-3 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Propiedades
        </Link>
        {LINKS.map((link) => {
          const isActive = active && link.href === `/${active}`;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
