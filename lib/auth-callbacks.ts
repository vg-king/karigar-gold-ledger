import type { NextAuthConfig } from "next-auth";

export const authCallbacks = {
  authorized({ auth: session }) {
    return Boolean(session?.user?.id);
  },
  jwt({ token, user }) {
    if (user?.id) token.id = user.id;
    if (user?.role) token.role = user.role;
    return token;
  },
  session({ session, token }) {
    if (session.user && token.id) session.user.id = token.id;
    if (session.user && token.role) session.user.role = token.role;
    return session;
  },
} satisfies NonNullable<NextAuthConfig["callbacks"]>;
