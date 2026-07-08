import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/dang-nhap" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: false }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (input) => {
        const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse(input);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash || user.status !== UserStatus.ACTIVE) return null;
        if (user.accessExpiresAt && user.accessExpiresAt <= new Date()) return null;
        if (!(await compare(parsed.data.password, user.passwordHash))) return null;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
      if (!existing) return true;
      if (existing.status !== UserStatus.ACTIVE) return false;
      if (existing.accessExpiresAt && existing.accessExpiresAt <= new Date()) return false;
      await prisma.user.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date() },
      });
      return true;
    },
    async jwt({ token, user }) {
      const userId = user?.id ?? token.sub;
      if (userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!dbUser) {
          token.status = UserStatus.DISABLED;
          token.revoked = true;
          return token;
        }

        token.role = dbUser.role;
        token.status = dbUser.status;
        token.mustChangePassword = dbUser.mustChangePassword;
        token.accessExpiresAt = dbUser.accessExpiresAt?.toISOString();
        token.sessionVersion ??= dbUser.sessionVersion;

        if (token.sessionVersion !== dbUser.sessionVersion) {
          token.status = UserStatus.DISABLED;
          token.revoked = true;
        }

        if (dbUser.accessExpiresAt && dbUser.accessExpiresAt <= new Date()) {
          token.status = UserStatus.DISABLED;
          token.revoked = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as typeof session.user.role;
        session.user.status = token.status as typeof session.user.status;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.accessExpiresAt = typeof token.accessExpiresAt === "string" ? token.accessExpiresAt : undefined;
        session.user.revoked = Boolean(token.revoked);
      }
      return session;
    },
  },
});
