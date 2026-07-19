import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  /** Ícono decorativo (ej. `<SearchIcon />`). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Acción opcional (ej. un `<Button>` o `<Link>`). */
  action?: React.ReactNode;
  className?: string;
}

/** Estado vacío reutilizable (sin resultados, sin favoritos, sin historial…). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-card/50 flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-full [&_svg]:size-7">
          {icon}
        </div>
      )}
      <h3 className="text-foreground text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
