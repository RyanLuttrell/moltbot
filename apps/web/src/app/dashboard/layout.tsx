import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/channels", label: "Channels" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="bg-surface-secondary border-border flex w-60 flex-col border-r">
        <div className="border-border flex items-center gap-2 border-b p-4">
          <span className="text-lg font-bold">Moltbot</span>
        </div>
        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-text-secondary hover:bg-surface-tertiary hover:text-text-primary block rounded-md px-3 py-2 text-sm transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-border border-t p-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
