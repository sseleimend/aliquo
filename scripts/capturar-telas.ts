/**
 * Captura as telas do app em PNG, incluindo as autenticadas.
 *
 * Usa o Chrome do sistema em modo headless via CDP: injeta um cookie de sessão
 * assinado com o AUTH_SECRET (nenhuma senha envolvida) e fotografa a página
 * inteira. Serve para revisar o design sem depender do painel do editor.
 *
 * Uso: npx tsx scripts/capturar-telas.ts [--largura 1440]
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const SAIDA = path.resolve(process.cwd(), "var", "shots");
const PORTA_CDP = 9333;
const NOME_COOKIE = "authjs.session-token";

const CHROMES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

interface Tela {
  nome: string;
  url: string;
  espera?: number;
}

/** Telas públicas: precisam ser fotografadas SEM sessão, senão redirecionam. */
const PUBLICAS: Tela[] = [
  { nome: "01-landing", url: "/" },
  { nome: "02-login", url: "/login" },
  { nome: "03-cadastro", url: "/cadastro", espera: 2600 },
];

const LOGADAS: Tela[] = [
  { nome: "04-simulador", url: "/simulador", espera: 900 },
  { nome: "05-historico", url: "/historico", espera: 900 },
  { nome: "06-despachantes", url: "/conta/despachantes", espera: 900 },
];

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function acharChrome(): string {
  const c = CHROMES.find((p) => existsSync(p));
  if (!c) throw new Error("Chrome/Edge não encontrado nos caminhos padrão.");
  return c;
}

/** Cliente CDP mínimo sobre o WebSocket global do Node. */
class Cdp {
  private ws!: WebSocket;
  private id = 0;
  private pendentes = new Map<number, (v: unknown) => void>();

