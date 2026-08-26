import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-fio py-8 text-[12px] text-fraco">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-serifa text-[13px] text-tinta2">
          Aliquo<span className="text-caneta">.</span>
        </span>
        <nav className="flex gap-4">
          <Link href="/termos" className="hover:text-tinta hover:underline">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:text-tinta hover:underline">
            Política de privacidade
          </Link>
        </nav>
      </div>
      <p className="mt-3 max-w-2xl leading-relaxed">
        As simulações são geradas a partir de bases públicas e não constituem classificação
        fiscal oficial nem parecer tributário.
      </p>
    </footer>
  );
}
