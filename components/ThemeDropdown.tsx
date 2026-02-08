"use client";

import React, { useState, useRef, useEffect } from "react";
import { Palette, Check, Moon, Sun, Trees, Flame, Compass, Scroll, Droplets } from "lucide-react";
import { useTheme } from "./ThemeContext";
import clsx from "clsx";

export default function ThemeDropdown() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const themes = [
        { id: "midnight", name: "Midnight", icon: Moon, color: "#3b82f6" },
        { id: "slate", name: "Slate", icon: Compass, color: "#94a3b8" },
        { id: "forest", name: "Forest", icon: Trees, color: "#10b981" },
        { id: "ember", name: "Ember", icon: Flame, color: "#f97316" },
        { id: "light", name: "Clair", icon: Sun, color: "#2563eb" },
        { id: "nordic", name: "Nordique", icon: Compass, color: "#475569" },
        { id: "paper", name: "Papier", icon: Scroll, color: "#92400e" },
        { id: "ocean", name: "Océan", icon: Droplets, color: "#0284c7" },
    ] as const;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeTheme = themes.find((t) => t.id === theme) || themes[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                    isOpen
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card/40 border-border/50 text-muted-foreground hover:border-border hover:bg-card/60"
                )}
            >
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Thème</span>
                <div
                    className="w-2 h-2 rounded-full ml-1"
                    style={{ backgroundColor: activeTheme.color }}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-card border border-border shadow-2xl z-[60] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-border/50 mb-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Choisir une ambiance
                        </span>
                    </div>
                    <div className="grid grid-cols-1 gap-0.5 px-2">
                        {themes.map((t) => {
                            const Icon = t.icon;
                            const isActive = theme === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setTheme(t.id);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group",
                                        isActive
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={clsx(
                                                "p-1.5 rounded-lg transition-colors",
                                                isActive ? "bg-primary/20" : "bg-card border border-border/50 group-hover:border-border"
                                            )}
                                        >
                                            <Icon
                                                className="w-4 h-4"
                                                style={{ color: isActive ? undefined : t.color }}
                                            />
                                        </div>
                                        <span>{t.name}</span>
                                    </div>
                                    {isActive && <Check className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
