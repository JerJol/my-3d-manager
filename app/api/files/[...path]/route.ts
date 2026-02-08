import { readFile } from "fs/promises";
import { join, isAbsolute } from "path";
import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const pathSegments = (await params).path;
    // Filter out empty segments (common with double slashes)
    const filteredSegments = pathSegments.filter(s => s.length > 0);

    console.log("[API] Requested segments:", pathSegments, "Filtered:", filteredSegments);

    // Reconstruction du chemin à partir des segments
    let filePath = filteredSegments.join("/");

    // Si on est sur Windows et que le premier segment ressemble à un lecteur (ex: "C:"), 
    // on s'assure qu'il est bien formaté.
    if (filteredSegments[0] && filteredSegments[0].includes(":")) {
        filePath = filteredSegments.join("\\");
    }

    // Si le chemin n'est pas absolu, on cherche dans le dossier storage
    if (!isAbsolute(filePath)) {
        filePath = join(process.cwd(), "storage", filePath);
    }

    console.log("[API] Resolved file path:", filePath);

    if (!existsSync(filePath)) {
        console.error("[API] File not found:", filePath);
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const fileBuffer = await readFile(filePath);
        const filename = filteredSegments[filteredSegments.length - 1];

        console.log("[API] Serving file:", filename, "size:", fileBuffer.length);

        const response = new NextResponse(fileBuffer);
        response.headers.set("Content-Type", "application/octet-stream");
        response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        return response;
    } catch (error) {
        console.error("[API] Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
