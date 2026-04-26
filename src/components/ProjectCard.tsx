import { Trash2, Clock, Scale, Coins, Files, Calendar, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";

interface ProjectCardProps {
    project: any;
    electricityPrice: number;
    onDelete: (id: number) => void;
}

export default function ProjectCard({ project, electricityPrice, onDelete }: ProjectCardProps) {
    const handleDelete = async () => {
        if (confirm("⚠️ ATTENTION : La suppression d'un projet est IRREVERSIBLE.\n\nSouhaitez-vous vraiment continuer ?")) {
            onDelete(project.id);
        }
    };

    // Calculs statistiques (Même logique que V1)
    let totalPrintTime = 0;
    let totalFilamentLen = 0;
    let remainingPrintTime = 0;
    let totalStls = project.stls?.length || 0;

    project.stls?.forEach((stl: any) => {
        const activeSlicer = stl.slicers?.[0];
        if (activeSlicer) {
            totalPrintTime += (activeSlicer.printTime || 0) * stl.quantity;
            totalFilamentLen += (activeSlicer.filamentLen || 0) * stl.quantity;
            const remainingQty = Math.max(0, stl.quantity - (stl.printedQty || 0));
            remainingPrintTime += (activeSlicer.printTime || 0) * remainingQty;
        }
    });

    const filamentDensity = project.filament?.density || 1.25;
    const filamentDiameter = project.filament?.diameter || 1.75;
    const radius = filamentDiameter / 2;
    const volumeCm3 = (Math.PI * Math.pow(radius, 2) * totalFilamentLen) / 1000;
    const totalWeightG = volumeCm3 * filamentDensity;

    const filamentPrice = project.filament?.price || 0;
    const filamentSpoolWeight = project.filament?.weight || 1000;
    const costFilament = (totalWeightG / filamentSpoolWeight) * filamentPrice;

    const machineHourlyCost = project.printer?.machineHourlyCost || 0;
    const costElectricity = (totalPrintTime / 3600) * electricityPrice;
    const costMachine = (totalPrintTime / 3600) * machineHourlyCost;
    const totalCost = costFilament + costElectricity + costMachine;

    // Calcul du statut dynamique
    const totalPrintedItems = project.stls?.reduce((acc: number, stl: any) => acc + (stl.printedQty || 0), 0) || 0;
    const isFinished = totalStls > 0 && project.stls.every((stl: any) => (stl.printedQty || 0) >= (stl.quantity || 1));

    let dynamicStatus: "Créé" | "En cours" | "Imprimé" = "Créé";
    if (isFinished) dynamicStatus = "Imprimé";
    else if (totalPrintedItems > 0) dynamicStatus = "En cours";

    return (
        <div className="relative bg-card/40 border border-border/60 rounded-lg p-6 hover:border-border transition-colors group cursor-pointer hover:bg-card/60">
            <Link to={`/projects/${project.id}`} className="absolute inset-0 z-0" />

            <div className="flex justify-between items-start relative z-10 pointer-events-none">
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                            {project.name} <span className="text-muted-foreground font-normal">— {project.versionName || `v${project.versionNumber}`}</span>
                        </h3>
                        <span className={clsx(
                            "px-2 py-0.5 rounded text-xs font-medium border",
                            dynamicStatus === "Imprimé" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                dynamicStatus === "En cours" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                    "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                            {dynamicStatus}
                        </span>
                    </div>

                    <p className="text-muted-foreground text-sm">
                        {project.description || "Aucune description"}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/5 px-2 py-1 rounded-md border border-green-400/10">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{Math.floor(totalPrintTime / 3600)}h {Math.floor((totalPrintTime % 3600) / 60)}m</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/5 px-2 py-1 rounded-md border border-yellow-400/10">
                            <Scale className="w-3.5 h-3.5" />
                            <span>{Math.round(totalWeightG)}g</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-primary bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
                            <Coins className="w-3.5 h-3.5" />
                            <span>{totalCost.toFixed(2)} €</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-400/5 px-2 py-1 rounded-md border border-slate-400/10">
                            <Files className="w-3.5 h-3.5" />
                            <span>{totalStls} fichiers</span>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {project.theme && (
                            <div className="flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-blue-500/50" />
                                <span>Thème: <span className="text-muted-foreground">{project.theme}</span></span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <span>Créé le {new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete();
                        }}
                        className="p-2 rounded-lg bg-slate-800 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        title="Supprimer le projet"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
