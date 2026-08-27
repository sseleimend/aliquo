import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/simulador";

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <AuthShell titulo="Entrar" subtitulo="Acesse o simulador tributário do Aliquo.">
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
