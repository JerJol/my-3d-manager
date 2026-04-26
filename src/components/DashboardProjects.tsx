import { useState } from "react";
import { Plus, Search, LayoutGrid, Tag } from "lucide-react";
import ProjectCard from "./ProjectCard";
import clsx from "clsx";

interface DashboardProjectsProps {
    projects: any[];
    electricityPrice: number;
    categories: { id: number; name: string }[];
    onAddProject: () => void;
    onDeleteProject: (id: number) => void;
}

export default function DashboardProjects({ projects, electricityPrice, categories, onAddProject, onDeleteProject }: DashboardProjectsProps) {
    const [search, setSearch] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");
    const [selectedStatus, setSelectedStatus] = useState<"all" | "Créé" | "En cours" | "Imprimé">("all");

    const filteredProjects = projects.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

        const matchesCategory = selectedCategoryId === "all" || p.categoryId === selectedCategoryId;

        // Dynamic status calculation for filtering
        let totalPrintTime = 0;
        let remainingPrintTime = 0;
        p.stls?.forEach((stl: any) => {
            const activeSlicer = stl.slicers?.[0];
            if (activeSlicer) {
                totalPrintTime += (activeSlicer.printTime || 0) * stl.quantity;
                const remainingQty = Math.max(0, stl.quantity - (stl.printedQty || 0));
                remainingPrintTime += (activeSlicer.printTime || 0) * remainingQty;
            }
        });

        const totalPrintedItems = p.stls?.reduce((acc: number, stl: any) => acc + (stl.printedQty || 0), 0) || 0;
        const isFinished = p.stls?.length > 0 && p.stls.every((stl: any) => (stl.printedQty || 0) >= (stl.quantity || 1));

        let dynamicStatus = "Créé";
        if (isFinished) dynamicStatus = "Imprimé";
        else if (totalPrintedItems > 0) dynamicStatus = "En cours";

        const matchesStatus = selectedStatus === "all" || dynamicStatus === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Projets d'impression 3D</h1>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Rechercher un projet..."
                            className="w-full bg-card border border-border/50 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60 text-foreground"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={onAddProject}
                        className="bg-primary hover:bg-blue-500 text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Nouveau projet
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="space-y-4">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    {[
                        { id: "all", label: "Tous les statuts" },
                        { id: "Créé", label: "Créé" },
                        { id: "En cours", label: "En cours" },
                        { id: "Imprimé", label: "Imprimé" }
                    ].map((status) => (
                        <button
                            key={status.id}
                            onClick={() => setSelectedStatus(status.id as any)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border uppercase tracking-wider",
                                selectedStatus === status.id
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/5"
                                    : "bg-card border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                            )}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setSelectedCategoryId("all")}
                        className={clsx(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                            selectedCategoryId === "all"
                                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "bg-card border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
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
                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "bg-card border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                            )}
                        >
                            <Tag className="w-3.5 h-3.5" />
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="bg-card/50 border border-border/50 rounded-xl p-20 text-center">
                    <LayoutGrid className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground">Aucun projet trouvé</h3>
                    <p className="text-muted-foreground/60">Utilisez le bouton "Nouveau projet" pour commencer.</p>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-card/30 border border-dashed border-border/50 rounded-xl p-12 text-center">
                    <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <h3 className="text-md font-medium text-muted-foreground">Aucun résultat trouvé</h3>
                    <p className="text-sm text-muted-foreground/60">Essayez de modifier vos filtres ou votre recherche.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map((project) => (
                        <ProjectCard key={project.id} project={project} electricityPrice={electricityPrice} onDelete={onDeleteProject} />
                    ))}
                </div>
            )}
        </div>
    );
}
