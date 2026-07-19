import { HomeIcon, SearchIcon, HeartIcon, ClockIcon } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  /** Si true, el link está activo solo con match exacto de ruta. */
  exact?: boolean;
}

/** Navegación principal de la plataforma. Fuente única para header y footer. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: HomeIcon, exact: true },
  { href: "/search", label: "Buscar", icon: SearchIcon },
  { href: "/favorites", label: "Favoritos", icon: HeartIcon },
  { href: "/history", label: "Historial", icon: ClockIcon },
];
