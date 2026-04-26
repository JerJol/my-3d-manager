// Database abstraction layer that communicates with Electron main process via IPC

const electron = (window as any).electron;

// Define the interface for the global db object exposed by preload
interface DbDelegate {
    select: (query: string, params?: any[]) => Promise<any[]>;
    get: (query: string, params?: any[]) => Promise<any>;
    execute: (query: string, params?: any[]) => Promise<{ lastInsertId: number | string, rowsAffected: number }>;
}

declare global {
    interface Window {
        db: DbDelegate;
    }
}

// Helper to access the DB with fallback
const db = () => {
    const bridge = (window as any).db || (globalThis as any).db;
    if (!bridge) {
        const msg = "Base de données non détectée. Vérifiez que vous êtes bien dans l'application Electron.";
        console.warn(msg);
        throw new Error(msg);
    }
    return bridge;
};

// --- App Config ---

export async function getAppConfig(key: string): Promise<string | null> {
    const results = await db().select("SELECT value FROM AppConfig WHERE key = ?", [key]);
    return results.length > 0 ? results[0].value : null;
}

export async function updateAppConfig(key: string, value: string) {
    await db().execute("INSERT OR REPLACE INTO AppConfig (key, value) VALUES (?, ?)", [key, value]);
}

// --- Projects ---

export async function getProjects() {
    // Show projects that are default OR roots without any default versions
    const projects = await db().select(`
        SELECT * FROM Projects p 
        WHERE isDefault = 1 
        OR (parentProjectId IS NULL AND NOT EXISTS (SELECT 1 FROM Projects v WHERE v.parentProjectId = p.id AND v.isDefault = 1))
        ORDER BY createdAt DESC
    `);

    for (const project of projects) {
        // Fetch STLs with their slicer configs
        const stls = await db().select("SELECT * FROM StlFiles WHERE projectId = ?", [project.id]);
        for (const stl of stls) {
            stl.slicers = await db().select("SELECT * FROM SlicerConfigs WHERE stlId = ?", [stl.id]);
        }
        project.stls = stls;
        project.stlsCount = stls.length;

        // Fetch Filament
        if (project.filamentId) {
            project.filament = await db().get("SELECT * FROM Filaments WHERE id = ?", [project.filamentId]);
        }

        // Fetch Printer
        if (project.printerId) {
            project.printer = await db().get("SELECT * FROM Printers WHERE id = ?", [project.printerId]);
        }

        // Fetch Thumbnail
        const images = await db().select("SELECT id, url FROM ProjectImages WHERE projectId = ? LIMIT 1", [project.id]);
        project.thumbnail = images.length > 0 ? images[0].url : null;
    }

    return projects;
}

export async function createProject(name: string, description: string = "", categoryId?: number | null, filamentId?: number | null, printerId?: number | null) {
    // Get defaults if not provided
    const defFilament = filamentId || await getAppConfig("DEFAULT_FILAMENT_ID").then(id => id ? parseInt(id) : null);
    const defPrinter = printerId || await getAppConfig("DEFAULT_PRINTER_ID").then(id => id ? parseInt(id) : null);

    const result = await db().execute(
        "INSERT INTO Projects (name, description, status, versionNumber, categoryId, filamentId, printerId, isDefault) VALUES (?, ?, 'En cours', 1, ?, ?, ?, 1)",
        [name, description, categoryId || null, defFilament, defPrinter]
    );
    return { success: true, id: result.lastInsertId };
}

export async function getProject(id: number | string) {
    const projects = await db().select("SELECT * FROM Projects WHERE id = ?", [id]);
    if (projects.length === 0) return null;

    const project = projects[0];

    const stls = await db().select("SELECT * FROM StlFiles WHERE projectId = ?", [id]);
    for (const stl of stls) {
        stl.slicers = await db().select("SELECT * FROM SlicerConfigs WHERE stlId = ?", [stl.id]);
    }
    project.stls = stls;

    project.links = await db().select("SELECT * FROM ProjectLinks WHERE projectId = ?", [id]);
    project.images = await db().select("SELECT id, url FROM ProjectImages WHERE projectId = ?", [id]);

    return project;
}

