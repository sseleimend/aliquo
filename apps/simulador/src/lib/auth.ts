import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "E-mail e senha",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    authorize: async (creds) => {
      const email = String(creds?.email || "").trim().toLowerCase();
      const password = String(creds?.password || "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return { id: user.id, email: user.email, name: user.name ?? undefined };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      const email = user?.email ?? (token.email as string | undefined);
      if (email && !token.uid) {
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
});

/**
 * Retorna o id do usuário autenticado, ou null.
 *
 * CONFERE que o usuário ainda existe, e não só que o token é válido. O token
 * é um JWT: ele carrega o `uid` gravado no login e nunca mais consulta o banco
 * (`jwt` só busca quando `!token.uid`). Basta a conta ser removida — ou o banco
 * ser trocado sob uma sessão viva — para o id apontar para o vazio.
 *
 * Sem esta conferência o sintoma é péssimo: a leitura funciona, e a primeira
 * ESCRITA que referencia userId morre na chave estrangeira, virando 500 numa
 * rota qualquer. Sessão órfã é sessão inválida; o certo é dizer isso.
 *
 * Custa uma consulta por chamada. É o preço de não confiar em token sozinho.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const existe = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return existe ? id : null;
}
