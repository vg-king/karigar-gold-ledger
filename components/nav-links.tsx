"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ isFinance }: { isFinance: boolean }) {
  const pathname = usePathname();
  const links = [
    ["/", "Home"],
    ["/balances", "Balances"],
    ["/issue", "Issue"],
    ["/receipt", "Receipt"],
    ...(isFinance ? [["/karigars", "Karigars"], ["/finance", "Finance"]] : []),
  ];
  return <>{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}><span className="nav-label-full">{label}</span><span className="nav-label-short">{label === "Balances" ? "Bal." : label === "Karigars" ? "Masters" : label}</span></Link>)}</>;
}
