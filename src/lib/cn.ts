import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases condicionalmente (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge), para que un `className` pasado por props pueda
 * sobrescribir los estilos por defecto de un componente sin pelearse.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
