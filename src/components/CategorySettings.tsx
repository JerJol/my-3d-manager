import { useState, useEffect } from "react";
import { Plus, Trash, Tag, Edit2, Save, X } from "lucide-react";
import * as db from "../lib/db";

export default function CategorySettings() {
    const [categories, setCategories] = useState<any[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadCategories();
    }, []);

    async function loadCategories() {
        const data = await db.getCategories();
        setCategories(data);
        setIsLoading(false);
    }

    async function handleAdd() {
        if (!newCategory.trim()) return;
        await db.createCategory(newCategory.trim());
        setNewCategory("");
        loadCategories();
    }

    async function handleDelete(id: number) {
        if (confirm("Supprimer cette catégorie ?")) {
            await db.deleteCategory(id);
            loadCategories();
        }
    }

    async function handleSaveEdit() {
        if (!editingId || !editingName.trim()) return;
        await db.updateCategory(editingId, editingName.trim());
        setEditingId(null);
        loadCategories();
    }

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-500">
            <div className="px-6 py-4 border-b border-border bg-white/5 flex items-center gap-3">
                <Tag className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-foreground">Gestion des Catégories</h3>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex gap-2">
                    <input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Ex: Figurines, Outils..."
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> Ajouter
                    </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {isLoading ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">Chargement...</div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm italic">Aucune catégorie.</div>
                    ) : (
                        categories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between p-3 bg-background/40 border border-border/50 rounded-xl group hover:border-primary/30 transition-all">
                                {editingId === cat.id ? (
                                    <div className="flex flex-1 gap-2 mr-2">
                                        <input
                                            autoFocus
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-primary/50 rounded-lg px-2 py-1 text-sm outline-none"
                                        />
                                        <button onClick={handleSaveEdit} className="text-green-500 p-1 hover:bg-green-500/10 rounded"><Save className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingId(null)} className="text-red-500 p-1 hover:bg-red-500/10 rounded"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-sm font-medium text-slate-300">{cat.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                                                className="p-1.5 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-lg"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                                            >
                                                <Trash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
