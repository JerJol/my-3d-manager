import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeContext";
import Navbar from "./components/Navbar";
import SidebarClient from "./components/SidebarClient";
import DashboardProjects from "./components/DashboardProjects";
import ProjectDetails from "./components/ProjectDetails";
import CreateProjectModal from "./components/CreateProjectModal";
import FilamentsPage from "./components/FilamentsPage";
import PrintersPage from "./components/PrintersPage";
import SettingsPage from "./components/SettingsPage";
import * as db from "./lib/db";
import "./index.css";
import { useState, useEffect } from "react";
import SetupWizard from "./components/SetupWizard";

function Layout({ projects, children }: { projects: any[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarClient projects={projects} />
        <main className="flex-1 overflow-y-auto w-full px-4 md:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function Home({ projects, categories, onAddProject, onDeleteProject }: {
  projects: any[];
  categories: any[];
  onAddProject: () => void;
  onDeleteProject: (id: number) => void;
}) {
  return (
    <DashboardProjects
      projects={projects}
      electricityPrice={0.22}
      categories={categories}
      onAddProject={onAddProject}
      onDeleteProject={onDeleteProject}
    />
  );
}

function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const status = await (window as any).electron.getSetupStatus();
      setIsConfigured(status.isConfigured);
      if (status.isConfigured) {
        await loadData();
      }
    } catch (err) {
      console.error("Setup check failed:", err);
      setIsConfigured(false);
    }
  };

  const loadData = async () => {
    try {
      const fetchedProjects = await db.getProjects();
      const fetchedCategories = await db.getCategories();
      setProjects(fetchedProjects);
      setCategories(fetchedCategories);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  const handleCreateProject = async (name: string, description: string, categoryId: number | null, filamentId: number | null, printerId: number | null) => {
    try {
      console.log("Creating project:", name);
      const result = await db.createProject(name, description, categoryId, filamentId, printerId);
      console.log("Project created result:", result);
      if (result.success) {
        setIsCreateModalOpen(false);
        await loadData();
      }
    } catch (error: any) {
      console.error("Detailed error in handleCreateProject:", error);
      alert(`Erreur lors de la création du projet : ${error.message || error}`);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")) {
      await db.deleteProject(id);
      await loadData();
    }
  };

  if (isConfigured === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isConfigured === false) {
    return <SetupWizard onComplete={checkSetup} />;
  }

  return (
    <ThemeProvider>
      <HashRouter>
        <Layout projects={projects}>
          <Routes>
            <Route path="/" element={
              <Home
                projects={projects}
                categories={categories}
                onAddProject={() => setIsCreateModalOpen(true)}
                onDeleteProject={handleDeleteProject}
              />
            } />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/filaments" element={<FilamentsPage />} />
            <Route path="/printers" element={<PrintersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>

        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateProject}
        />
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
