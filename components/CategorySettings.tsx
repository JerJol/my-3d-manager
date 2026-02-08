"use client";

import { useState, useEffect } from "react";
import { Tag, Plus, Trash2 } from "lucide-react";
import { getCategories, createCategory, deleteCategory } from "@/app/actions";

export default function CategorySettings() {
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    async function loadCategories() {
        const cats = await getCategories();
        setCategories(cats);
        setIsLoading(false);
    }

    async function handleAddCategory(e: React.FormEvent) {
        e.preventDefault();
        if (!newCategory.trim()) return;

        setIsAdding(true);
        const result = await createCategory(newCategory.trim());
        if (result.success) {
            setNewCategory("");
            loadCategories();
        } else {
            alert(result.error);
        }
        setIsAdding(false);
    }

    async function handleDeleteCategory(id: number) {
        if (!confirm("Supprimer cette catégorie ? Cela ne supprimera pas les projets associés.")) return;

        const result = await deleteCategory(id);
        if (result.success) {
            loadCategories();
        } else {
            alert(result.error);
        }
    }

    if (isLoading) return <div className="animate-pulse h-20 bg-slate-900 border border-slate-800 rounded-xl" />;

    return (
        <div className="flex items-start gap-4 py-6 border-t border-slate-800">
            <div className="p-3 bg-green-500/10 rounded-lg">
                <Tag className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1 space-y-4">
                <h2 className="text-lg font-medium text-white">Catégories de projet</h2>
                <p className="text-sm text-slate-400">
                    Gérez les catégories disponibles pour classer vos projets sur la page d'accueil.
                </p>

                <form onSubmit={handleAddCategory} className="flex gap-2 max-w-md">
                    <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Nouvelle catégorie (ex: Jeux de société, Déco...)"
                    />
                    <button
                        type="submit"
                        disabled={isAdding}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </button>
                </form>

                <div className="flex flex-wrap gap-2 pt-2">
                    {categories.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Aucune catégorie définie.</p>
                    ) : (
                        categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full group"
                            >
                                <span className="text-sm text-slate-200">{cat.name}</span>
                                <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="text-slate-500 hover:text-red-400 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