export async function deleteProject(id: number | string) {
    await db().execute("DELETE FROM Projects WHERE id = ?", [id]);
    return { success: true };
}

export async function updateProjectFolder(projectId: number | string, path: string) {
    await db().execute("UPDATE Projects SET localFolderPath = ? WHERE id = ?", [path, projectId]);
    return { success: true };
}

export async function updateProjectDescription(projectId: number | string, description: string) {
    await db().execute("UPDATE Projects SET description = ? WHERE id = ?", [description, projectId]);
    return { success: true };
}

export async function updateProjectName(projectId: number | string, name: string) {
    await db().execute("UPDATE Projects SET name = ? WHERE id = ?", [name, projectId]);
    return { success: true };
}

export async function generateProjectDescription(projectId: number | string, projectName: string) {
    const templates = [
        `Bienvenue dans l'univers passionnant de **${projectName}** ! Préparez-vous à vivre une aventure inoubliable avec vos amis et votre famille. Ce jeu de société combine stratégie, réflexion et moments de convivialité pour des parties endiablées. Idéal pour animer vos soirées !`,
        `Découvrez **${projectName}**, le nouveau jeu de société qui va révolutionner vos moments de détente. Plongez dans un gameplay immersif où chaque décision compte. Que vous soyez un joueur aguerri ou débutant, ce jeu saura vous séduire par sa mécanique fluide et son univers riche.`,
        `**${projectName}** est le compagnon idéal pour des heures de divertissement. Un jeu de société conçu pour stimuler votre esprit tout en garantissant une ambiance festive. Recommandé pour tous les âges, il promet des défis variés et une rejouabilité exceptionnelle.`
    ];

    let finalDescription = templates[Math.floor(Math.random() * templates.length)];
    let targetGameId: string | null = null;

    try {
        console.log(`[BGG] Starting search for: "${projectName}" (projectId: ${projectId})`);

        // 1. Try XML API v2 First
        const apiSearchRes = await electron.fetchBggData(`https://www.boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(projectName)}&type=boardgame`);

        if (apiSearchRes.success) {
            console.log(`[BGG] XML API v2 Success. Parsing search results.`);
            const parser = new DOMParser();
            const searchDoc = parser.parseFromString(apiSearchRes.data, "text/xml");
            const items = searchDoc.querySelectorAll("item");

            if (items.length > 0) {
                targetGameId = items[0].getAttribute("id");
                // Exact match check
                for (const item of Array.from(items)) {
                    const name = item.querySelector("name")?.getAttribute("value");
                    if (name?.toLowerCase() === projectName.toLowerCase()) {
                        targetGameId = item.getAttribute("id");
                        break;
                    }
                }
            }
        } else if (apiSearchRes.status === 401) {
            console.warn(`[BGG] XML API v2 blocked (401). Falling back to HTML Scraping.`);
            // FALLBACK TO SCRAPING SEARCH
            const htmlSearchRes = await electron.fetchBggData(`https://boardgamegeek.com/search/boardgame?q=${encodeURIComponent(projectName)}`);
            if (htmlSearchRes.success) {
                // Regex to find game links: href="/boardgame/317587/beyond-the-sun"
                const match = htmlSearchRes.data.match(/\/boardgame\/(\d+)\//);
                if (match) {
                    targetGameId = match[1];
                    console.log(`[BGG] Found gameId via scraping: ${targetGameId}`);
                }
            }
        }

        if (targetGameId) {
            console.log(`[BGG] Processing GameID: ${targetGameId}`);

            // 2. Fetch Details (Try API First)
            const apiThingRes = await electron.fetchBggData(`https://www.boardgamegeek.com/xmlapi2/thing?id=${targetGameId}`);

            if (apiThingRes.success) {
                const parser = new DOMParser();
                const thingDoc = parser.parseFromString(apiThingRes.data, "text/xml");
                const description = thingDoc.querySelector("description")?.textContent;
                if (description) {
                    finalDescription = cleanBggDescription(description);
                    console.log(`[BGG] Description retrieved via API.`);
                }
            } else if (apiThingRes.status === 401) {
                console.warn(`[BGG] Detail API blocked (401). Scraping game page for rich description.`);
                const htmlGameRes = await electron.fetchBggData(`https://boardgamegeek.com/boardgame/${targetGameId}`);
                if (htmlGameRes.success) {
                    let richDescription: string | null = null;

                    // 1. Try JSON-LD first (often contains full description)
                    const jsonLdMatch = htmlGameRes.data.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
                    if (jsonLdMatch) {
                        try {
                            const jsonData = JSON.parse(jsonLdMatch[1]);
                            if (jsonData.description) {
                                richDescription = jsonData.description;
                                console.log(`[BGG] Description extracted via JSON-LD.`);
                            }
                        } catch (e) {
                            console.warn("[BGG] Failed to parse JSON-LD");
                        }
                    }

                    // 2. Fallback to Meta Search
                    if (!richDescription) {
                        const metaMatch = htmlGameRes.data.match(/<meta property="og:description" content="([^"]+)"/i)
                            || htmlGameRes.data.match(/<meta name="description" content="([^"]+)"/i);
                        if (metaMatch) {
                            richDescription = metaMatch[1];
                            console.log(`[BGG] Description extracted via meta.`);
                        }
                    }

                    if (richDescription) {
                        finalDescription = cleanBggDescription(richDescription);
                    }
                }
            }

            // 3. Add Link
            const bggUrl = `https://boardgamegeek.com/boardgame/${targetGameId}`;
            const existingLink = await db().get("SELECT id FROM ProjectLinks WHERE projectId = ? AND (url = ? OR url LIKE ?)", [
                projectId,
                bggUrl,
                `%boardgamegeek.com/boardgame/${targetGameId}`
            ]);
            if (!existingLink) {
                await addProjectLink(projectId, "BoardGameGeek", bggUrl);
                console.log(`[BGG] Link added: ${bggUrl}`);
            }
        } else {
            console.warn("[BGG] No game ID found (Search failed).");
        }
    } catch (e) {
        console.error("[BGG] Error during generation:", e);
    }

    // 4. Translate if it's from BGG (not a template)
    if (targetGameId && finalDescription && !templates.includes(finalDescription)) {
        console.log(`[BGG] Translating description to French...`);
        finalDescription = await electron.translateText(finalDescription, 'fr');
    }

    await updateProjectDescription(projectId, finalDescription);
    return { success: true, description: finalDescription };
}

