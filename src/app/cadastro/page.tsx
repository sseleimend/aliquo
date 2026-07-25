import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function CadastroPage() {
  const session = await auth();
  if (session?.user) redirect("/simulador");

  return (
    <AuthShell titulo="Criar conta" subtitulo="Comece a simular custos de importação em minutos.">
      <RegisterForm />
    </AuthShell>
  );
}
