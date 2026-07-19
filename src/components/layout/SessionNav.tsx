import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { LogOutIcon } from "@/components/icons";

/**
 * Área de sesión del header (Server Component).
 *
 * Hace un best-effort read del usuario con el helper existente de Supabase.
 * Va envuelto en try/catch: si no hay sesión o el entorno de auth aún no está
 * listo, cae a estado "desconectado". NO implementa auth — solo refleja estado
 * para que el shell se vea correcto. El stream de auth es dueño de `/login`,
 * `/logout` y de la sesión real.
 */
async function getUserEmail(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export async function SessionNav({ className }: { className?: string }) {
  const email = await getUserEmail();

  if (!email) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/login">Comenzar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="text-muted-foreground hidden max-w-[14ch] truncate text-sm md:inline"
        title={email}
      >
        {email}
      </span>
      <Button asChild variant="outline" size="sm">
        <Link href="/logout">
          <LogOutIcon className="size-4" />
          <span>Salir</span>
        </Link>
      </Button>
    </div>
  );
}