  async conectar(url: string) {
    this.ws = new WebSocket(url);
    await new Promise<void>((ok, erro) => {
      this.ws.addEventListener("open", () => ok(), { once: true });
      this.ws.addEventListener("error", () => erro(new Error("falha no WebSocket do CDP")), {
        once: true,
      });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown };
      if (msg.id != null) {
        this.pendentes.get(msg.id)?.(msg.result);
        this.pendentes.delete(msg.id);
      }
    });
  }

  enviar<T = Record<string, unknown>>(method: string, params: unknown = {}): Promise<T> {
    const id = ++this.id;
    return new Promise((ok) => {
      this.pendentes.set(id, ok as (v: unknown) => void);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  fechar() {
    this.ws.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const largura = Number(argv[argv.indexOf("--largura") + 1]) || 1440;

  // --- Sessão, sem senha ---
  const prisma = new PrismaClient();
  const user =
    (await prisma.user.findFirst({ where: { email: "teste@aliquo.com" } })) ??
    (await prisma.user.findFirst());
  if (!user) throw new Error("Nenhum usuário no banco — rode `npx tsx scripts/reset-teste.ts`.");

  const token = await encode({
    token: { uid: user.id, email: user.email, name: user.name, sub: user.id },
    secret: process.env.AUTH_SECRET!,
    salt: NOME_COOKIE,
    maxAge: 3600,
  });
  await prisma.$disconnect();
  console.log(`sessão de ${user.email}`);

  await rm(SAIDA, { recursive: true, force: true });
  await mkdir(SAIDA, { recursive: true });

  // --- Chrome headless ---
  const perfil = path.join(SAIDA, `.perfil-${process.pid}`);
  let chrome: ChildProcess | null = spawn(
    acharChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      `--remote-debugging-port=${PORTA_CDP}`,
      `--user-data-dir=${perfil}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // Espera o CDP subir.
  let alvo: { webSocketDebuggerUrl: string } | null = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    await dormir(250);
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/new?about:blank`, {
        method: "PUT",
      });
      if (r.ok) alvo = (await r.json()) as { webSocketDebuggerUrl: string };
    } catch {
      /* ainda subindo */
    }
  }
  if (!alvo) throw new Error("CDP não respondeu.");

  const cdp = new Cdp();
  await cdp.conectar(alvo.webSocketDebuggerUrl);
  await cdp.enviar("Page.enable");
  await cdp.enviar("Network.enable");
  await cdp.enviar("Runtime.enable");
  await cdp.enviar("Emulation.setDeviceMetricsOverride", {
    width: largura,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // O indicador de dev do Next flutua sobre a página e sujaria as fotos.
  await cdp.enviar("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      const e = document.createElement("style");
      e.textContent = "nextjs-portal,[data-nextjs-toast]{display:none !important}";
      document.addEventListener("DOMContentLoaded", () => document.head.appendChild(e));
    `,
  });

  async function fotografar(tela: Tela) {
    // url vazia = fotografar o que já está na tela (fim de um fluxo dirigido).
    if (tela.url) {
      await cdp.enviar("Page.navigate", { url: `${BASE}${tela.url}` });
      await dormir(tela.espera ?? 700);
    }

    // Fotografa a página inteira, não só a dobra.
    const { result } = await cdp.enviar<{ result?: { value?: number } }>("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const m = document.querySelector("main");
        const doc = document.documentElement.scrollHeight;
        return Math.max(doc, m ? m.scrollHeight + m.getBoundingClientRect().top : 0);
      })()`,
    });
    const altura = Math.min(Math.ceil(result?.value ?? 900), 4000);

    // Cresce a janela: sem isso a lateral `h-full` termina na dobra.
    if (altura > 900) {
      await cdp.enviar("Emulation.setDeviceMetricsOverride", {
        width: largura,
        height: altura,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await dormir(500);
    }

    const { data } = await cdp.enviar<{ data: string }>("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: largura, height: altura, scale: 1 },
    });

    if (altura > 900) {
      await cdp.enviar("Emulation.setDeviceMetricsOverride", {
        width: largura,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }

    const destino = path.join(SAIDA, `${tela.nome}.png`);
    await writeFile(destino, Buffer.from(data, "base64"));
    console.log(`  ${tela.nome}.png  ${largura}×${altura}`);
  }

  for (const tela of PUBLICAS) await fotografar(tela);

  await cdp.enviar("Network.setCookie", {
    name: NOME_COOKIE,
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
  });
  for (const tela of LOGADAS) await fotografar(tela);

  // --- Resultado: a tela mais densa do app só existe no fim do fluxo ---
  // Clicar por texto em vez de coordenada: o layout muda, o rótulo não.
  async function avaliar<T>(expr: string): Promise<T | undefined> {
    const r = await cdp.enviar<{ result?: { value?: T } }>("Runtime.evaluate", {
      returnByValue: true,
      expression: expr,
    });
    return r.result?.value;
  }

  /** Espera a página satisfazer `expr` (que deve devolver boolean). */
  async function esperarPor(expr: string, limiteMs = 30_000): Promise<boolean> {
    const fim = Date.now() + limiteMs;
    while (Date.now() < fim) {
      if (await avaliar<boolean>(expr)) return true;
      await dormir(400);
    }
    return false;
  }

  async function clicar(texto: string): Promise<boolean> {
    const r = await cdp.enviar<{ result?: { value?: boolean } }>("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const alvo = [...document.querySelectorAll("button,a")]
          .find((e) => e.textContent?.trim().startsWith(${JSON.stringify(texto)}) && !e.disabled);
        if (!alvo) return false;
        alvo.click();
        return true;
      })()`,
    });
    return r.result?.value === true;
  }

  const prisma2 = new PrismaClient();
  const imp = await prisma2.importacao.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  await prisma2.$disconnect();

  if (imp) {
    const antes = new Set(
      (await (async () => {
        const c = new PrismaClient();
        const r = await c.importacao.findMany({ where: { userId: user.id }, select: { id: true } });
        await c.$disconnect();
        return r;
      })()).map((r) => r.id),
    );

    await cdp.enviar("Page.navigate", { url: `${BASE}/simulador?duplicar=${imp.id}` });
    const carregou = await esperarPor(
      `document.body.innerText.includes("Reusando uma importação anterior")`,
    );
    if (!carregou) console.log("  (o reuso não carregou a tempo)");
    // O reuso abre no passo 2; daí até o cálculo são quatro avanços.
    for (let i = 0; i < 6; i++) {
      // O painel de ICMS mora no passo de custos e tributos; é a única tela
      // onde a composição da alíquota aparece para conferência.
      if (await avaliar<boolean>(`document.body.innerText.includes("ICMS —")`)) {
        await fotografar({ nome: "08-icms", url: "", espera: 0 });
      }
      if (await clicar("Calcular custo total")) break;
      if (!(await clicar("Continuar"))) {
        // Sem "Continuar" habilitado o fluxo trava; mostrar o que existe na
        // tela é o que permite descobrir o porquê sem abrir o navegador.
        const d = await cdp.enviar<{ result?: { value?: string } }>("Runtime.evaluate", {
          returnByValue: true,
          expression: `[...document.querySelectorAll("button")]
            .map((b) => (b.disabled ? "[x] " : "[ ] ") + b.textContent.trim().slice(0, 30))
            .join(" | ")`,
        });
        console.log("  travou no passo", i, "->", d.result?.value);
        break;
      }
      await esperarPor(
        `[...document.querySelectorAll("button")].some(
           (b) => !b.disabled && /^(Continuar|Calcular custo total)/.test(b.textContent.trim()))`,
        10_000,
      );
      await dormir(300);
    }
    await esperarPor(`document.body.innerText.includes("CUSTO TOTAL DE NACIONALIZAÇÃO")`, 45_000);
    await dormir(600);
    await fotografar({ nome: "07-resultado", url: "", espera: 0 });

    const limpeza = new PrismaClient();
    const criadas = await limpeza.importacao.findMany({
      where: { userId: user.id, id: { notIn: [...antes] } },
      select: { id: true },
    });
    if (criadas.length > 0) {
      await limpeza.importacao.deleteMany({ where: { id: { in: criadas.map((c) => c.id) } } });
      console.log(`  (apaguei ${criadas.length} simulação(ões) que a captura gravou)`);
    }
    await limpeza.$disconnect();
  } else {
    console.log("  (sem importação no histórico — pulei o resultado)");
  }

  cdp.fechar();
  chrome?.kill();
  chrome = null;
  await dormir(600);
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
  console.log(`\nPNGs em ${SAIDA}`);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
