import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, Save, Zap, Layers, FolderOpen, ArrowLeft, Search } from "lucide-react";
import * as db from "../lib/db";
import CategorySettings from "./CategorySettings";

const electron = (window as any).electron;

interface Filament { id: number; name: string; }
interface Printer { id: number; name: string; }

export default function SettingsPage() {
    const [elecPrice, setElecPrice] = useState("");
    const [defaultFilament, setDefaultFilament] = useState("");
    const [defaultPrinter, setDefaultPrinter] = useState("");
    const [defaultStlFolder, setDefaultStlFolder] = useState("");
    const [defaultExportFolder, setDefaultExportFolder] = useState("");
    const [storagePath, setStoragePath] = useState("");
    const [oldStoragePath, setOldStoragePath] = useState("");

    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [isConsolidating, setIsConsolidating] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        const [price, defFil, defPrint, defFolder, defExport, storePath, fils, prints] = await Promise.all([
            db.getAppConfig("ELECTRICITY_PRICE"),
            db.getAppConfig("DEFAULT_FILAMENT_ID"),
            db.getAppConfig("DEFAULT_PRINTER_ID"),
            db.getAppConfig("DEFAULT_STL_FOLDER"),
            db.getAppConfig("DEFAULT_EXPORT_FOLDER"),
            db.getAppConfig("STORAGE_PATH"),
            db.getFilaments(),
            db.getPrinters()
        ]);

        setElecPrice(price || "0.22");
        setDefaultFilament(defFil || "");
        setDefaultPrinter(defPrint || "");
        setDefaultStlFolder(defFolder || "");
        setDefaultExportFolder(defExport || "");

        const actualStorePath = storePath || await electron.getUserDataPath();
        setStoragePath(actualStorePath);
        setOldStoragePath(actualStorePath);
        setFilaments(fils || []);
        setPrinters(prints || []);

        setIsLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Check if storage path changed
            if (storagePath !== oldStoragePath && oldStoragePath !== "") {
                const dbExists = await electron.checkDbExists(storagePath);

                if (dbExists) {
                    const confirmSwitch = confirm(
                        "Une base de données a été détectée dans le nouveau dossier.\n\n" +
                        "Souhaitez-vous basculer sur ces données ? (Aucune copie ne sera effectuée)"
                    );

                    if (confirmSwitch) {
                        setMessage("Basculement des données...");
                        const res = await db.migrateProjectsStorage(oldStoragePath, storagePath, false);
                        if (!res.success) {
                            alert("Erreur lors du basculement : " + res.error);
                            return;
                        }
                        setOldStoragePath(storagePath);
                        setMessage("Basculement terminé !");
                    } else {
                        return; // Cancel save
                    }
                } else {
                    const confirmMigration = confirm(
                        "Le nouveau dossier est vide ou ne contient pas de base de données.\n\n" +
                        "Souhaitez-vous déplacer vos données actuelles (PROJETS + IMAGES + BDD) vers ce nouvel emplacement ?\n\n" +
                        "Si vous refusez, une nouvelle base de données sera créée dans ce dossier."
                    );

                    setMessage(confirmMigration ? "Migration des données..." : "Initialisation du nouveau dossier...");
                    const res = await db.migrateProjectsStorage(oldStoragePath, storagePath, confirmMigration);
                    if (!res.success) {
                        alert("Erreur : " + res.error);
                        return;
                    }
                    setOldStoragePath(storagePath);
                    setMessage(confirmMigration ? "Migration terminée !" : "Nouveau dossier prêt !");
                }
            }

            await Promise.all([
                db.updateAppConfig("ELECTRICITY_PRICE", elecPrice),
                db.updateAppConfig("DEFAULT_FILAMENT_ID", defaultFilament),
                db.updateAppConfig("DEFAULT_PRINTER_ID", defaultPrinter),
                db.updateAppConfig("DEFAULT_STL_FOLDER", defaultStlFolder),
                db.updateAppConfig("DEFAULT_EXPORT_FOLDER", defaultExportFolder),
                db.updateAppConfig("STORAGE_PATH", storagePath)
            ]);
            setMessage("Paramètres enregistrés !");
            setTimeout(() => setMessage(""), 3000);
        } catch (error) {
            console.error("Save Error:", error);
            alert("Erreur lors de l'enregistrement");
        } finally {
            setIsSaving(false);
        }
    }

    const handleConsolidate = async () => {
        if (!confirm("Voulez-vous copier toutes vos images liées vers le dossier de stockage interne ? Cela permettra d'avoir toutes vos photos au même endroit.")) return;

        setIsConsolidating(true);
        try {
            const res = await db.consolidateProjectImages();
            if (res.success) {
                alert(`${res.count} images ont été consolidées avec succès !`);
            } else {
                alert("Erreur lors de la consolidation : " + res.error);
            }
        } catch (e) {
            alert("Erreur imprévue lors de la consolidation.");
        } finally {
            setIsConsolidating(false);
        }
    };

    const handlePickFolder = async (setter: (val: string) => void) => {
        const res = await electron.showOpenDialog({ properties: ['openDirectory'] });
        if (res) setter(res);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">Chargement des paramètres...</p>
        </div>
    );

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
            <div className="space-y-1">
                <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-2 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au tableau de bord
                </Link>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <Settings className="w-8 h-8 text-primary font-black" />
                    Paramètres
                </h1>
                <p className="text-muted-foreground">Configuration globale de l'application.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div className="flex items-start gap-4 pb-8 border-b border-border/50">
                            <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                                <Zap className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <h2 className="text-lg font-bold text-foreground tracking-tight">Coûts Électriques</h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Définissez le coût du kWh pour calculer précisément la part électrique de vos impressions.
                                </p>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Prix du kWh (€)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={elecPrice}
                                        onChange={(e) => setElecPrice(e.target.value)}
                                        className="w-full bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-foreground font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                                        placeholder="0.22"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 pb-8 border-b border-border/50">
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Layers className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <h2 className="text-lg font-bold text-foreground tracking-tight">Réglages par défaut</h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Ces options seront automatiquement sélectionnées pour chaque nouveau projet créé.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Filament</label>
                                        <select
                                            value={defaultFilament}
                                            onChange={(e) => setDefaultFilament(e.target.value)}
                                            className="w-full bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer appearance-none"
                                        >
                                            <option value="" className="bg-slate-900">Aucun par défaut</option>
                                            {filaments.map(f => (
                                                <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Imprimante</label>
                                        <select
                                            value={defaultPrinter}
                                            onChange={(e) => setDefaultPrinter(e.target.value)}
                                            className="w-full bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer appearance-none"
                                        >
                                            <option value="" className="bg-slate-900">Aucune par défaut</option>
                                            {printers.map(p => (
                                                <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 pb-4">
                            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                                <FolderOpen className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <h2 className="text-lg font-bold text-foreground tracking-tight">Dossiers & Scan</h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Configurez les chemins système pour l'automatisation.
                                </p>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Dossier STL source (Bibliothèque)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={defaultStlFolder}
                                                onChange={(e) => setDefaultStlFolder(e.target.value)}
                                                className="flex-1 bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-xs text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                placeholder="C:\Users\JJ\3DPrints"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handlePickFolder(setDefaultStlFolder)}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-border/50 rounded-xl text-primary transition-all"
                                            >
                                                <Search className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Lecteur Export (SD Card)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={defaultExportFolder}
                                                onChange={(e) => setDefaultExportFolder(e.target.value)}
                                                className="flex-1 bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-xs text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                placeholder="E:\ (SD Card)"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handlePickFolder(setDefaultExportFolder)}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-border/50 rounded-xl text-primary transition-all"
                                            >
                                                <Search className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-mono">Stockage des fichiers & images (App Data)</label>
                                            {storagePath.includes('AppData') ? (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded uppercase font-bold">Défaut</span>
                                            ) : (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded uppercase font-bold tracking-tighter flex items-center gap-1">
                                                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                                                    Persistant
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={storagePath}
                                                onChange={(e) => setStoragePath(e.target.value)}
                                                className="flex-1 bg-background/50 border border-border/60 rounded-xl px-4 py-3 text-xs text-muted-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                placeholder="D:\MonStockage3D"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handlePickFolder(setStoragePath)}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-border/50 rounded-xl text-primary transition-all"
                                            >
                                                <Search className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] text-muted-foreground italic">Inclut : Base de données, Photos, STL projets.</p>
                                            <button
                                                type="button"
                                                onClick={handleConsolidate}
                                                disabled={isConsolidating}
                                                className="text-[9px] font-bold text-primary hover:underline uppercase tracking-tighter disabled:opacity-50"
                                            >
                                                {isConsolidating ? "Consolidation..." : "Consolider mes médias existants"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-8 py-3 bg-primary hover:bg-blue-600 text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {isSaving ? "Sauvegarde..." : "Enregistrer"}
                            </button>
                            {message && (
                                <span className="text-green-500 font-bold text-sm animate-in slide-in-from-left-4 duration-300">
                                    {message}
                                </span>
                            )}
                        </div>
                    </form>
                </div>

                <div className="space-y-8">
                    <CategorySettings />

                    <div className="p-8 bg-slate-900/40 border border-border/50 rounded-2xl space-y-4">
                        <h3 className="font-bold text-slate-300 flex items-center gap-2">
                            <div className="w-1 h-4 bg-orange-500 rounded-full" />
                            À propos
                        </h3>
                        <div className="space-y-2">
                            <p className="text-sm text-slate-400 leading-relaxed">3D printer manager - Electron Edition</p>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                                <span className="px-1.5 py-0.5 bg-slate-800 rounded">v0.1.0-alpha</span>
                                <span className="px-1.5 py-0.5 bg-slate-800 rounded">Beta Testing</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
