import Link from "next/link";

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
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold text-accent-text">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-white">A</span>
          Aliquo
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
          <p className="mt-1 text-sm text-ink2">{subtitulo}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
