import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getExchangeRate, getFxProvider } from "@/lib/fx";

// Cotação de câmbio automática (RF07). Provider definido por FX_PROVIDER.
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const currency = (searchParams.get("currency") ?? "USD").toUpperCase();

  const quote = await getExchangeRate(currency);
  return NextResponse.json({
    ...quote,
    moedasSuportadas: getFxProvider().listSupported(),
  });
}
