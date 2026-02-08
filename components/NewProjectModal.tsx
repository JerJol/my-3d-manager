"use client";
import { useEffect, useState } from "react";
import { createProject, getCategories } from "@/app/actions";
import { useRouter } from "next/navigation";

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategories();
      setCategories(cats);
    }
    loadCategories();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-white">Nouveau projet 3D</h2>

        <form action={async (formData) => {
          await createProject(formData);
          router.refresh();
          onClose();
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Nom du projet</label>
            <input
              name="name"
              required
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600"
              placeholder="ex: Insert Zombicide"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              name="description"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 placeholder:text-slate-600"
              placeholder="Détails sur l'organisation des boites..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Catégorie</label>
            <select
              name="categoryId"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none [&>option]:bg-slate-900"
            >
              <option value="">Aucune catégorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Nom de version</label>
              <input
                name="versionName"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600"
                placeholder="ex: v1, Beta"
                defaultValue="v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Numéro de version</label>
              <input
                name="versionNumber"
                type="number"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600"
                defaultValue="1"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
            >
              Créer le projet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
