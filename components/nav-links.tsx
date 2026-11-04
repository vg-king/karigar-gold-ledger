"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isFinance }: { isFinance: boolean }) {
  const pathname = usePathname();
  const links = [
    ["/balances", "Balances"],
    ["/issue", "Issue"],
    ["/receipt", "Receipt"],
    ...(isFinance ? [["/karigars", "Karigars"], ["/finance", "Finance"]] : []),
  ];
  return <>{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}</>;
}
