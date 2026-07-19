import { cn } from "@/lib/cn";
import { AlertTriangleIcon } from "@/components/icons";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Acción de recuperación (ej. un botón "Reintentar"). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado de error visual. Pensado para la degradación elegante del scraping
 * (portal caído / bloqueado / respuesta inesperada): mensaje claro + retry.
 */
export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos completar la operación. Por favor, intentá de nuevo en unos momentos.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-[var(--radius-card)] border px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive mb-4 flex size-14 items-center justify-center rounded-full">
        <AlertTriangleIcon className="size-7" />
      </div>
      <h3 className="text-foreground text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
