import { LayoutGrid } from "lucide-react";
import { getProjects, getAppConfig } from "./actions";
import ProjectListClient from "@/components/ProjectListClient";
import ProjectCard from "@/components/ProjectCard";

export default async function Dashboard() {
  const [projects, electricityPriceStr] = await Promise.all([
    getProjects(),
    getAppConfig("ELECTRICITY_PRICE")
  ]);

  const electricityPrice = parseFloat(electricityPriceStr || "0");

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">Projets d'impression 3D</h1>

        {/* On appelle un composant client pour gérer l'ouverture du modal */}
        <ProjectListClient projects={projects} />
      </div>

      {projects.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-20 text-center">
          <LayoutGrid className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300">Aucun projet trouvé</h3>
          <p className="text-slate-500">Utilisez le bouton "Nouveau projet" pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} electricityPrice={electricityPrice} />
          ))}
        </div>
      )}
    </main>
  );
}