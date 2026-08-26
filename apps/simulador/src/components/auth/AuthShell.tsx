import Link from "next/link";

/**
 * Moldura das telas de entrada.
 *
 * Mesma linguagem do painel: papel, régua e serifada — quem cria a conta já
 * vê o produto que vai usar, em vez de uma tela de marketing descolada.
 */
export function AuthShell({
  titulo,
  subtitulo,
  children,
  largura = "estreita",
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
  /** "larga" para telas com escolha de plano, que não cabem em max-w-sm. */
  largura?: "estreita" | "larga";
}) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className={`w-full ${largura === "larga" ? "max-w-md" : "max-w-sm"}`}>
        <Link href="/" className="mb-7 block text-center">
          <span className="font-serifa text-[24px] font-semibold text-tinta">
            Aliquo<span className="text-caneta">.</span>
          </span>
          <p className="mt-1 text-rotulo font-semibold uppercase text-fraco">
            Custo de importação
          </p>
        </Link>

        <div className="painel">
          <div className="border-b border-fio px-6 py-4">
            <h1 className="font-serifa text-[20px] font-semibold text-tinta">{titulo}</h1>
            <p className="mt-1 text-[13px] text-tinta2">{subtitulo}</p>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-fraco">
          Base oficial da Receita Federal · alíquotas da TEC e da TIPI vigentes
        </p>
      </div>
    </div>
  );
}
