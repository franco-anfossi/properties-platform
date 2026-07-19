import { cn } from "@/lib/cn";

/**
 * Envoltorio de contenido de página: ancho máximo y padding consistentes.
 * Lo usan las páginas de los distintos streams para alinear con el shell.
 */
export function PageContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
