import { cn } from "@/lib/cn";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  label?: string;
}

/** Spinner accesible para estados de carga. */
export function Spinner({
  className,
  label = "Cargando",
  ...props
}: SpinnerProps) {
  return (
    <svg
      className={cn("size-5 animate-spin text-current", className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      {...props}
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
