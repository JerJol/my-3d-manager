import { X, Layers } from "lucide-react";
import { useState } from "react";

interface NewVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string) => void;
    defaultName: string;
}

export default function NewVersionModal({
    isOpen,
    onClose,
    onConfirm,
    defaultName
}: NewVersionModalProps) {
    const [name, setName] = useState(defaultName);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                    <Layers className="w-6 h-6 text-primary" />
                    Nouvelle version
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nom de la version</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="ex: v2, Modifié, etc."
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
                        />
                        <p className="text-xs text-slate-500">
                            Cela créera une copie complète du projet actuel avec ses fichiers et réglages.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold transition-all hover:opacity-90 disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            Créer la version
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
