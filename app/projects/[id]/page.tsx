import { getProject } from "@/app/actions";
import { notFound } from "next/navigation";
import ProjectDetailsClient from "@/components/ProjectDetailsClient";

export default async function ProjectPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
        return notFound();
    }

    const project = await getProject(projectId);

    if (!project) {
        return notFound();
    }

    return <ProjectDetailsClient project={project} />;
}
