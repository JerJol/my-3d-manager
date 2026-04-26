import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash, Layers, X } from "lucide-react";
import * as db from "../lib/db";

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
        const data = await db.getFilaments();
        setFilaments(data);
        setIsLoading(false);
    }

    async function handleDelete(id: number) {
        if (confirm("Supprimer ce filament ?")) {
            await db.deleteFilament(id);
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-2 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Retour au tableau de bord
                    </Link>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Layers className="w-8 h-8 text-blue-500" />
                        Filaments
                    </h1>
                    <p className="text-slate-400">Gérez votre stock de filaments et leurs coûts.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Nouveau Filament
                </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800/50 text-xs uppercase font-bold text-slate-300 tracking-wider">
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
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        </div>
                                        Chargement...
                                    </td>
                                </tr>
                            ) : filaments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">Aucun filament enregistré.</td>
                                </tr>
                            ) : (
                                filaments.map((filament) => (
                                    <tr key={filament.id} className="hover:bg-blue-500/5 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-white">{filament.name}</td>
                                        <td className="px-6 py-4">{filament.brand || "-"}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                                {filament.material}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono">{filament.density}</td>
                                        <td className="px-6 py-4 font-mono">{filament.diameter}</td>
                                        <td className="px-6 py-4 font-mono">{filament.weight}g</td>
                                        <td className="px-6 py-4 text-green-400 font-bold">{filament.price.toFixed(2)} €</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(filament)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Modifier
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(filament.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
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
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);

        const data = {
            name: formData.get("name"),
            brand: formData.get("brand"),
            material: formData.get("material"),
            density: formData.get("density") || "1.24",
            diameter: formData.get("diameter") || "1.75",
            weight: formData.get("weight") || "1000",
            price: formData.get("price"),
            color: formData.get("color")
        };

        try {
            if (filament) {
                await db.updateFilament(filament.id, data);
            } else {
                await db.createFilament(data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save filament:", error);
            alert("Erreur lors de l'enregistrement.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/10">
                    <h2 className="text-xl font-bold text-white">
                        {filament ? "Modifier le Filament" : "Ajouter un Filament"}
                    </h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nom du filament</label>
                        <input
                            name="name"
                            required
                            autoFocus
                            defaultValue={filament?.name}
                            placeholder="Ex: PLA Noir Basic"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marque</label>
                            <input
                                name="brand"
                                defaultValue={filament?.brand || ""}
                                placeholder="Ex: Sunlu"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Matériau</label>
                            <select
                                name="material"
                                defaultValue={filament?.material || "PLA"}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
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
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Densité (g/cm³)</label>
                            <input
                                name="density"
                                type="number"
                                step="0.01"
                                defaultValue={filament?.density || "1.24"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Diamètre (mm)</label>
                            <input
                                name="diameter"
                                type="number"
                                step="0.01"
                                defaultValue={filament?.diameter || "1.75"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Poids bobine (g)</label>
                            <input
                                name="weight"
                                type="number"
                                defaultValue={filament?.weight || "1000"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prix (€)</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                required
                                defaultValue={filament?.price}
                                placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700">
                            Annuler
                        </button>
                        <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
                            {isLoading ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
