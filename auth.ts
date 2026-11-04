import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  clearLoginFailures,
  isLoginBlocked,
  LOGIN_RATE_LIMIT_ERROR_CODE,
  recordLoginFailure,
} from "./lib/auth-rate-limit";
import { prisma } from "./lib/prisma";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

class RateLimitError extends CredentialsSignin {
  code = LOGIN_RATE_LIMIT_ERROR_CODE;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? request.headers.get("x-real-ip")
          ?? "unknown";

        if (email && isLoginBlocked(email, ip)) {
          throw new RateLimitError();
        }

        if (!email || !password) {
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
          recordLoginFailure(email, ip);
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        clearLoginFailures(email, ip);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
    jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
});
