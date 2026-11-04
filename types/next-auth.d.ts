import "next-auth";
import "next-auth/jwt";

type AppRole = "ISSUE_CLERK" | "FINANCE_HEAD";

declare module "next-auth" {
  interface User {
    role: AppRole;
  }

  interface Session {
    user: {
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
  }
}

