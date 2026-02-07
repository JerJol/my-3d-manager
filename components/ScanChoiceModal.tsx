"use client";

import { X, Copy, Link as LinkIcon, Info } from "lucide-react";

interface ScanChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: 'copy' | 'link') => void;
}

export default function ScanChoiceModal({ isOpen, onClose, onSelect }: ScanChoiceModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Info className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Méthode d'importation</h2>
                        <p className="text-slate-400 text-sm">Comment souhaitez-vous gérer les nouveaux fichiers STL ?</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option: Copy */}
                    <button
                        onClick={() => onSelect('copy')}
                        className="flex flex-col items-center text-center p-6 bg-slate-800/40 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
                    >
                        <div className="p-4 bg-blue-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                            <Copy className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Importer (Copier)</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Copie les fichiers dans le dossier de l'application. Recommandé pour la portabilité et la sécurité.
                        </p>
                        <div className="mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-blue-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Stockage Interne
                        </div>
                    </button>

                    {/* Option: Link */}
                    <button
                        onClick={() => onSelect('link')}
                        className="flex flex-col items-center text-center p-6 bg-slate-800/40 border border-slate-700 rounded-xl hover:border-yellow-500 hover:bg-yellow-500/5 transition-all group"
                    >
                        <div className="p-4 bg-yellow-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                            <LinkIcon className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Lier uniquement</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Garde uniquement le chemin vers le dossier original. Plus rapide, mais dépend de l'emplacement du fichier.
                        </p>
                        <div className="mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-yellow-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            Lien Externe
                        </div>
                    </button>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
}
