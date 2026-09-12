"use client";

import { useEffect } from "react";

/**
 * Scroll suave para as âncoras da landing (#produto, #recursos, #precos, #faq).
 *
 * O `scroll-behavior: smooth` nativo resolve o básico, mas não dá controle de
 * easing/duração — por isso a animação é feita aqui, com o deslocamento do
 * header descontado do destino. Sem JS (ou com `prefers-reduced-motion`), o CSS
 * em `globals.css` continua cobrindo o caso: `scroll-padding-top` também vale
 * para navegação por fragmento, então o link externo com hash já aterrissa no
 * lugar certo sem ajuda daqui.
 */

/** Distância máxima considerada para a duração; acima disso o tempo satura. */
const MAX_DISTANCE = 2400;
const MIN_DURATION = 420;
const MAX_DURATION = 900;

/** Teclas que rolam a página — só elas interrompem a animação. */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Altura do header sticky. A fonte única é `--header-h` em `globals.css` — a
 * mesma que alimenta o `scroll-padding-top`, para que o clique com JS e a
 * navegação por fragmento parem exatamente no mesmo ponto. Mudou a altura do
 * header? Ajuste lá. Medir o elemento é só fallback.
 */
function headerOffset() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--header-h")
    .trim();
  if (raw.endsWith("px")) {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const header = document.querySelector("header");
  return header ? header.getBoundingClientRect().height : 0;
}

function targetTop(el: Element) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const top = window.scrollY + el.getBoundingClientRect().top - headerOffset();
  return Math.max(0, Math.min(top, max));
}

/**
 * Resolve `#secao` para o elemento. `getElementById` em vez de `querySelector`
 * porque hash não é seletor CSS: `#1`, `#foo bar` ou `#utm=x` fariam o
 * `querySelector` lançar `SyntaxError` — e o hash chega percent-encoded.
 */
function findTarget(hash: string) {
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    id = hash.slice(1);
  }
  const el = id ? document.getElementById(id) : null;
  return el instanceof HTMLElement ? el : null;
}

/** Move o foco para a seção sem que o browser faça o pulo dele. */
function focusTarget(el: HTMLElement) {
  const hadTabIndex = el.hasAttribute("tabindex");
  if (!hadTabIndex) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  if (!hadTabIndex) el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
}

export function SmoothScroll() {
  useEffect(() => {
    let frame = 0;
    let cancelAnimation: (() => void) | null = null;

    function scrollToElement(el: HTMLElement, hash: string) {
      cancelAnimation?.();

      const from = window.scrollY;
      const to = targetTop(el);
      const distance = to - from;

      // Roda mesmo quando a rolagem é interrompida: a URL e o foco precisam
      // acompanhar o destino, senão o teclado fica preso no link do header.
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        focusTarget(el);
        if (hash && window.location.hash !== hash) {
          history.pushState(null, "", hash);
        }
      };

      if (prefersReducedMotion() || Math.abs(distance) < 2) {
        window.scrollTo({ top: to, behavior: "instant" });
        finish();
        return;
      }

      const duration =
        MIN_DURATION +
        (MAX_DURATION - MIN_DURATION) * Math.min(Math.abs(distance) / MAX_DISTANCE, 1);
      const start = performance.now();

      // Qualquer rolagem do usuário durante a animação tem prioridade: aborta.
      const abort = () => {
        cancelAnimation?.();
        finish();
      };
      const aborters: Array<[string, EventListener]> = [
        ["wheel", ((e: WheelEvent) => e.deltaY !== 0 && abort()) as EventListener],
        ["touchstart", abort],
        ["keydown", ((e: KeyboardEvent) => SCROLL_KEYS.has(e.key) && abort()) as EventListener],
      ];
      aborters.forEach(([type, fn]) => window.addEventListener(type, fn, { passive: true }));

      cancelAnimation = () => {
        cancelAnimationFrame(frame);
        aborters.forEach(([type, fn]) => window.removeEventListener(type, fn));
        cancelAnimation = null;
      };

      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        window.scrollTo({ top: from + distance * easeInOutCubic(t), behavior: "instant" });
        if (t < 1) {
          frame = requestAnimationFrame(step);
          return;
        }
        cancelAnimation?.();
        finish();
      };

      frame = requestAnimationFrame(step);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;

      const el = findTarget(href);
      if (!el) return;

      event.preventDefault();
      scrollToElement(el, href);
    }

    // Voltar/avançar entre as âncoras. O App Router não mexe em
    // `history.scrollRestoration`, então o browser devolve sozinho a posição
    // salva da entrada — inclusive quando o usuário tinha rolado para longe da
    // seção, que uma re-rolagem nossa estragaria. O que ele não faz é parar uma
    // animação em voo, e ela sobrescreveria a restauração.
    function onPopState() {
      cancelAnimation?.();
      if (history.scrollRestoration !== "manual") return;
      const hash = window.location.hash;
      const el = hash && hash !== "#" ? findTarget(hash) : null;
      if (el) window.scrollTo({ top: targetTop(el), behavior: "instant" });
    }

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
      cancelAnimation?.();
    };
  }, []);

  return null;
}
