"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Today", icon: "📋" },
  { href: "/dashboard/jobs", label: "Jobs", icon: "🔧" },
  { href: "/dashboard/customers", label: "Customers", icon: "👥" },
  { href: "/dashboard/invoices", label: "Invoices", icon: "💳" },
  { href: "/dashboard/catalog", label: "Catalog", icon: "📦" },
  { href: "/dashboard/activity", label: "Activity", icon: "📜" },
  { href: "/dashboard/stats", label: "Stats", icon: "📊" },
];

export function Sidebar({ businessName }: { businessName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <Link href="/dashboard" className="text-2xl font-bold">
          Sal
        </Link>
        <p className="text-xs text-gray-400 mt-1">Back-office AI</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">{businessName ?? "My Business"}</p>
      </div>
    </aside>
  );
}
