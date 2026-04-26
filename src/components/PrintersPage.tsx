import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Printer as PrinterIcon, Plus, Trash, ArrowLeft, X } from "lucide-react";
import * as db from "../lib/db";

interface Printer {
    id: number;
    name: string;
    model: string | null;
    powerConsumptionW: number;
    machineHourlyCost: number;
    purchasePrice: number;
    lifespanHours: number;
    maintenanceCost: number;
}

export default function PrintersPage() {
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPrinters();
    }, []);

    async function loadPrinters() {
        const data = await db.getPrinters();
        setPrinters(data);
        setIsLoading(false);
    }

    async function handleDelete(id: number) {
        if (confirm("Supprimer cette imprimante ?")) {
            await db.deletePrinter(id);
            loadPrinters();
        }
    }

    function openEditModal(printer: Printer) {
        setEditingPrinter(printer);
        setIsModalOpen(true);
    }

    function openCreateModal() {
        setEditingPrinter(null);
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
                        <PrinterIcon className="w-8 h-8 text-orange-500" />
                        Imprimantes
                    </h1>
                    <p className="text-slate-400">Gérez vos imprimantes et leurs coûts d'utilisation.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-orange-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Nouvelle Imprimante
                </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800/50 text-xs uppercase font-bold text-slate-300 tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Nom</th>
                                <th className="px-6 py-4">Modèle</th>
                                <th className="px-6 py-4">Conso. (W)</th>
                                <th className="px-6 py-4">Coût machine (€/h)</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        </div>
                                        Chargement...
                                    </td>
                                </tr>
                            ) : printers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Aucune imprimante enregistrée.</td>
                                </tr>
                            ) : (
                                printers.map((printer) => (
                                    <tr key={printer.id} className="hover:bg-orange-500/5 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-white">{printer.name}</td>
                                        <td className="px-6 py-4">{printer.model || "-"}</td>
                                        <td className="px-6 py-4 font-mono">{printer.powerConsumptionW} W</td>
                                        <td className="px-6 py-4 text-green-400 font-bold font-mono">{printer.machineHourlyCost.toFixed(2)} €/h</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(printer)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Modifier
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(printer.id)}
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
                <PrinterModal
                    printer={editingPrinter}
                    onClose={() => {
                        setIsModalOpen(false);
                        loadPrinters();
                    }}
                />
            )}
        </main>
    );
}

function PrinterModal({ printer, onClose }: { printer: Printer | null, onClose: () => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [purchasePrice, setPurchasePrice] = useState(printer?.purchasePrice || 0);
    const [lifespanHours, setLifespanHours] = useState(printer?.lifespanHours || 5000);
    const [maintenanceCost, setMaintenanceCost] = useState(printer?.maintenanceCost || 0);
    const [hourlyCost, setHourlyCost] = useState(printer?.machineHourlyCost || 0);

    // Update hourly cost when inputs change
    useEffect(() => {
        if (lifespanHours > 0) {
            const calculated = (purchasePrice + maintenanceCost) / lifespanHours;
            setHourlyCost(Number(calculated.toFixed(4)));
        } else {
            setHourlyCost(0);
        }
    }, [purchasePrice, lifespanHours, maintenanceCost]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);

        const data = {
            name: formData.get("name"),
            model: formData.get("model"),
            powerConsumptionW: formData.get("powerConsumptionW") || "0",
            machineHourlyCost: hourlyCost.toString(),
            purchasePrice: purchasePrice.toString(),
            lifespanHours: lifespanHours.toString(),
            maintenanceCost: maintenanceCost.toString()
        };

        try {
            if (printer) {
                await db.updatePrinter(printer.id, data);
            } else {
                await db.createPrinter(data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save printer:", error);
            alert("Erreur lors de l'enregistrement.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/10">
                    <h2 className="text-xl font-bold text-white">
                        {printer ? "Modifier l'Imprimante" : "Ajouter une Imprimante"}
                    </h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nom de l'imprimante</label>
                        <input
                            name="name"
                            required
                            autoFocus
                            defaultValue={printer?.name}
                            placeholder="Ex: Ma Bambu Lab"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Modèle</label>
                        <input
                            name="model"
                            defaultValue={printer?.model || ""}
                            placeholder="Ex: X1 Carbon"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prix d'achat (€)</label>
                            <input
                                name="purchasePrice"
                                type="number"
                                step="0.01"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Durée de vie (h)</label>
                            <input
                                name="lifespanHours"
                                type="number"
                                value={lifespanHours}
                                onChange={(e) => setLifespanHours(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Maintenance (€)</label>
                            <input
                                name="maintenanceCost"
                                type="number"
                                step="0.01"
                                value={maintenanceCost}
                                onChange={(e) => setMaintenanceCost(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conso. (W)</label>
                            <input
                                name="powerConsumptionW"
                                type="number"
                                defaultValue={printer?.powerConsumptionW || "0"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Coût machine calculé</span>
                            <span className="text-xl font-black text-orange-400 font-mono">{hourlyCost.toFixed(3)} €/h</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic opacity-80 leading-relaxed font-serif">Formule : (Achat + Maintenance) / Durée de vie</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700">
                            Annuler
                        </button>
                        <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50">
                            {isLoading ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
