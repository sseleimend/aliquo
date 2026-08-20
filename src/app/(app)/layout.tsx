import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BarraLateral } from "@/components/app/BarraLateral";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <BarraLateral email={session.user.email} />
      {/* A rolagem vive no conteúdo, não na página: a lateral fica fixa e as
          tabelas largas do resultado rolam sem levar a navegação junto. */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
