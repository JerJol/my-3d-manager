"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Box, Search, ChevronRight, LayoutGrid } from "lucide-react";
import clsx from "clsx";

type SimplifiedProject = {
    id: number;
    name: string;
    versionName: string | null;
    status: string;
};

interface SidebarClientProps {
    projects: SimplifiedProject[];
}

export default function SidebarClient({ projects }: SidebarClientProps) {
    const pathname = usePathname();
    const [search, setSearch] = useState("");

    const filteredProjects = projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    // Hide on home page as requested
    if (pathname === "/") return null;

    return (
        <aside className="w-64 border-r border-white/10 bg-slate-900/30 backdrop-blur-xl h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto hidden lg:flex flex-col">
            <div className="p-4 border-b border-white/5">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Rechercher un projet..."
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 py-4 overflow-y-auto">
                <div className="px-4 mb-2 flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Mes Projets
                    </h2>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                        {filteredProjects.length}
                    </span>
                </div>

                <div className="space-y-0.5 px-2">
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map((project) => {
                            const href = `/projects/${project.id}`;
                            const isActive = pathname === href;

                            return (
                                <Link
                                    key={project.id}
                                    href={href}
                                    className={clsx(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                                        isActive
                                            ? "bg-blue-500/10 text-blue-400 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]"
                                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                                    )}
                                >
                                    <div className={clsx(
                                        "p-1.5 rounded-lg transition-colors",
                                        isActive ? "bg-blue-500/20 text-blue-400" : "bg-slate-800/50 text-slate-500 group-hover:bg-slate-800 group-hover:text-slate-400"
                                    )}>
                                        <Box className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{project.name}</p>
                                        {project.versionName && (
                                            <p className="text-[10px] text-slate-500 truncate opacity-80">
                                                {project.versionName}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className={clsx(
                                        "w-4 h-4 transition-transform",
                                        isActive ? "rotate-90 opacity-100" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                                    )} />
                                    {isActive && (
                                        <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-blue-500 rounded-full" />
                                    )}
                                </Link>
                            );
                        })
                    ) : (
                        <div className="px-4 py-8 text-center">
                            <p className="text-xs text-slate-500">Aucun projet trouvé</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-white/5 mt-auto bg-slate-950/20">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                    <LayoutGrid className="w-4 h-4" />
                    Vue d'ensemble
                </Link>
            </div>
        </aside>
    );
}
