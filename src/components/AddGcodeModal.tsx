import { X, FileCode } from "lucide-react";
import { useState } from "react";

const electron = (window as any).electron;

interface AddGcodeModalProps {
    onClose: () => void;
    onSuccess: (data: { name: string; path: string; printTime: number; filamentLen: number }) => void;
}

export default function AddGcodeModal({
    onClose,
    onSuccess
}: AddGcodeModalProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [mode, setMode] = useState<"upload" | "link">("upload");
    const [localPath, setLocalPath] = useState("");

    const handlePickFile = async () => {
        const selected = await electron.showOpenDialog({
            multiple: false,
            filters: [{ name: 'G-code', extensions: ['gcode', 'gco'] }],
            properties: ['openFile']
        });
        if (selected) {
            setLocalPath(selected);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);
        try {
            if (!localPath) {
                alert("Veuillez sélectionner un fichier.");
                return;
            }

            const metadata = await electron.getFileMetadata(localPath);
            if (!metadata) {
                alert("Impossible d'extraire les métadonnées du fichier.");
                return;
            }

            const name = localPath.split(/[\\/]/).pop() || "unknown";

            onSuccess({
                name,
                path: localPath,
                printTime: metadata.printTime || 0,
                filamentLen: metadata.filamentLen || 0
            });
            onClose();
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                    <FileCode className="w-6 h-6 text-green-500" />
                    Ajouter un G-code
                </h2>

                <div className="flex gap-2 mb-6 p-1 bg-slate-800 rounded-lg">
                    <button
                        onClick={() => setMode("upload")}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "upload" ? "bg-green-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                        Analyse Locale
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Fichier G-code</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={localPath}
                                readOnly
                                placeholder="Sélectionnez un fichier..."
                                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={handlePickFile}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            >
                                Parcourir
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Le fichier sera analysé pour extraire le temps d'impression et la longueur de filament.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !localPath}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                        >
                            {isUploading ? "Lecture..." : "Analyser & Sauvegarder"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
