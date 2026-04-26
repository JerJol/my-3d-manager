import React, { useState } from 'react';
import { FolderOpen, Database, PlusCircle, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface SetupWizardProps {
    onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [selectedPath, setSelectedPath] = useState('');
    const [isDbDetected, setIsDbDetected] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState('');

    const electron = (window as any).electron;

    const handlePickFolder = async () => {
        try {
            const path = await electron.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Choisir le dossier de stockage de vos données'
            });

            if (path) {
                setSelectedPath(path);
                const exists = await electron.checkDbExists(path);
                setIsDbDetected(exists);
                setStep(2);
            }
        } catch (err) {
            console.error("Pick folder error:", err);
            setError("Erreur lors de la sélection du dossier.");
        }
    };

    const handleInitialize = async () => {
        setIsInitializing(true);
        setError('');
        try {
            const res = await electron.initStorage(selectedPath);
            if (res.success) {
                onComplete();
            } else {
                setError(res.error || "Erreur d'initialisation");
            }
        } catch (err: any) {
            setError(err.message || "Une erreur est survenue");
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="w-full max-w-xl p-8 bg-slate-900/50 border border-border/80 rounded-3xl shadow-2xl backdrop-blur-md relative overflow-hidden ring-1 ring-white/10">
                {/* Background Gradients */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

                <div className="relative">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 mb-4 animate-bounce-subtle">
                            <Database className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Bienvenue sur <span className="text-primary italic">3D printer manager</span></h1>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">Configurons ensemble l'emplacement de vos précieuses données 3D.</p>
                    </div>

                    <div className="space-y-8 min-h-[300px] flex flex-col justify-center">
                        {step === 1 && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="p-6 rounded-2xl bg-slate-800/30 border border-white/5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                                            <FolderOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Étape 1 : Choisir un dossier</h3>
                                            <p className="text-[11px] text-muted-foreground">Sélectionnez le dossier où seront stockés votre base de données, vos STL et vos photos.</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handlePickFolder}
                                        className="w-full py-4 px-6 bg-white text-black hover:bg-white/90 rounded-2xl font-bold flex items-center justify-center gap-2 group transition-all transform active:scale-95 shadow-lg shadow-white/5"
                                    >
                                        Choisir mon dossier
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <p className="text-[10px] text-center text-muted-foreground/60 italic">Conseil : Un dossier Cloud ou un disque SSD externe est idéal.</p>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="p-6 rounded-2xl bg-slate-800/30 border border-white/5 space-y-6 text-center">
                                    <div className="inline-flex p-3 rounded-full bg-green-500/10 text-green-500 mb-2">
                                        <div className="relative">
                                            <CheckCircle2 className="w-10 h-10" />
                                            <div className="absolute inset-0 animate-ping opacity-20 bg-green-500 rounded-full" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Dossier sélectionné :</p>
                                        <code className="block text-[11px] p-3 bg-black/40 rounded-xl border border-white/10 text-primary font-mono truncate">{selectedPath}</code>
                                    </div>

                                    {isDbDetected ? (
                                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-left flex gap-3 items-start">
                                            <Database className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-bold text-blue-400">Base de données détectée !</p>
                                                <p className="text-[10px] text-blue-400/80">Nous allons importer vos projets et réglages existants.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-left flex gap-3 items-start">
                                            <PlusCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-bold text-emerald-400">Dossier prêt</p>
                                                <p className="text-[10px] text-emerald-400/80">Une nouvelle base de données va être créée dans ce dossier.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all text-xs"
                                        >
                                            Changer de dossier
                                        </button>
                                        <button
                                            onClick={handleInitialize}
                                            disabled={isInitializing}
                                            className="flex-[2] py-4 px-6 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
                                        >
                                            {isInitializing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Initialisation...
                                                </>
                                            ) : (
                                                isDbDetected ? "Importer mes données" : "C'est parti !"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-in shake duration-300">
                                <AlertCircle className="w-5 h-5" />
                                <p className="text-xs font-medium">{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center opacity-40 grayscale group-hover:grayscale-0 transition-all">
                        <div className="text-[9px] uppercase font-mono tracking-widest">Version 3.0.0</div>
                        <div className="flex gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            <div className="w-1 h-1 rounded-full bg-primary" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupWizard;
