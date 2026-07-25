"use client";

// Input de preço com máscara de moeda (padrão brasileiro: 1.234,56).
// Funciona por centavos: o usuário digita apenas dígitos, que preenchem da
// direita para a esquerda. Armazena/emite um número (em reais/moeda cheia).

const fmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MoneyInput({
  value,
  onValueChange,
  id,
  prefix = "R$",
  placeholder = "0,00",
  disabled,
}: {
  value: number;
  onValueChange: (n: number) => void;
  id?: string;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const display = value > 0 ? fmt.format(value) : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
        {prefix}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="input pl-12 text-right tabular-nums"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
          onValueChange(digits ? parseInt(digits, 10) / 100 : 0);
        }}
      />
    </div>
  );
}
