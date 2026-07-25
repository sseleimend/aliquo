"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/simulador", label: "Simulador" },
  { href: "/conta/despachantes", label: "Despachantes & custos" },
  { href: "/historico", label: "Histórico" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/simulador" className="flex items-center gap-2 font-semibold text-accent-text">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white">A</span>
          Aliquo
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-accent-bg text-accent-text" : "text-ink2 hover:bg-page"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user?.email ? (
            <span className="hidden text-xs text-muted sm:inline">{session.user.email}</span>
          ) : null}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-secondary !py-1.5 text-xs"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
