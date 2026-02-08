import { getProjects } from "@/app/actions";
import SidebarClient from "./SidebarClient";

export default async function Sidebar() {
    const data = await getProjects();

    // Simplify projects for the client component
    const projects = data.map(p => ({
        id: p.id,
        name: p.name,
        versionName: p.versionName,
        status: p.status
    }));

    return <SidebarClient projects={projects} />;
}
