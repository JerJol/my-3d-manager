import { getProjects, getAppConfig, getCategories } from "./actions";
import DashboardProjects from "@/components/DashboardProjects";

export default async function Dashboard() {
  const [projects, electricityPriceStr, categories] = await Promise.all([
    getProjects(),
    getAppConfig("ELECTRICITY_PRICE"),
    getCategories()
  ]);

  const electricityPrice = parseFloat(electricityPriceStr || "0");

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardProjects projects={projects} electricityPrice={electricityPrice} categories={categories || []} />
    </main>
  );
}