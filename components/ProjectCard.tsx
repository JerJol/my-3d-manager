"use client";

import { Trash2, Clock, Scale, Coins, Files, Calendar, Tag } from "lucide-react";
import Link from "next/link";
import { deleteProject } from "@/app/actions";

interface ProjectCardProps {
    project: {
        id: number;
        name: string;
        description: string | null;
        status: string;
        theme: string | null;
        createdAt: Date;
        versionName: string | null;
        versionNumber: number;
        filament: {
            diameter: number;
            density: number;
            weight: number;
            price: number;
        } | null;
        printer: {
            machineHourlyCost: number;
        } | null;
        stls: {
            quantity: number;
            slicers: {
                printTime: number | null;
                filamentLen: number | null;
            }[];
        }[];
    };
    electricityPrice: number;
}

export default function ProjectCard({ project, electricityPrice }: ProjectCardProps) {
    const handleDelete = async () => {
        if (confirm("⚠️ ATTENTION : La suppression d'un projet est IRREVERSIBLE.\n\nTous les fichiers associés (STL et G-codes) seront également supprimés du disque.\n\nSouhaitez-vous vraiment continuer ?")) {
            await deleteProject(project.id);
        }
    };

    // Calculs statistiques
    let totalPrintTime = 0;
    let totalFilamentLen = 0;
    let totalStls = project.stls.length;

    project.stls.forEach((stl) => {
        const activeSlicer = stl.slicers[0]; // On prend le premier slicer par défaut
        if (activeSlicer) {
            totalPrintTime += (activeSlicer.printTime || 0) * stl.quantity;
            totalFilamentLen += (activeSlicer.filamentLen || 0) * stl.quantity;
        }
    });

    const filamentDensity = project.filament?.density || 1.25;
    const filamentDiameter = project.filament?.diameter || 1.75;
    const radius = filamentDiameter / 2;
    const volumeCm3 = (Math.PI * Math.pow(radius, 2) * totalFilamentLen) / 1000;
    const totalWeightG = volumeCm3 * filamentDensity;

    // Coût
    const filamentPrice = project.filament?.price || 0;
    const filamentSpoolWeight = project.filament?.weight || 1000;
    const costFilament = (totalWeightG / filamentSpoolWeight) * filamentPrice;

    const machineHourlyCost = project.printer?.machineHourlyCost || 0;
    const costElectricity = (totalPrintTime / 3600) * electricityPrice;
    const costMachine = (totalPrintTime / 3600) * machineHourlyCost;
    const totalCost = costFilament + costElectricity + costMachine;

    return (
        <div className="relative bg-slate-800/40 border border-slate-800/60 rounded-lg p-6 hover:border-slate-700 transition-colors group cursor-pointer hover:bg-slate-800/60">
            <Link href={`/projects/${project.id}`} className="absolute inset-0 z-0" />

            <div className="flex justify-between items-start relative z-10 pointer-events-none">
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                            {project.name} <span className="text-slate-500 font-normal">— {project.versionName || `v${project.versionNumber}`}</span>
                        </h3>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            {project.status}
                        </span>
                    </div>

                    <p className="text-slate-400 text-sm">
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
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
                            <Coins className="w-3.5 h-3.5" />
                            <span>{totalCost.toFixed(2)} €</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-400/5 px-2 py-1 rounded-md border border-slate-400/10">
                            <Files className="w-3.5 h-3.5" />
                            <span>{totalStls} fichiers</span>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                        {project.theme && (
                            <div className="flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-blue-500/50" />
                                <span>Thème: <span className="text-slate-400">{project.theme}</span></span>
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
