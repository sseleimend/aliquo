/**
 * Cabeçalho de página do painel.
 *
 * Título em serifada, subtítulo curto e ações à direita, fechado por uma
 * régua — a mesma estrutura de abertura de um documento.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-fio pb-4">
      <div className="min-w-0">
        <h1 className="font-serifa text-[26px] font-semibold leading-tight text-tinta">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 max-w-2xl text-[13.5px] text-tinta2">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
