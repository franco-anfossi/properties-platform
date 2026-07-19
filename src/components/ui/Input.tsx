import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensaje de error; cambia el borde a `destructive` y setea aria-invalid. */
  error?: string;
  /** Texto de ayuda bajo el input (se oculta si hay `error`). */
  hint?: string;
  /** Elemento decorativo a la izquierda (ej. un ícono de lupa). */
  leadingIcon?: React.ReactNode;
}

/**
 * Input de texto del design system, con label, hint y estado de error
 * accesibles. Reenvía `ref` para integrarse con librerías de formularios.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, label, error, hint, leadingIcon, id, ...props },
    ref,
  ) {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-foreground text-sm font-medium"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "bg-card text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              leadingIcon && "pl-9",
              error ? "border-destructive" : "border-input",
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-destructive text-xs">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
