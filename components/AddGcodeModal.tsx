"use client";

import { uploadGcode } from "@/app/actions";
import { Upload, X, FileCode } from "lucide-react";
import { useState } from "react";

export default function AddGcodeModal({
    stlId,
    onClose
}: {
    stlId: number;
    onClose: () => void
}) {
    const [isUploading, setIsUploading] = useState(false);

    const [mode, setMode] = useState<"upload" | "link">("upload");

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
                        Upload
                    </button>
                    <button
                        onClick={() => setMode("link")}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "link" ? "bg-green-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                        Lien Local
                    </button>
                </div>

                <form action={async (formData) => {
                    setIsUploading(true);
                    formData.append("stlId", stlId.toString());

                    try {
                        const result = await uploadGcode(formData);
                        if (result?.success) {
                            onClose();
                        } else {
                            alert("Erreur: " + (result?.error || "Inconnue"));
                        }
                    } catch (e) {
                        console.error(e);
                        alert("Erreur réseau");
                    } finally {
                        setIsUploading(false);
                    }
                }} className="space-y-6">

                    {mode === "upload" ? (
                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-green-500/50 transition-colors group cursor-pointer relative">
                            <input
                                type="file"
                                name="file"
                                accept=".gcode,.gco"
                                required
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="text-slate-400 group-hover:text-green-400">
                                <Upload className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-medium">Cliquez pour sélectionner</p>
                                <p className="text-xs text-slate-500 mt-1">Fichiers .gcode uniquement</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Chemin du fichier local</label>
                            <input
                                type="text"
                                name="localPath"
                                placeholder="D:\MesModeles\print.gcode"
                                required
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                            />
                            <p className="text-xs text-slate-500">
                                Le fichier ne sera pas copié, seul le lien sera sauvegardé.
                            </p>
                        </div>
                    )}

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
                            disabled={isUploading}
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
