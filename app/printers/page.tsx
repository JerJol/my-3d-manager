"use client";

import { useState, useEffect } from "react";
import { Printer as PrinterIcon, Plus, Trash } from "lucide-react";
import { getPrinters, createPrinter, updatePrinter, deletePrinter } from "@/app/actions";

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
        const data = await getPrinters();
        setPrinters(data);
        setIsLoading(false);
    }

    async function handleDelete(id: number) {
        if (confirm("Supprimer cette imprimante ?")) {
            await deletePrinter(id);
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <PrinterIcon className="w-8 h-8 text-blue-500" />
                        Imprimantes
                    </h1>
                    <p className="text-slate-400">Gérez vos imprimantes et leurs coûts d'utilisation.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Nouvelle Imprimante
                </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/80 text-xs uppercase font-medium text-slate-300">
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
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Chargement...</td>
                            </tr>
                        ) : printers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Aucune imprimante enregistrée.</td>
                            </tr>
                        ) : (
                            printers.map((printer) => (
                                <tr key={printer.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{printer.name}</td>
                                    <td className="px-6 py-4">{printer.model || "-"}</td>
                                    <td className="px-6 py-4">{printer.powerConsumptionW} W</td>
                                    <td className="px-6 py-4 text-green-400">{printer.machineHourlyCost.toFixed(2)} €/h</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(printer)}
                                                className="text-slate-500 hover:text-white transition-colors"
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => handleDelete(printer.id)}
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
    const [purchasePrice, setPurchasePrice] = useState(printer?.purchasePrice || 0);
    const [lifespanHours, setLifespanHours] = useState(printer?.lifespanHours || 0);
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
        const formData = new FormData(e.currentTarget);
        // Ensure the computed value is sent
        formData.set("machineHourlyCost", hourlyCost.toString());

        if (printer) {
            await updatePrinter(printer.id, formData);
        } else {
            await createPrinter(formData);
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">
                        {printer ? "Modifier l'Imprimante" : "Ajouter une Imprimante"}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nom de l'imprimante</label>
                        <input
                            name="name"
                            required
                            defaultValue={printer?.name}
                            placeholder="Ex: Ma Bambu Lab"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Modèle</label>
                        <input
                            name="model"
                            defaultValue={printer?.model || ""}
                            placeholder="Ex: X1 Carbon"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Prix d'achat (€)</label>
                            <input
                                name="purchasePrice"
                                type="number"
                                step="0.01"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Durée de vie (h)</label>
                            <input
                                name="lifespanHours"
                                type="number"
                                value={lifespanHours}
                                onChange={(e) => setLifespanHours(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Maintenance (€)</label>
                            <input
                                name="maintenanceCost"
                                type="number"
                                step="0.01"
                                value={maintenanceCost}
                                onChange={(e) => setMaintenanceCost(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Conso. (W)</label>
                            <input
                                name="powerConsumptionW"
                                type="number"
                                defaultValue={printer?.powerConsumptionW || "0"}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-blue-400 text-slate-300">Coût machine calculé :</span>
                            <span className="text-lg font-bold text-blue-400">{hourlyCost.toFixed(4)} €/h</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Formule: (Achat + Maintenance) / Durée de vie</p>
                        <input type="hidden" name="machineHourlyCost" value={hourlyCost} />
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
