import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { register } from "@/lib/auth/actions";
import { AuthForm } from "../_components/auth-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/search");

  const action = register.bind(null, redirectTo);
  return <AuthForm mode="register" action={action} />;
}
