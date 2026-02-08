"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Layers, Printer, Settings, Home } from "lucide-react";
import clsx from "clsx";
import ThemeDropdown from "./ThemeDropdown";

const navItems = [
  { name: "Projets", href: "/", icon: Box },
  { name: "Filaments", href: "/filaments", icon: Layers },
  { name: "Imprimantes", href: "/printers", icon: Printer },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/10 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="w-full px-6 sm:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center group">
              <span className="text-2xl md:text-3xl font-black text-primary tracking-tighter hover:scale-[1.02] transition-transform">
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
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeDropdown />
          </div>
        </div>
      </div>
    </nav>
  );
}
