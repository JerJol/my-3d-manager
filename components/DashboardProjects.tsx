"use client";

import { useState } from "react";
import { Plus, Search, LayoutGrid, Tag } from "lucide-react";
import ProjectCard from "./ProjectCard";
import NewProjectModal from "./NewProjectModal";
import clsx from "clsx";

interface DashboardProjectsProps {
    projects: any[];
    electricityPrice: number;
    categories: { id: number; name: string }[];
}

export default function DashboardProjects({ projects, electricityPrice, categories }: DashboardProjectsProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");

    const filteredProjects = projects.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

        const matchesCategory = selectedCategoryId === "all" || p.categoryId === selectedCategoryId;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-white tracking-tight">Projets d'impression 3D</h1>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Rechercher un projet..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 text-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Nouveau projet
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                    onClick={() => setSelectedCategoryId("all")}
                    className={clsx(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                        selectedCategoryId === "all"
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    )}
                >
                    Toutes les catégories
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border flex items-center gap-2",
                            selectedCategoryId === cat.id
                                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        )}
                    >
                        <Tag className="w-3.5 h-3.5" />
                        {cat.name}
                    </button>
                ))}
            </div>

            {projects.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-20 text-center">
                    <LayoutGrid className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">Aucun projet trouvé</h3>
                    <p className="text-slate-500">Utilisez le bouton "Nouveau projet" pour commencer.</p>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                    <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <h3 className="text-md font-medium text-slate-400">Aucun résultat trouvé</h3>
                    <p className="text-sm text-slate-600">Essayez de modifier vos filtres ou votre recherche.</p>
                    <button
                        onClick={() => {
                            setSearch("");
                            setSelectedCategoryId("all");
                        }}
                        className="mt-4 text-sm text-blue-500 hover:underline"
                    >
                        Réinitialiser les filtres
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} electricityPrice={electricityPrice} />
                    ))}
                </div>
            )}

            {isModalOpen && <NewProjectModal onClose={() => setIsModalOpen(false)} />}
        </div>
    );
}
