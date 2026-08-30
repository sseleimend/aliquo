/**
 * A landing page é um app separado de apps/simulador (deploys independentes,
 * ver README de cada um). Login, cadastro, termos e privacidade vivem no
 * simulador — configurável por env porque o domínio de produção ainda não
 * está fechado.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.aliquo.com";