function cleanBggDescription(text: string): string {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#10;/g, '\n')
        .replace(/&rsquo;/g, "'")
        .replace(/&ndash;/g, "-")
        .replace(/&mdash;/g, "-")
        .replace(/&#39;/g, "'")
        .replace(/&#x10;/g, '\n')
        .replace(/\n\n+/g, '\n\n')
        .trim();
}

export async function updateProjectFilament(projectId: number | string, filamentId: number | string | null) {
    await db().execute("UPDATE Projects SET filamentId = ? WHERE id = ?", [filamentId, projectId]);
    return { success: true };
}

export async function updateProjectPrinter(projectId: number | string, printerId: number | string | null) {
    await db().execute("UPDATE Projects SET printerId = ? WHERE id = ?", [printerId, projectId]);
    return { success: true };
}

export async function updateProjectCategory(projectId: number | string, categoryId: number | string | null) {
    await db().execute("UPDATE Projects SET categoryId = ? WHERE id = ?", [categoryId, projectId]);
    return { success: true };
}

export async function getProjectVersions(projectId: number | string) {
    const project = await db().get("SELECT id, parentProjectId FROM Projects WHERE id = ?", [projectId]);
    if (!project) return [];

    const rootId = project.parentProjectId || project.id;

    return await db().select(
        "SELECT id, versionName, versionNumber, isDefault FROM Projects WHERE id = ? OR parentProjectId = ? ORDER BY versionNumber ASC",
        [rootId, rootId]
    );
}

// --- STL Files ---

export async function addSingleStl(projectId: number | string, filePath: string, mode: 'copy' | 'link') {
    let finalPath = filePath;
    if (mode === 'copy') {
        try {
            const storagePath = await getAppConfig("STORAGE_PATH");
            finalPath = await (window as any).electron.importFileToStorage(projectId, filePath, storagePath);
        } catch (e) {
            console.error("Failed to copy file to internal storage:", e);
        }
    }

    const name = finalPath.split(/[\\/]/).pop() || "Sans nom";
    let metadata = { dimX: 0, dimY: 0, dimZ: 0, volume: 0 };

    try {
        const res = await (window as any).electron.getFileMetadata(finalPath);
        if (res) metadata = res;
    } catch (e) {
        console.warn("Could not fetch metadata for STL:", finalPath, e);
    }

    await db().execute(
        "INSERT INTO StlFiles (projectId, name, path, dimX, dimY, dimZ, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [projectId, name, finalPath, metadata.dimX, metadata.dimY, metadata.dimZ, metadata.volume]
    );
    return { success: true };
}

export async function addSlicerConfig(stlId: number | string, data: { name: string, path: string, printTime: number, filamentLen: number }) {
    await db().execute(
        "INSERT INTO SlicerConfigs (stlId, name, path, printTime, filamentLen) VALUES (?, ?, ?, ?, ?)",
        [stlId, data.name, data.path, data.printTime, data.filamentLen]
    );
    return { success: true };
}

export async function deleteStl(stlId: number | string) {
    await db().execute("DELETE FROM StlFiles WHERE id = ?", [stlId]);
    return { success: true };
}

export async function deleteProjectStls(projectId: number | string) {
    await db().execute("DELETE FROM StlFiles WHERE projectId = ?", [projectId]);
    return { success: true };
}

export async function updateStlPrintedQuantity(stlId: number | string, newQty: number) {
    await db().execute("UPDATE StlFiles SET printedQty = ? WHERE id = ?", [newQty, stlId]);
    return { success: true };
}

export async function createProjectVersion(parentProjectId: number | string, versionName: string) {
    const parent = await getProject(parentProjectId as number);
    if (!parent) throw new Error("Parent project not found");

    // Get latest version number
    const versions = await getProjectVersions(parentProjectId);
    const latestVersionNumber = versions.reduce((max: number, v: any) => Math.max(max, v.versionNumber), 0);
    const newVersionNumber = latestVersionNumber + 1;

    // Create new project entry
    const result = await db().execute(
        `INSERT INTO Projects (
            name, description, status, versionName, versionNumber, 
            theme, localFolderPath, isDefault, parentProjectId, 
            categoryId, filamentId, printerId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            parent.name, parent.description, parent.status, versionName, newVersionNumber,
            parent.theme, parent.localFolderPath, 0, parent.parentProjectId || parent.id,
            parent.categoryId, parent.filamentId, parent.printerId
        ]
    );

    const newId = result.lastInsertId;

    // Duplicate STLs and SlicerConfigs
    for (const stl of parent.stls) {
        const stlResult = await db().execute(
            `INSERT INTO StlFiles (
                projectId, name, path, quantity, printedQty, 
                comment, status, dimX, dimY, dimZ, volume
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newId, stl.name, stl.path, stl.quantity, stl.printedQty,
                stl.comment, stl.status, stl.dimX, stl.dimY, stl.dimZ, stl.volume
            ]
        );

        const newStlId = stlResult.lastInsertId;

        // Duplicate SlicerConfigs for this STL
        const slicers = await db().select("SELECT * FROM SlicerConfigs WHERE stlId = ?", [stl.id]);
        for (const slicer of slicers) {
            await db().execute(
                `INSERT INTO SlicerConfigs (
                    stlId, name, path, printTime, filamentLen, 
                    filamentWgt, nozzleTemp, bedTemp, costElec, 
                    costMachine, costFilament, filamentId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newStlId, slicer.name, slicer.path, slicer.printTime, slicer.filamentLen,
                    slicer.filamentWgt, slicer.nozzleTemp, slicer.bedTemp, slicer.costElec,
                    slicer.costMachine, slicer.costFilament, slicer.filamentId
                ]
            );
        }
    }

    return { success: true, id: newId };
}

export async function setDefaultVersion(projectId: number | string) {
    const project = await db().get("SELECT id, parentProjectId FROM Projects WHERE id = ?", [projectId]);
    if (!project) throw new Error("Project not found");

    const rootId = project.parentProjectId || project.id;

    // Reset all
    await db().execute(
        "UPDATE Projects SET isDefault = 0 WHERE id = ? OR parentProjectId = ?",
        [rootId, rootId]
    );

    // Set default
    await db().execute("UPDATE Projects SET isDefault = 1 WHERE id = ?", [projectId]);

    return { success: true };
}

export async function updateStlComment(stlId: number | string, comment: string) {
    await db().execute("UPDATE StlFiles SET comment = ? WHERE id = ?", [comment, stlId]);
    return { success: true };
}

export async function updateStlQuantity(stlId: number | string, quantity: number) {
    await db().execute("UPDATE StlFiles SET quantity = ? WHERE id = ?", [quantity, stlId]);
    return { success: true };
}

export async function scanLocalStls(projectId: number | string, folderPath: string, mode: 'copy' | 'link') {
    if (!electron?.scanLocalStls) return { success: false, addedCount: 0 };

    const allFiles = await (window as any).electron.scanLocalStls(folderPath);
    // Sort STLs by name length descending to ensure better matching (long names first)
    const stlFiles = allFiles
        .filter((f: string) => f.toLowerCase().endsWith('.stl'))
        .sort((a: string, b: string) => b.length - a.length);

    const gcodeFiles = allFiles.filter((f: string) => f.toLowerCase().endsWith('.gcode') || f.toLowerCase().endsWith('.gco'));

    let addedCount = 0;

    // Process STLs first
    for (const file of stlFiles) {
        let stlId: number | string;
        const existing = await db().get("SELECT id FROM StlFiles WHERE projectId = ? AND (path = ? OR name = ?)", [projectId, file, file.split(/[\\/]/).pop()]);

        let finalFile = file;
        if (mode === 'copy') {
            try {
                const storagePath = await getAppConfig("STORAGE_PATH");
                finalFile = await (window as any).electron.importFileToStorage(projectId, file, storagePath);
            } catch (e) {
                console.error("Failed to copy STL to storage:", file, e);
            }
        }

        const name = finalFile.replace(/\\/g, '/').split('/').pop() || "Sans nom";
        const baseName = name.replace(/\.[^/.]+$/, "");

        if (!existing) {
            let metadata = { dimX: 0, dimY: 0, dimZ: 0, volume: 0 };
            try {
                const res = await (window as any).electron.getFileMetadata(finalFile);
                if (res) metadata = res;
            } catch (e) {
                console.warn("Metadata fetch failed during scan for:", finalFile, e);
            }

            const result = await db().execute(
                "INSERT INTO StlFiles (projectId, name, path, dimX, dimY, dimZ, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [projectId, name, finalFile, metadata.dimX, metadata.dimY, metadata.dimZ, metadata.volume]
            );
            stlId = result.lastInsertId;
            addedCount++;
        } else {
            stlId = existing.id;
        }

        // Look for matching G-codes using includes (V1 style)
        const matches = gcodeFiles.filter((f: string) => {
            const gName = f.replace(/\\/g, '/').split('/').pop() || "";
            // Match if G-code name includes STL base name
            return gName.toLowerCase().includes(baseName.toLowerCase());
        });

        for (const matchingGcode of matches) {
            const exists = await db().get("SELECT id FROM SlicerConfigs WHERE stlId = ? AND (path = ? OR name = ?)", [stlId, matchingGcode, matchingGcode.split(/[\\/]/).pop()]);

            let finalGcode = matchingGcode;
            if (mode === 'copy') {
                try {
                    const storagePath = await getAppConfig("STORAGE_PATH");
                    finalGcode = await (window as any).electron.importFileToStorage(projectId, matchingGcode, storagePath);
                } catch (e) {
                    console.error("Failed to copy G-code to storage:", matchingGcode, e);
                }
            }

            if (!exists) {
                const gMetadata = await (window as any).electron.getFileMetadata(finalGcode);
                const gName = finalGcode.replace(/\\/g, '/').split('/').pop() || "G-code";
                await addSlicerConfig(stlId, {
                    name: gName,
                    path: finalGcode,
                    printTime: gMetadata?.printTime || 0,
                    filamentLen: gMetadata?.filamentLen || 0
                });
            }
        }
    }

    return { success: true, addedCount };
}

// --- Filaments ---

export async function getFilaments() {
    return await db().select("SELECT * FROM Filaments ORDER BY name ASC");
}

export async function createFilament(data: any) {
    await db().execute(
        "INSERT INTO Filaments (name, brand, material, density, diameter, weight, price, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [data.name, data.brand, data.material, parseFloat(data.density), parseFloat(data.diameter), parseInt(data.weight), parseFloat(data.price), data.color || null]
    );
    return { success: true };
}

export async function updateFilament(id: number | string, data: any) {
    await db().execute(
        "UPDATE Filaments SET name = ?, brand = ?, material = ?, density = ?, diameter = ?, weight = ?, price = ?, color = ? WHERE id = ?",
        [data.name, data.brand, data.material, parseFloat(data.density), parseFloat(data.diameter), parseInt(data.weight), parseFloat(data.price), data.color || null, id]
    );
    return { success: true };
}

export async function deleteFilament(id: number | string) {
    await db().execute("DELETE FROM Filaments WHERE id = ?", [id]);
    return { success: true };
}

// --- Printers ---

export async function getPrinters() {
    return await db().select("SELECT * FROM Printers ORDER BY name ASC");
}

export async function createPrinter(data: any) {
    await db().execute(
        "INSERT INTO Printers (name, model, powerConsumptionW, machineHourlyCost, purchasePrice, lifespanHours, maintenanceCost) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.name, data.model, parseInt(data.powerConsumptionW), parseFloat(data.machineHourlyCost), parseFloat(data.purchasePrice), parseInt(data.lifespanHours), parseFloat(data.maintenanceCost)]
    );
    return { success: true };
}

export async function updatePrinter(id: number | string, data: any) {
    await db().execute(
        "UPDATE Printers SET name = ?, model = ?, powerConsumptionW = ?, machineHourlyCost = ?, purchasePrice = ?, lifespanHours = ?, maintenanceCost = ? WHERE id = ?",
        [data.name, data.model, parseInt(data.powerConsumptionW), parseFloat(data.machineHourlyCost), parseFloat(data.purchasePrice), parseInt(data.lifespanHours), parseFloat(data.maintenanceCost), id]
    );
    return { success: true };
}

export async function deletePrinter(id: number | string) {
    await db().execute("DELETE FROM Printers WHERE id = ?", [id]);
    return { success: true };
}

// --- Categories ---

export async function getCategories() {
    return await db().select("SELECT * FROM Categories ORDER BY name ASC");
}

export async function createCategory(name: string) {
    await db().execute("INSERT INTO Categories (name) VALUES (?)", [name]);
    return { success: true };
}

export async function updateCategory(id: number | string, name: string) {
    await db().execute("UPDATE Categories SET name = ? WHERE id = ?", [name, id]);
    return { success: true };
}

export async function deleteCategory(id: number | string) {
    await db().execute("DELETE FROM Categories WHERE id = ?", [id]);
    return { success: true };
}

// --- Project Links & Images ---

export async function addProjectLink(projectId: number | string, name: string, url: string) {
    await db().execute("INSERT INTO ProjectLinks (projectId, name, url) VALUES (?, ?, ?)", [projectId, name, url]);
    return { success: true };
}

export async function deleteProjectLink(linkId: number | string) {
    await db().execute("DELETE FROM ProjectLinks WHERE id = ?", [linkId]);
    return { success: true };
}

export async function addProjectImage(projectId: number | string, urls: string | string[]) {
    const images = Array.isArray(urls) ? urls : [urls];
    const storagePath = await getAppConfig("STORAGE_PATH");

    for (const url of images) {
        let finalUrl = url;
        try {
            // Import the image to the internal storage (photos folder of the project)
            // We reuse importFileToStorage but we might need to specify the subfolder
            // Currently importFileToStorage is hardcoded to 'files' for projects.
            // Let's use a more flexible approach or update main.ts
            finalUrl = await (window as any).electron.importFileToStorage(projectId, url, storagePath, 'photos');
        } catch (e) {
            console.error("Failed to copy image to internal storage:", e);
        }
        await db().execute("INSERT INTO ProjectImages (projectId, url) VALUES (?, ?)", [projectId, finalUrl]);
    }
    return { success: true };
}

export async function uploadPastedImage(projectId: number, buffer: ArrayBuffer, folderPath: string | null) {
    try {
        const storagePath = await getAppConfig("STORAGE_PATH");
        const filePath = await electron.savePastedImage(projectId, buffer, folderPath, storagePath);
        // Direct DB insertion instead of calling addProjectImage (which would re-copy the file)
        await db().execute("INSERT INTO ProjectImages (projectId, url) VALUES (?, ?)", [projectId, filePath]);
        return { success: true };
    } catch (e) {
        console.error("Paste Error:", e);
        return { success: false, error: "Failed to save pasted image" };
    }
}

export async function migrateProjectsStorage(oldPath: string, newPath: string, copyData: boolean = true) {
    try {
        console.log(`[Migrate] Relocating App Data from ${oldPath} to ${newPath}. Copy: ${copyData}`);

        // 1. Physical move (or just switch) and DB reconnection via Electron
        const res = await electron.relocateAppData(newPath, copyData);
        if (!res.success) throw new Error(res.error);

        // 2. Update database paths
        // Normalized paths for replacement
        const oldP = oldPath.replace(/\\/g, '/');
        const newP = newPath.replace(/\\/g, '/');

        const tables = [
            { name: 'ProjectImages', col: 'url' },
            { name: 'StlFiles', col: 'path' },
            { name: 'SlicerConfigs', col: 'path' }
        ];

        for (const { name, col } of tables) {
            console.log(`[Migrate] Updating paths in ${name}.${col}...`);
            const items = await db().select(`SELECT id, ${col} FROM ${name} WHERE ${col} LIKE ? OR ${col} LIKE ?`, [`%${oldPath}%`, `%${oldP}%`]);

            for (const item of items) {
                let currentVal = item[col];
                // Replace both variants to be sure
                let newVal = currentVal.replace(oldPath, newPath).replace(oldP, newP);
                if (newVal !== currentVal) {
                    await db().execute(`UPDATE ${name} SET ${col} = ? WHERE id = ?`, [newVal, item.id]);
                }
            }
        }

        console.log("[Migrate] Database paths updated successfully.");
        return { success: true };
    } catch (e: any) {
        console.error("Migration failed:", e);
        return { success: false, error: e.message };
    }
}

export async function deleteProjectImage(imageId: number | string) {
    console.log("[db] Deleting image:", imageId);
    const res = await db().execute("DELETE FROM ProjectImages WHERE id = ?", [imageId]);
    console.log("[db] Delete result:", res);
    return { success: true };
}

export async function consolidateProjectImages() {
    const storagePath = await getAppConfig("STORAGE_PATH");
    if (!storagePath) return { success: false, error: "Dossier de stockage non configuré." };

    const images = await db().select("SELECT id, projectId, url FROM ProjectImages");
    let count = 0;

    for (const img of images) {
        const isInternal = img.url.includes("projects") && (img.url.includes("/photos/") || img.url.includes("/pasted_images/"));
        const isAlreadyInStorage = storagePath && img.url.startsWith(storagePath);

        if (!isInternal && !isAlreadyInStorage) {
            try {
                const finalUrl = await (window as any).electron.importFileToStorage(img.projectId, img.url, storagePath, 'photos');
                await db().execute("UPDATE ProjectImages SET url = ? WHERE id = ?", [finalUrl, img.id]);
                count++;
            } catch (e) {
                console.error(`Failed to consolidate image ${img.id}:`, e);
            }
        }
    }

    return { success: true, count };
}
