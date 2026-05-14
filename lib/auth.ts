import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const rawIp = req?.headers?.["x-forwarded-for"] ?? req?.headers?.["x-real-ip"] ?? "unknown";
        const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp as string).split(",")[0].trim();
        const userAgent = (req?.headers?.["user-agent"] as string) ?? "unknown";

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          try {
            await prisma.loginLog.create({ data: { ip, userAgent, success: false } });
          } catch { /* ignore */ }
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);

        try {
          await prisma.loginLog.create({
            data: { userId: user.id, ip, userAgent, success: valid },
          });
        } catch { /* ignore */ }

        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
          department: user.department,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.department = (user as any).department;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      // Allow client-side session.update() to clear mustChangePassword
      if (trigger === "update" && session?.mustChangePassword !== undefined) {
        token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).department = token.department as string;
        (session.user as any).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
