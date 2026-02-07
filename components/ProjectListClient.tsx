"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import NewProjectModal from "./NewProjectModal";

export default function ProjectListClient({ projects }: { projects: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
      >
        <Plus className="w-4 h-4" /> Nouveau projet
      </button>

      {isModalOpen && <NewProjectModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}