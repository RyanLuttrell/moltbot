"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Chat", exact: true },
  { href: "/dashboard/channels", label: "Channels" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-secondary">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="font-display text-xl font-bold tracking-tight">
            Moltbot<span className="text-brand">.</span>
          </span>
          <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
            SaaS
          </span>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-full px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-light font-medium text-brand"
                        : "text-text-secondary hover:bg-brand-light/50 hover:text-text-primary"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border px-5 py-4">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
