import { readFile } from "fs/promises";
import { join, isAbsolute } from "path";
import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const pathSegments = (await params).path;
    // Reconstruction du chemin à partir des segments
    let filePath = pathSegments.join("/");

    // Si on est sur Windows et que le premier segment ressemble à un lecteur (ex: "C:"), 
    // on s'assure qu'il est bien formaté.
    if (pathSegments[0].includes(":")) {
        filePath = pathSegments.join("\\");
    }

    // Si le chemin n'est pas absolu, on cherche dans le dossier storage
    if (!isAbsolute(filePath)) {
        filePath = join(process.cwd(), "storage", filePath);
    }

    if (!existsSync(filePath)) {
        console.error("File not found:", filePath);
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);
        const filename = pathSegments[pathSegments.length - 1];

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
