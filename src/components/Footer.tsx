// Rodapé com placeholders de Termos/Privacidade — o PRD (§8, §11) registra que
// não existe termo de uso nem política de privacidade formal ainda.
export function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-8 text-center text-xs text-muted">
      <p>Aliquo · protótipo — Simulador Tributário e Landed Cost</p>
      <p className="mt-1">
        <span
          title="Pendência registrada no PRD (§11): termo de uso ainda não existe."
          className="cursor-help underline decoration-dotted"
        >
          Termos de uso
        </span>{" "}
        ·{" "}
        <span
          title="Pendência registrada no PRD (§11): política de privacidade/LGPD ainda não existe."
          className="cursor-help underline decoration-dotted"
        >
          Política de privacidade
        </span>{" "}
        <em>(pendentes — ver PRD §11)</em>
      </p>
    </footer>
  );
}
