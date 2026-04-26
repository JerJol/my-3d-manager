import { useState, useEffect } from "react";
import { X, FolderPlus } from "lucide-react";

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string, categoryId: number | null, filamentId: number | null, printerId: number | null) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [filamentId, setFilamentId] = useState<number | null>(null);
    const [printerId, setPrinterId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [categories, setCategories] = useState<any[]>([]);
    const [filaments, setFilaments] = useState<any[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            import("../lib/db").then(async (db) => {
                const [c, f, p] = await Promise.all([
                    db.getCategories(),
                    db.getFilaments(),
                    db.getPrinters()
                ]);
                setCategories(c);
                setFilaments(f);
                setPrinters(p);

                // Set initial defaults from app config or first item
                const defFilamentId = await db.getAppConfig("DEFAULT_FILAMENT_ID");
                const defPrinterId = await db.getAppConfig("DEFAULT_PRINTER_ID");
                if (defFilamentId) setFilamentId(parseInt(defFilamentId));
                else if (f.length > 0) setFilamentId(f[0].id);

                if (defPrinterId) setPrinterId(parseInt(defPrinterId));
                else if (p.length > 0) setPrinterId(p[0].id);

                if (c.length > 0) setCategoryId(c[0].id);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onCreate(name, description, categoryId, filamentId, printerId);
            setName("");
            setDescription("");
        } catch (error) {
            console.error("Failed to create project:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative animate-in zoom-in duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>

                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary/10 rounded-xl"><FolderPlus className="w-6 h-6 text-primary" /></div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Nouveau Projet</h2>
                        <p className="text-slate-400 text-sm">Commencez une nouvelle aventure d'impression 3D.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="projectName" className="text-sm font-medium text-slate-300 ml-1">Nom du projet</label>
                        <input id="projectName" type="text" autoFocus placeholder="Ex: Armure Iron Man Mark 85" className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Catégorie</label>
                            <select value={categoryId || ""} onChange={e => setCategoryId(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Imprimante</label>
                            <select value={printerId || ""} onChange={e => setPrinterId(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 ml-1">Filament</label>
                        <select value={filamentId || ""} onChange={e => setFilamentId(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                            {filaments.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="projectDesc" className="text-sm font-medium text-slate-300 ml-1">Description (optionnel)</label>
                        <textarea id="projectDesc" placeholder="Quelques détails sur ce projet..." rows={2} className="w-full bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-slate-700 text-slate-300 rounded-xl font-medium hover:bg-slate-800 transition-colors">Annuler</button>
                        <button type="submit" disabled={!name.trim() || isSubmitting} className="flex-1 px-6 py-3 bg-primary hover:bg-blue-500 text-primary-foreground rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSubmitting ? "Création..." : "Créer le projet"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
