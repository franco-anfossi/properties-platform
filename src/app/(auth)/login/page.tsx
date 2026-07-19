import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { login } from "@/lib/auth/actions";
import { AuthForm } from "../_components/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  // Si ya hay sesión, no tiene sentido mostrar el login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/search");

  const action = login.bind(null, redirectTo);
  return <AuthForm mode="login" action={action} />;
}
