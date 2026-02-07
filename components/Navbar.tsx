"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Layers, Printer, Settings, Home } from "lucide-react";
import clsx from "clsx";

const navItems = [
  { name: "Projets", href: "/", icon: Box },
  { name: "Filaments", href: "/filaments", icon: Layers },
  { name: "Imprimantes", href: "/printers", icon: Printer },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-all">
                <Home className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-blue-500">
                3D Print Manager
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-500/10 text-blue-400"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
