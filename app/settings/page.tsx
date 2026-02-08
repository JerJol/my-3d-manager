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
    const [defaultExportFolder, setDefaultExportFolder] = useState("");

    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        const [price, defFil, defPrint, defFolder, defExport, fils, prints] = await Promise.all([
            getAppConfig("ELECTRICITY_PRICE"),
            getAppConfig("DEFAULT_FILAMENT_ID"),
            getAppConfig("DEFAULT_PRINTER_ID"),
            getAppConfig("DEFAULT_STL_FOLDER"),
            getAppConfig("DEFAULT_EXPORT_FOLDER"),
            getFilaments(),
            getPrinters()
        ]);

        setElecPrice(price || "0");
        setDefaultFilament(defFil || "");
        setDefaultPrinter(defPrint || "");
        setDefaultStlFolder(defFolder || "");
        setDefaultExportFolder(defExport || "");
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
            updateAppConfig("DEFAULT_STL_FOLDER", defaultStlFolder),
            updateAppConfig("DEFAULT_EXPORT_FOLDER", defaultExportFolder)
        ]);
        setIsSaving(false);
        setMessage("Paramètres enregistrés !");
        setTimeout(() => setMessage(""), 3000);
    }

    if (isLoading) return <div className="p-8 text-muted-foreground">Chargement...</div>;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <Settings className="w-8 h-8 text-primary" />
                    Paramètres
                </h1>
                <p className="text-muted-foreground">Configuration globale de l'application.</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
                <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                    <div className="flex items-start gap-4 pb-6 border-b border-border">
                        <div className="p-3 bg-yellow-500/10 rounded-lg">
                            <Zap className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-foreground">Coûts Électriques</h2>
                            <p className="text-sm text-muted-foreground">
                                Définissez le coût du kWh pour calculer la consommation de vos impressions.
                            </p>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Prix du kWh (€)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={elecPrice}
                                    onChange={(e) => setElecPrice(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                    placeholder="0.20"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 pb-6 border-b border-border">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Layers className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-foreground">Favoris par défaut</h2>
                            <p className="text-sm text-muted-foreground">
                                Ces réglages seront appliqués automatiquement aux nouveaux projets.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Filament par défaut</label>
                                    <select
                                        value={defaultFilament}
                                        onChange={(e) => setDefaultFilament(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                    >
                                        <option value="">Aucun</option>
                                        {filaments.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Imprimante par défaut</label>
                                    <select
                                        value={defaultPrinter}
                                        onChange={(e) => setDefaultPrinter(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
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

                    <div className="flex items-start gap-4 pb-6">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <FolderOpen className="w-6 h-6 text-green-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h2 className="text-lg font-medium text-foreground">Gestion des Dossiers</h2>
                            <p className="text-sm text-muted-foreground">
                                Chemins locaux pour le scan automatique et l'exportation.
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Dossier STL source</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={defaultStlFolder}
                                            onChange={(e) => setDefaultStlFolder(e.target.value)}
                                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                                            placeholder="C:\Mes3D\STLs"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const res = await pickFolder(defaultStlFolder);
                                                if (res.success && res.path) setDefaultStlFolder(res.path);
                                            }}
                                            className="px-3 py-2 bg-card hover:bg-white/5 border border-border rounded-lg text-sm text-foreground transition-colors"
                                        >
                                            ...
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Dossier Export (Carte SD)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={defaultExportFolder}
                                            onChange={(e) => setDefaultExportFolder(e.target.value)}
                                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                                            placeholder="E: (Lecteur SD)"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const res = await pickFolder(defaultExportFolder);
                                                if (res.success && res.path) setDefaultExportFolder(res.path);
                                            }}
                                            className="px-3 py-2 bg-card hover:bg-white/5 border border-border rounded-lg text-sm text-foreground transition-colors"
                                        >
                                            ...
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-primary hover:bg-blue-600 text-foreground px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
                        </button>
                        {message && (
                            <span className="text-green-500 font-medium animate-in fade-in duration-300">
                                {message}
                            </span>
                        )}
                    </div>
                </form>
            </div>

            <CategorySettings />
        </main>
    );
}
