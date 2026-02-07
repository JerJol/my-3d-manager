"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash, Save, Layers } from "lucide-react";
import { getFilaments, createFilament, updateFilament, deleteFilament } from "@/app/actions";

interface Filament {
    id: number;
    name: string;
    brand: string | null;
    material: string;
    density: number;
    diameter: number;
    weight: number;
    price: number;
    color: string | null;
}

export default function FilamentsPage() {
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFilament, setEditingFilament] = useState<Filament | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadFilaments();
    }, []);

    async function loadFilaments() {
        const data = await getFilaments();
        setFilaments(data);
        setIsLoading(false);
    }

    async function handleDelete(id: number) {
        if (confirm("Supprimer ce filament ?")) {
            await deleteFilament(id);
            loadFilaments();
        }
    }

    function openEditModal(filament: Filament) {
        setEditingFilament(filament);
        setIsModalOpen(true);
    }

    function openCreateModal() {
        setEditingFilament(null);
        setIsModalOpen(true);
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Layers className="w-8 h-8 text-blue-500" />
                        Filaments
                    </h1>
                    <p className="text-slate-400">Gérez votre stock de filaments et leurs coûts.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Nouveau Filament
                </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/80 text-xs uppercase font-medium text-slate-300">
                        <tr>
                            <th className="px-6 py-4">Nom</th>
                            <th className="px-6 py-4">Marque</th>
                            <th className="px-6 py-4">Matériau</th>
                            <th className="px-6 py-4">Densité (g/cm³)</th>
                            <th className="px-6 py-4">Diamètre (mm)</th>
                            <th className="px-6 py-4">Poids (g)</th>
                            <th className="px-6 py-4">Prix (€)</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Chargement...</td>
                            </tr>
                        ) : filaments.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Aucun filament enregistré.</td>
                            </tr>
                        ) : (
                            filaments.map((filament) => (
                                <tr key={filament.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{filament.name}</td>
                                    <td className="px-6 py-4">{filament.brand || "-"}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs border border-slate-700">
                                            {filament.material}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{filament.density}</td>
                                    <td className="px-6 py-4">{filament.diameter}</td>
                                    <td className="px-6 py-4">{filament.weight}g</td>
                                    <td className="px-6 py-4 text-green-400">{filament.price.toFixed(2)} €</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(filament)}
                                                className="text-slate-500 hover:text-white transition-colors"
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => handleDelete(filament.id)}
                                                className="text-slate-500 hover:text-red-500 transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <FilamentModal
                    filament={editingFilament}
                    onClose={() => {
                        setIsModalOpen(false);
                        loadFilaments();
                    }}
                />
            )}
        </main>
    );
}

function FilamentModal({ filament, onClose }: { filament: Filament | null, onClose: () => void }) {
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // Handle defaults if empty
        if (!formData.get("density")) formData.set("density", "1.24");
        if (!formData.get("diameter")) formData.set("diameter", "1.75");

        if (filament) {
            await updateFilament(filament.id, formData);
        } else {
            await createFilament(formData);
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">
                        {filament ? "Modifier le Filament" : "Ajouter un Filament"}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nom du filament</label>
                        <input
                            name="name"
                            required
                            defaultValue={filament?.name}
                            placeholder="Ex: PLA Noir Basic"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Marque</label>
                            <input
                                name="brand"
                                defaultValue={filament?.brand || ""}
                                placeholder="Ex: Sunlu"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Matériau</label>
                            <select
                                name="material"
                                defaultValue={filament?.material || "PLA"}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="PLA">PLA</option>
                                <option value="PETG">PETG</option>
                                <option value="ABS">ABS</option>
                                <option value="TPU">TPU</option>
                                <option value="ASA">ASA</option>
                                <option value="Other">Autre</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Densité (g/cm³)</label>
                            <input
                                name="density"
                                type="number"
                                step="0.01"
                                defaultValue={filament?.density || "1.24"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Diamètre (mm)</label>
                            <input
                                name="diameter"
                                type="number"
                                step="0.01"
                                defaultValue={filament?.diameter || "1.75"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Poids bobine (g)</label>
                            <input
                                name="weight"
                                type="number"
                                defaultValue={filament?.weight || "1000"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Prix (€)</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                required
                                defaultValue={filament?.price}
                                placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors">
                            Annuler
                        </button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
