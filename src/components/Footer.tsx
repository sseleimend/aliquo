import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-8 text-center text-xs text-muted">
      <p>Aliquo — simulador de custo de importação</p>
      <p className="mt-1">
        <Link href="/termos" className="hover:underline">
          Termos de uso
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="hover:underline">
          Política de privacidade
        </Link>
      </p>
      <p className="mx-auto mt-2 max-w-2xl">
        As simulações são geradas a partir de bases públicas e não constituem classificação
        fiscal oficial nem parecer tributário.
      </p>
    </footer>
  );
}
