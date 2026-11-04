export { auth as proxy } from "./auth";

export const config = {
  matcher: ["/((?!login|api/auth|api|_next/static|_next/image|favicon.ico).*)"],
};

