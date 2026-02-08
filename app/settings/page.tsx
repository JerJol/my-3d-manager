"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Zap, Layers, FolderOpen } from "lucide-react";
import { getAppConfig, updateAppConfig, getFilaments, getPrinters, pickFolder } from "@/app/actions";
import CategorySettings from "@/components/CategorySettings";

interface Filament { id: number; name: string; }
interface Printer { id: number; name: string; }

export default function SettingsPage() {
    const [elecPrice, setElecPrice] = useState("");
    const [defaultFilament, setDefaultFilament] = useState("");
    const [defaultPrinter, setDefaultPrinter] = useState("");
    const [defaultStlFolder, setDefaultStlFolder] = useState("");

    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        const [price, defFil, defPrint, defFolder, fils, prints] = await Promise.all([
            getAppConfig("ELECTRICITY_PRICE"),
            getAppConfig("DEFAULT_FILAMENT_ID"),
            getAppConfig("DEFAULT_PRINTER_ID"),
            getAppConfig("DEFAULT_STL_FOLDER"),
            getFilaments(),
            getPrinters()
        ]);

        setElecPrice(price || "0");
        setDefaultFilament(defFil || "");
        setDefaultPrinter(defPrint || "");
        setDefaultStlFolder(defFolder || "");
        setFilaments(fils || []);
        setPrinters(prints || []);

        setIsLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        await Promise.all([
            updateAppConfig("ELECTRICITY_PRICE", elecPrice),
            updateAppConfig("DEFAULT_FILAMENT_ID", defaultFilament),
            updateAppConfig("DEFAULT_PRINTER_ID", defaultPrinter),
            updateAppConfig("DEFAULT_STL_FOLDER", defaultStlFolder)
        ]);
        setIsSaving(false);
        setMessage("Paramètres enregistrés !");
        setTimeout(() => setMessage(""), 3000);
    }

    if (isLoading) return <div className="p-8 text-slate-400">Chargement...</div>;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-500" />
                    Paramètres
                </h1>
                <p className="text-slate-400">Configuration globale de l'application.</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                    <div className="flex items-start gap-4 pb-6 border-b border-slate-800">
                        <div className="p-3 bg-yellow-500/10 rounded-lg">
                            <Zap className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-white">Coûts Électriques</h2>
                            <p className="text-sm text-slate-400">
                                Définissez le coût du kWh pour calculer la consommation de vos impressions.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Prix du kWh (€)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={elecPrice}
                                    onChange={(e) => setElecPrice(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="0.20"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 py-2 border-b border-slate-800 pb-6">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Layers className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-white">Projets par défaut</h2>
                            <p className="text-sm text-slate-400">
                                Sélectionnez le filament et l'imprimante par défaut pour chaque nouveau projet créé.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Filament par défaut</label>
                                    <select
                                        value={defaultFilament}
                                        onChange={(e) => setDefaultFilament(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 [&>option]:bg-slate-950"
                                    >
                                        <option value="">Aucun</option>
                                        {filaments.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Imprimante par défaut</label>
                                    <select
                                        value={defaultPrinter}
                                        onChange={(e) => setDefaultPrinter(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 [&>option]:bg-slate-950"
                                    >
                                        <option value="">Aucune</option>
                                        {printers.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 py-6 border-b border-slate-800 pb-6">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <FolderOpen className="w-6 h-6 text-purple-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-white">Dossier STL par défaut</h2>
                            <p className="text-sm text-slate-400">
                                Le dossier qui s'ouvrira par défaut lors de la sélection du chemin local d'un projet.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Chemin du dossier</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={defaultStlFolder}
                                        onChange={(e) => setDefaultStlFolder(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="C:\Users\...\STL"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const result = await pickFolder(defaultStlFolder);
                                            if (result.success && result.path) {
                                                setDefaultStlFolder(result.path);
                                            }
                                        }}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium border border-slate-700 whitespace-nowrap"
                                    >
                                        Parcourir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Enregistrement..." : "Enregistrer"}
                        </button>
                        {message && <span className="text-green-400 text-sm">{message}</span>}
                    </div>
                </form>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <CategorySettings />
            </div>
        </main>
    );
}
