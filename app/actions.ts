"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function createProject(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const versionName = (formData.get("versionName") as string) || "v1";
  const versionNumber = parseInt(formData.get("versionNumber") as string) || 1;

  try {
    // Récupérer les réglages par défaut
    const defaultFilamentId = await getAppConfig("DEFAULT_FILAMENT_ID");
    const defaultPrinterId = await getAppConfig("DEFAULT_PRINTER_ID");
    const categoryId = formData.get("categoryId") ? parseInt(formData.get("categoryId") as string) : null;

    await prisma.project.create({
      data: {
        name,
        description,
        status: "actif",
        versionName: versionName,
        versionNumber: versionNumber,
        isDefault: true,
        filamentId: defaultFilamentId ? parseInt(defaultFilamentId) : null,
        printerId: defaultPrinterId ? parseInt(defaultPrinterId) : null,
        categoryId: categoryId,
      },
    });

    // Informe Next.js que les données ont changé et qu'il faut rafraîchir l'affichage
    revalidatePath("/");
  } catch (error) {
    console.error("Erreur lors de la création :", error);
  }
}

export async function createProjectVersion(parentProjectId: number, name: string) {
  try {
    const parent = await prisma.project.findUnique({
      where: { id: parentProjectId },
      include: {
        stls: {
          include: {
            slicers: true
          }
        }
      }
    });

    if (!parent) throw new Error("Parent project not found");

    const latestVersion = await prisma.project.findFirst({
      where: {
        OR: [
          { id: parentProjectId },
          { parentProjectId: parentProjectId }
        ]
      },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const newProject = await prisma.project.create({
      data: {
        name: parent.name,
        description: parent.description,
        theme: parent.theme,
        localFolderPath: parent.localFolderPath,
        status: "actif",
        versionName: name,
        versionNumber: newVersionNumber,
        isDefault: false,
        parentProjectId: parentProjectId,
        filamentId: parent.filamentId,
        printerId: parent.printerId,
        categoryId: parent.categoryId,
        stls: {
          create: parent.stls.map(stl => ({
            name: stl.name,
            filePath: stl.filePath,
            quantity: stl.quantity,
            comment: stl.comment,
            status: stl.status,
            slicers: {
              create: stl.slicers.map(slicer => ({
                name: slicer.name,
                filePath: slicer.filePath,
                printTime: slicer.printTime,
                filamentLen: slicer.filamentLen,
                filamentWgt: slicer.filamentWgt,
                nozzleTemp: slicer.nozzleTemp,
                bedTemp: slicer.bedTemp,
                costElec: slicer.costElec,
                costMachine: slicer.costMachine,
                costFilament: slicer.costFilament,
                filamentId: slicer.filamentId
              }))
            }
          }))
        }
      }
    });

    revalidatePath("/");
    revalidatePath(`/projects/${newProject.id}`);
    return newProject;
  } catch (error) {
    console.error("Erreur lors de la création de la version :", error);
    throw error;
  }
}

export async function getProjectVersions(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { parentProjectId: true, id: true }
  });

  if (!project) return [];

  const rootId = project.parentProjectId || project.id;

  return await prisma.project.findMany({
    where: {
      OR: [
        { id: rootId },
        { parentProjectId: rootId }
      ]
    },
    orderBy: { versionNumber: 'asc' },
    select: {
      id: true,
      versionName: true,
      versionNumber: true,
      isDefault: true
    }
  });
}

export async function setDefaultVersion(projectId: number) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { parentProjectId: true, id: true }
    });

    if (!project) throw new Error("Project not found");

    const rootId = project.parentProjectId || project.id;

    // Reset all versions in group
    await prisma.project.updateMany({
      where: {
        OR: [
          { id: rootId },
          { parentProjectId: rootId }
        ]
      },
      data: { isDefault: false }
    });

    // Set the new default
    await prisma.project.update({
      where: { id: projectId },
      data: { isDefault: true }
    });

    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Erreur lors de la définition de la version par défaut :", error);
  }
}

export async function getProjects() {
  return await prisma.project.findMany({
    where: {
      OR: [
        { isDefault: true },
        { parentProjectId: null, versions: { none: { isDefault: true } } }
      ]
    },
    include: {
      filament: true,
      printer: true,
      category: true,
      stls: {
        include: {
          slicers: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function deleteFileSafely(filePath: string) {
  if (!filePath || filePath.includes(":") || filePath.startsWith("/")) return;

  // Check if any other STL record uses this file
  const stlCount = await prisma.stlFile.count({ where: { filePath } });
  // Check if any other Slicer record uses this file
  const slicerCount = await prisma.slicerFile.count({ where: { filePath } });

  if (stlCount === 0 && slicerCount === 0) {
    const fullPath = join(process.cwd(), "storage", filePath);
    try {
      await unlink(fullPath);
    } catch (e) {
      console.warn("File not found on disk during cleanup:", fullPath);
    }
  }
}

export async function deleteProject(id: number) {
  try {
    // 1. Get all files before deletion
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        stls: {
          include: { slicers: true }
        }
      }
    });

    if (!project) return;

    // 2. Delete from DB first so they are not counted in deleteFileSafely
    await prisma.project.delete({
      where: { id },
    });

    // 3. Safely delete files from disk
    for (const stl of project.stls) {
      for (const slicer of stl.slicers) {
        await deleteFileSafely(slicer.filePath);
      }
      await deleteFileSafely(stl.filePath);
    }

    revalidatePath("/");
  } catch (error) {
    console.error("Erreur lors de la suppression du projet :", error);
  }
}

export async function getProject(id: number) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      stls: {
        include: {
          slicers: true
        }
      },
      links: true,
      images: true
    }
  }) as any;

  if (!project) return null;

  // Manually fetch printedQty for each STL if missing from client
  try {
    const rawStls = await prisma.$queryRaw<any[]>`SELECT id, printedQty FROM StlFile WHERE projectId = ${id}`;
    const qtyMap = new Map(rawStls.map(s => [s.id, s.printedQty]));

    project.stls = project.stls.map((stl: any) => ({
      ...stl,
      printedQty: qtyMap.get(stl.id) || 0
    }));
  } catch (e) {
    console.error("Failed to fetch raw printedQty:", e);
  }

  return project;
}

import { writeFile, mkdir, unlink, readFile, readdir, stat, copyFile } from "fs/promises";
import { join, basename } from "path";

export async function uploadStl(formData: FormData) {
  const file = formData.get("file") as File | null;
  const localPath = formData.get("localPath") as string | null;
  const projectId = parseInt(formData.get("projectId") as string);

  if (isNaN(projectId)) return { success: false, error: "Invalid Project ID" };
  if (!file && !localPath) return { success: false, error: "No file provided" };

  let filename = "";
  let name = "";

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stlMetadata = parseStlMetadata(buffer);
    filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    name = file.name;
    const uploadDir = join(process.cwd(), "storage");

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), buffer);
    } catch (e) {
      return { success: false, error: "File write failed" };
    }
  } else if (localPath) {
    filename = localPath;
    name = localPath.split(/[\\/]/).pop() || "Linked File";
  }

  try {
    let stlMetadata = { dimX: 0, dimY: 0, dimZ: 0, volume: 0 };
    if (localPath) {
      try {
        const buffer = await readFile(localPath);
        stlMetadata = parseStlMetadata(buffer);
      } catch (e) {
        console.warn("Could not parse STL metadata for linked file:", e);
      }
    } else if (file) {
      // already parsed above
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        stls: {
          create: {
            name: name,
            filePath: filename,
            status: "todo",
            ...stlMetadata
          }
        }
      }
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error uploading STL:", error);
    return { success: false, error: "Failed to save record" };
  }
}

export async function deleteStl(id: number) {
  try {
    const stl = await prisma.stlFile.findUnique({
      where: { id },
      include: { slicers: true }
    });
    if (!stl) return { success: false, error: "STL not found" };

    // 1. Delete associated G-code files from disk
    for (const slicer of stl.slicers) {
      if (!slicer.filePath.includes(":") && !slicer.filePath.startsWith("/")) {
        const gcodePath = join(process.cwd(), "storage", slicer.filePath);
        try {
          await unlink(gcodePath);
        } catch (e) {
          console.warn("G-code file not found on disk:", gcodePath);
        }
      }
    }

    // 2. Delete STL file from disk
    if (stl.filePath && !stl.filePath.includes(":") && !stl.filePath.startsWith("/")) {
      const filePath = join(process.cwd(), "storage", stl.filePath);
      try {
        await unlink(filePath);
      } catch (e) {
        console.warn("STL file not found on disk:", filePath);
      }
    }

    // 3. Delete STL record (Cascade will delete SlicerFile records)
    await prisma.stlFile.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting STL:", error);
    return { success: false, error: "Failed to delete STL" };
  }
}

export async function deleteAllProjectStls(projectId: number) {
  try {
    const stls = await prisma.stlFile.findMany({
      where: { projectId },
      include: { slicers: true }
    });

    for (const stl of stls) {
      // 1. Delete associated G-code files from disk
      for (const slicer of stl.slicers) {
        if (slicer.filePath && !slicer.filePath.includes(":") && !slicer.filePath.startsWith("/")) {
          const gcodePath = join(process.cwd(), "storage", slicer.filePath);
          try {
            await unlink(gcodePath);
          } catch (e) {
            console.warn("G-code file not found on disk:", gcodePath);
          }
        }
      }

      // 2. Delete STL file from disk
      if (stl.filePath && !stl.filePath.includes(":") && !stl.filePath.startsWith("/")) {
        const filePath = join(process.cwd(), "storage", stl.filePath);
        try {
          await unlink(filePath);
        } catch (e) {
          console.warn("STL file not found on disk:", filePath);
        }
      }
    }

    // 3. Delete all STL records (will cascade to SlicerFiles)
    await prisma.stlFile.deleteMany({
      where: { projectId }
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting all STLs:", error);
    return { success: false, error: "Failed to delete all STLs" };
  }
}

export async function deleteSlicerFile(id: number) {
  try {
    const slicerFile = await prisma.slicerFile.findUnique({ where: { id } });
    if (!slicerFile) return { success: false, error: "G-code not found" };

    if (!slicerFile.filePath.includes(":") && !slicerFile.filePath.startsWith("/")) {
      const filePath = join(process.cwd(), "storage", slicerFile.filePath);
      try {
        await unlink(filePath);
      } catch (e) {
        console.warn("File not found on disk:", filePath);
      }
    }

    await prisma.slicerFile.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting G-code:", error);
    return { success: false, error: "Failed to delete G-code" };
  }
}

export async function uploadGcode(formData: FormData) {
  const stlId = parseInt(formData.get("stlId") as string);
  const file = formData.get("file") as File | null;
  const localPath = formData.get("localPath") as string | null;

  if (isNaN(stlId)) return { success: false, error: "Invalid input" };

  let filename = "";
  let printTime = 0;
  let filamentLen = 0;

  if (file) {
    // Handle File Upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("utf-8");
    filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const uploadDir = join(process.cwd(), "storage");

    // Parse G-code
    const { printTime: pt, filamentLen: fl } = parseGcodeMetadata(content);
    printTime = pt;
    filamentLen = fl;

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), buffer);
    } catch (e) {
      console.error("FS Error:", e);
      return { success: false, error: "Failed to save file" };
    }
  } else if (localPath) {
    // Handle Local Path
    filename = localPath;
    try {
      const content = await readFile(localPath, 'utf-8');
      const { printTime: pt, filamentLen: fl } = parseGcodeMetadata(content);
      printTime = pt;
      filamentLen = fl;
    } catch (e) {
      console.warn("Could not read local file for parsing:", e);
    }
  } else {
    return { success: false, error: "No file or path provided" };
  }

  try {
    await prisma.slicerFile.create({
      data: {
        stlFileId: stlId,
        name: file ? file.name : filename.split(/[\\/]/).pop() || "unknown",
        filePath: filename,
        printTime,
        filamentLen,
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error uploading G-code:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to upload G-code" };
  }
}

function parseGcodeMetadata(content: string) {
  let printTime = 0;
  let filamentLen = 0;

  const lines = content.split('\n').slice(0, 500);
  const footerLines = content.split('\n').slice(-500);
  const allLines = [...lines, ...footerLines];

  for (const line of allLines) {
    if (line.includes(";TIME:")) {
      printTime = parseInt(line.split(":")[1].trim());
    }
    if (line.includes("Filament used")) {
      const match = line.match(/([0-9.]+)m/);
      if (match) {
        filamentLen = parseFloat(match[1]) * 1000;
      }
    }
  }
  return { printTime, filamentLen };
}

function parseStlMetadata(buffer: Buffer) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let volume = 0;

  // Faster binary check: 80 byte header + 4 byte face count + (faceCount * 50 bytes)
  const isBinary = buffer.length > 84 && buffer.readUInt32LE(80) * 50 + 84 === buffer.length;

  if (isBinary) {
    const faceCount = buffer.readUInt32LE(80);
    for (let i = 0; i < faceCount; i++) {
      const offset = 84 + i * 50;
      // Vertices start at offset + 12 (after normal)
      for (let v = 0; v < 3; v++) {
        const vx = buffer.readFloatLE(offset + 12 + v * 12);
        const vy = buffer.readFloatLE(offset + 12 + v * 12 + 4);
        const vz = buffer.readFloatLE(offset + 12 + v * 12 + 8);

        minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
        minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
        minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
      }

      // Signed volume of tetrahedron
      const x1 = buffer.readFloatLE(offset + 12);
      const y1 = buffer.readFloatLE(offset + 16);
      const z1 = buffer.readFloatLE(offset + 20);
      const x2 = buffer.readFloatLE(offset + 24);
      const y2 = buffer.readFloatLE(offset + 28);
      const z2 = buffer.readFloatLE(offset + 32);
      const x3 = buffer.readFloatLE(offset + 36);
      const y3 = buffer.readFloatLE(offset + 40);
      const z3 = buffer.readFloatLE(offset + 44);

      volume += (x1 * y2 * z3 - x1 * y3 * z2 - x2 * y1 * z3 + x2 * y3 * z1 + x3 * y1 * z2 - x3 * y2 * z1) / 6.0;
    }
  } else {
    // ASCII Parser
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    let triangle: number[][] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('vertex')) {
        const parts = trimmed.split(/\s+/);
        const vx = parseFloat(parts[1]);
        const vy = parseFloat(parts[2]);
        const vz = parseFloat(parts[3]);
        minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
        minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
        minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
        triangle.push([vx, vy, vz]);
        if (triangle.length === 3) {
          const [v1, v2, v3] = triangle;
          volume += (v1[0] * v2[1] * v3[2] - v1[0] * v3[1] * v2[2] - v2[0] * v1[1] * v3[2] + v2[0] * v3[1] * v1[2] + v3[0] * v1[1] * v2[2] - v3[0] * v2[1] * v1[2]) / 6.0;
          triangle = [];
        }
      }
    }
  }

  return {
    dimX: isFinite(minX) ? maxX - minX : 0,
    dimY: isFinite(minY) ? maxY - minY : 0,
    dimZ: isFinite(minZ) ? maxZ - minZ : 0,
    volume: Math.abs(volume)
  };
}

export async function updateProjectFolder(projectId: number, path: string) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { localFolderPath: path }
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating project folder:", error);
    return { success: false, error: "Failed to update folder path" };
  }
}

export async function updateProjectDescription(projectId: number, description: string) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { description }
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating project description:", error);
    return { success: false, error: "Failed to update description" };
  }
}

import { exec } from "child_process";

export async function openProjectFolder(path: string) {
  if (!path) return { success: false, error: "No path provided" };

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    exec(`explorer.exe "${path}"`, (error) => {
      if (error) {
        console.error("Failed to open folder:", error);
        resolve({ success: false, error: "Failed to open folder" });
      } else {
        resolve({ success: true });
      }
    });
  });
}

export async function pickFolder(initialPath?: string) {
  return new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
    // PowerShell script to open Folder Browser Dialog
    let script = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Sélectionnez le dossier'; $f = New-Object System.Windows.Forms.Form; $f.TopMost = $true;`;

    if (initialPath) {
      const escapedPath = initialPath.replace(/'/g, "''");
      script += ` $dialog.SelectedPath = '${escapedPath}';`;
    }

    script += ` if ($dialog.ShowDialog($f) -eq 'OK') { $dialog.SelectedPath }`;

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, (error, stdout) => {
      if (error) {
        console.error("Folder picker error:", error);
        resolve({ success: false, error: "Impossible d'ouvrir le sélecteur de dossier" });
      } else {
        const path = stdout.trim();
        if (path) {
          resolve({ success: true, path });
        } else {
          resolve({ success: false, error: "Sélection annulée" });
        }
      }
    });
  });
}

export async function pickFile(initialPath?: string, filter: string = 'STL Files (*.stl)|*.stl|All Files (*.*)|*.*', multiSelect: boolean = false) {
  return new Promise<{ success: boolean; path?: string; paths?: string[]; error?: string }>((resolve) => {
    let script = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Filter = '${filter.replace(/'/g, "''")}'; $dialog.Title = 'Sélectionnez un ou plusieurs fichiers'; $dialog.Multiselect = $${multiSelect.toString().toLowerCase()}; $f = New-Object System.Windows.Forms.Form; $f.TopMost = $true;`;

    if (initialPath) {
      const escapedPath = initialPath.replace(/'/g, "''");
      script += ` $dialog.InitialDirectory = '${escapedPath}';`;
    }

    script += ` if ($dialog.ShowDialog($f) -eq 'OK') { if ($dialog.Multiselect) { $dialog.FileNames } else { $dialog.FileName } }`;

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, (error, stdout) => {
      if (error) {
        console.error("File picker error:", error);
        resolve({ success: false, error: "Impossible d'ouvrir le sélecteur de fichier" });
      } else {
        const output = stdout.trim();
        if (output) {
          if (multiSelect) {
            const paths = output.split(/\r?\n/).filter(p => p.trim() !== "");
            resolve({ success: true, paths });
          } else {
            resolve({ success: true, path: output });
          }
        } else {
          resolve({ success: false, error: "Sélection annulée" });
        }
      }
    });
  });
}

export async function exportGcode(slicerFileId: number, targetFolder?: string) {
  try {
    const slicer = await prisma.slicerFile.findUnique({
      where: { id: slicerFileId }
    });
    if (!slicer) return { success: false, error: "G-code non trouvé" };

    const exportPath = targetFolder || await getAppConfig("DEFAULT_EXPORT_FOLDER");
    if (!exportPath) return { success: false, error: "Dossier d'export non défini" };

    const sourcePath = slicer.filePath.includes(":") || slicer.filePath.startsWith("/")
      ? slicer.filePath
      : join(process.cwd(), "storage", slicer.filePath);

    // Ensure source exists
    try {
      await stat(sourcePath);
    } catch (e) {
      return { success: false, error: "Fichier source introuvable sur le disque" };
    }

    // Ensure target folder exists
    await mkdir(exportPath, { recursive: true });

    const targetFile = join(exportPath, slicer.name);
    await copyFile(sourcePath, targetFile);

    return { success: true, path: targetFile };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: "Erreur lors de l'exportation : " + (error as Error).message };
  }
}

export async function exportStl(stlId: number, targetFolder?: string) {
  try {
    const stl = await prisma.stlFile.findUnique({
      where: { id: stlId }
    });
    if (!stl) return { success: false, error: "STL non trouvé" };

    const exportPath = targetFolder || await getAppConfig("DEFAULT_EXPORT_FOLDER");
    if (!exportPath) return { success: false, error: "Dossier d'export non défini" };

    const sourcePath = stl.filePath.includes(":") || stl.filePath.startsWith("/")
      ? stl.filePath
      : join(process.cwd(), "storage", stl.filePath);

    // Ensure source exists
    try {
      await stat(sourcePath);
    } catch (e) {
      return { success: false, error: "Fichier STL source introuvable sur le disque" };
    }

    // Ensure target folder exists
    await mkdir(exportPath, { recursive: true });

    const targetFile = join(exportPath, stl.name);
    await copyFile(sourcePath, targetFile);

    return { success: true, path: targetFile };
  } catch (error) {
    console.error("Export STL error:", error);
    return { success: false, error: "Erreur lors de l'exportation du STL : " + (error as Error).message };
  }
}

export async function exportAllProjectGcodes(projectId: number, targetFolder?: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        stls: {
          include: { slicers: true }
        }
      }
    });

    if (!project) return { success: false, error: "Projet non trouvé" };

    const exportPath = targetFolder || await getAppConfig("DEFAULT_EXPORT_FOLDER");
    if (!exportPath) return { success: false, error: "Dossier d'export non défini" };

    const slicers = project.stls.flatMap(stl => stl.slicers);
    if (slicers.length === 0) return { success: false, error: "Aucun G-code à exporter" };

    await mkdir(exportPath, { recursive: true });

    let successCount = 0;
    let failCount = 0;

    for (const slicer of slicers) {
      try {
        const sourcePath = slicer.filePath.includes(":") || slicer.filePath.startsWith("/")
          ? slicer.filePath
          : join(process.cwd(), "storage", slicer.filePath);

        const targetFile = join(exportPath, slicer.name);
        await copyFile(sourcePath, targetFile);
        successCount++;
      } catch (e) {
        console.error(`Failed to export ${slicer.name}:`, e);
        failCount++;
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      message: `${successCount} fichiers G-code exportés.${failCount > 0 ? ` (${failCount} échecs)` : ""}`,
      path: exportPath
    };
  } catch (error) {
    console.error("Bulk export error:", error);
    return { success: false, error: "Erreur lors de l'exportation globale : " + (error as Error).message };
  }
}

export async function exportAllProjectStls(projectId: number, targetFolder?: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { stls: true }
    });

    if (!project) return { success: false, error: "Projet non trouvé" };

    const exportPath = targetFolder || await getAppConfig("DEFAULT_EXPORT_FOLDER");
    if (!exportPath) return { success: false, error: "Dossier d'export non défini" };

    if (project.stls.length === 0) return { success: false, error: "Aucun STL à exporter" };

    await mkdir(exportPath, { recursive: true });

    let successCount = 0;
    let failCount = 0;

    for (const stl of project.stls) {
      try {
        const sourcePath = stl.filePath.includes(":") || stl.filePath.startsWith("/")
          ? stl.filePath
          : join(process.cwd(), "storage", stl.filePath);

        const targetFile = join(exportPath, stl.name);
        await copyFile(sourcePath, targetFile);
        successCount++;
      } catch (e) {
        console.error(`Failed to export ${stl.name}:`, e);
        failCount++;
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      message: `${successCount} fichiers STL exportés.${failCount > 0 ? ` (${failCount} échecs)` : ""}`,
      path: exportPath
    };
  } catch (error) {
    console.error("Bulk STL export error:", error);
    return { success: false, error: "Erreur lors de l'exportation globale des STL : " + (error as Error).message };
  }
}

export async function addSingleStl(projectId: number, sourcePath: string, mode: 'copy' | 'link') {
  try {
    const filename = basename(sourcePath);
    const uploadDir = join(process.cwd(), "storage");
    let filePath = sourcePath;

    if (mode === 'copy') {
      const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, "_")}`;
      await mkdir(uploadDir, { recursive: true });
      await copyFile(sourcePath, join(uploadDir, uniqueFilename));
      filePath = uniqueFilename;
    }

    let stlMetadata = { dimX: 0, dimY: 0, dimZ: 0, volume: 0 };
    try {
      const buffer = await readFile(sourcePath);
      stlMetadata = parseStlMetadata(buffer);
    } catch (e) {
      console.warn("Could not parse STL metadata for single add:", e);
    }

    await prisma.stlFile.create({
      data: {
        projectId,
        name: filename,
        filePath: filePath,
        status: "todo",
        ...stlMetadata
      }
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding single STL:", error);
    return { success: false, error: "Erreur lors de l'ajout du fichier" };
  }
}

export async function updateStlQuantity(id: number, quantity: number) {
  try {
    await prisma.stlFile.update({
      where: { id },
      data: { quantity }
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating STL quantity:", error);
    return { success: false, error: "Failed to update quantity" };
  }
}

export async function updateStlStatus(id: number, status: string) {
  try {
    const stl = await prisma.stlFile.findUnique({ where: { id } });
    if (!stl) return { success: false, error: "STL non trouvé" };

    // If status is forced to printed, we might want to also set printedQty to quantity
    // But for now let's just keep it simple
    await prisma.stlFile.update({
      where: { id },
      data: { status }
    });
    revalidatePath(`/projects/${stl.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating STL status:", error);
    return { success: false, error: "Failed to update status" };
  }
}

export async function updateStlPrintedQuantity(id: number, printedQty: number) {
  try {
    console.log(`Updating STL ${id} printed quantity to ${printedQty}`);

    // Use raw query to bypass client validation if not yet synced
    const stls = await prisma.$queryRaw<any[]>`SELECT status, quantity, projectId FROM StlFile WHERE id = ${id} LIMIT 1`;
    if (!stls || stls.length === 0) return { success: false, error: "STL non trouvé" };

    const stl = stls[0];
    let status = stl.status;
    if (printedQty >= stl.quantity) {
      status = "printed";
    } else if (printedQty > 0) {
      status = "partial";
    } else {
      status = "todo";
    }

    // Raw update to avoid "Unknown argument" error
    await prisma.$executeRaw`UPDATE StlFile SET printedQty = ${printedQty}, status = ${status} WHERE id = ${id}`;

    revalidatePath(`/projects/${stl.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating STL printed quantity:", error);
    return { success: false, error: "Failed to update quantity: " + (error as Error).message };
  }
}

export async function updateStlComment(id: number, comment: string) {
  try {
    await prisma.stlFile.update({
      where: { id },
      data: { comment }
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating STL comment:", error);
    return { success: false, error: "Failed to update description" };
  }
}

// --- Filaments ---

export async function getFilaments() {
  return await prisma.filament.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function createFilament(formData: FormData) {
  const name = formData.get("name") as string;
  const brand = formData.get("brand") as string | null;
  const material = formData.get("material") as string;
  const density = parseFloat(formData.get("density") as string);
  const diameter = parseFloat(formData.get("diameter") as string);
  const weight = parseFloat(formData.get("weight") as string);
  const price = parseFloat(formData.get("price") as string);
  const color = formData.get("color") as string | null;

  try {
    await prisma.filament.create({
      data: {
        name,
        brand,
        material,
        density,
        diameter,
        weight,
        price,
        color
      }
    });
    revalidatePath("/filaments");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to create filament" };
  }
}

export async function updateFilament(id: number, formData: FormData) {
  const name = formData.get("name") as string;
  const brand = formData.get("brand") as string | null;
  const material = formData.get("material") as string;
  const density = parseFloat(formData.get("density") as string);
  const diameter = parseFloat(formData.get("diameter") as string);
  const weight = parseFloat(formData.get("weight") as string);
  const price = parseFloat(formData.get("price") as string);
  const color = formData.get("color") as string | null;

  try {
    await prisma.filament.update({
      where: { id },
      data: {
        name,
        brand,
        material,
        density,
        diameter,
        weight,
        price,
        color
      }
    });
    revalidatePath("/filaments");
    return { success: true };
  } catch (error) {
    console.error("Error updating filament:", error);
    return { success: false, error: "Failed to update filament" };
  }
}

export async function deleteFilament(id: number) {
  try {
    await prisma.filament.delete({ where: { id } });
    revalidatePath("/filaments");
    return { success: true };
  } catch (error) {
    console.error("Error deleting filament:", error);
    return { success: false, error: "Failed to delete filament" };
  }
}

export async function updateProjectFilament(projectId: number, filamentId: number | null) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { filamentId: filamentId }
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating project filament:", error);
    return { success: false, error: "Failed to update project filament" };
  }
}

// --- Printers ---

export async function getPrinters() {
  return await prisma.printer.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function createPrinter(formData: FormData) {
  const name = formData.get("name") as string;
  const model = formData.get("model") as string | null;
  const powerConsumptionW = parseInt(formData.get("powerConsumptionW") as string);
  const machineHourlyCost = parseFloat(formData.get("machineHourlyCost") as string);
  const purchasePrice = parseFloat(formData.get("purchasePrice") as string) || 0;
  const lifespanHours = parseInt(formData.get("lifespanHours") as string) || 0;
  const maintenanceCost = parseFloat(formData.get("maintenanceCost") as string) || 0;

  try {
    await prisma.printer.create({
      data: {
        name,
        model,
        powerConsumptionW,
        machineHourlyCost,
        purchasePrice,
        lifespanHours,
        maintenanceCost
      }
    });
    revalidatePath("/printers");
    return { success: true };
  } catch (error) {
    console.error("Error creating printer:", error);
    return { success: false, error: "Failed to create printer" };
  }
}

export async function updatePrinter(id: number, formData: FormData) {
  const name = formData.get("name") as string;
  const model = formData.get("model") as string | null;
  const powerConsumptionW = parseInt(formData.get("powerConsumptionW") as string);
  const machineHourlyCost = parseFloat(formData.get("machineHourlyCost") as string);
  const purchasePrice = parseFloat(formData.get("purchasePrice") as string) || 0;
  const lifespanHours = parseInt(formData.get("lifespanHours") as string) || 0;
  const maintenanceCost = parseFloat(formData.get("maintenanceCost") as string) || 0;

  try {
    await prisma.printer.update({
      where: { id },
      data: {
        name,
        model,
        powerConsumptionW,
        machineHourlyCost,
        purchasePrice,
        lifespanHours,
        maintenanceCost
      }
    });
    revalidatePath("/printers");
    return { success: true };
  } catch (error) {
    console.error("Error updating printer:", error);
    return { success: false, error: "Failed to update printer" };
  }
}

export async function deletePrinter(id: number) {
  try {
    await prisma.printer.delete({ where: { id } });
    revalidatePath("/printers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting printer:", error);
    return { success: false, error: "Failed to delete printer" };
  }
}

export async function updateProjectPrinter(projectId: number, printerId: number | null) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { printerId }
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating project printer:", error);
    return { success: false, error: "Failed to update project printer" };
  }
}

// --- Categories ---

export async function getCategories() {
  return await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function createCategory(name: string) {
  try {
    await prisma.category.create({
      data: { name }
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error creating category:", error);
    return { success: false, error: "La catégorie existe déjà ou impossible de la créer" };
  }
}

export async function deleteCategory(id: number) {
  try {
    await prisma.category.delete({
      where: { id }
    });
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return { success: false, error: "Impossible de supprimer la catégorie (elle est peut-être utilisée)" };
  }
}

export async function updateProjectCategory(projectId: number, categoryId: number | null) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { categoryId }
    });
    revalidatePath("/");
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating project category:", error);
    return { success: false, error: "Failed to update project category" };
  }
}

// --- Project Links & Images ---

export async function addProjectLink(projectId: number, name: string, url: string) {
  try {
    const link = await prisma.externalLink.create({
      data: { projectId, name, url }
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: true, link };
  } catch (error) {
    console.error("Error adding link:", error);
    return { success: false, error: "Impossible d'ajouter le lien" };
  }
}

export async function deleteProjectLink(linkId: number) {
  try {
    const link = await prisma.externalLink.delete({
      where: { id: linkId }
    });
    revalidatePath(`/projects/${link.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting link:", error);
    return { success: false, error: "Impossible de supprimer le lien" };
  }
}

export async function addProjectImage(projectId: number, urls: string | string[]) {
  try {
    const urlList = Array.isArray(urls) ? urls : [urls];

    // Use a transaction and multiple creates instead of createMany for SQLite compatibility and better type safety
    await prisma.$transaction(
      urlList.map(url => prisma.projectImage.create({
        data: {
          projectId,
          url
        }
      }))
    );

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding images:", error);
    return { success: false, error: "Impossible d'ajouter les images" };
  }
}

export async function deleteProjectImage(imageId: number) {
  try {
    const image = await prisma.projectImage.delete({
      where: { id: imageId }
    });
    revalidatePath(`/projects/${image.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting image:", error);
    return { success: false, error: "Impossible de supprimer l'image" };
  }
}

// --- App Config (Settings) ---

export async function getAppConfig(key: string) {
  const config = await prisma.appConfig.findUnique({
    where: { key }
  });
  return config?.value || null;
}

export async function updateAppConfig(key: string, value: string) {
  try {
    await prisma.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating config:", error);
    return { success: false, error: "Failed to update config" };
  }
}

export async function scanLocalStls(projectId: number, folderPath: string, importMode: 'copy' | 'link' = 'link') {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { stls: true }
    });

    if (!project) return { success: false, error: "Projet non trouvé" };

    const allFiles = await readdir(folderPath);
    const stlFiles = allFiles.filter(f => f.toLowerCase().endsWith(".stl"));
    const gcodeFiles = allFiles.filter(f => f.toLowerCase().endsWith(".gcode"));
    const existingNames = new Set(project.stls.map(stl => stl.name.toLowerCase()));

    let addedCount = 0;
    let associatedGcodeCount = 0;
    const skippedFiles: string[] = [];
    const associationWarnings: string[] = [];
    const uploadDir = join(process.cwd(), "storage");

    for (const stlFilename of stlFiles) {
      if (existingNames.has(stlFilename.toLowerCase())) {
        skippedFiles.push(stlFilename);
        continue;
      }

      const sourcePath = join(folderPath, stlFilename);
      const fileStat = await stat(sourcePath);

      if (fileStat.isFile()) {
        let filePath = sourcePath;

        if (importMode === 'copy') {
          const uniqueFilename = `${Date.now()}-${stlFilename.replace(/\s+/g, "_")}`;
          await mkdir(uploadDir, { recursive: true });
          await copyFile(sourcePath, join(uploadDir, uniqueFilename));
          filePath = uniqueFilename;
        }

        let stlMetadata = { dimX: 0, dimY: 0, dimZ: 0, volume: 0 };
        try {
          const buffer = await readFile(sourcePath);
          stlMetadata = parseStlMetadata(buffer);
        } catch (e) {
          console.warn("Could not parse STL metadata during scan:", e);
        }

        const newStl = await prisma.stlFile.create({
          data: {
            projectId,
            name: stlFilename,
            filePath: filePath,
            status: "todo",
            ...stlMetadata
          }
        });
        addedCount++;

        // Auto-associate G-code
        const stlBaseName = stlFilename.replace(/\.[^/.]+$/, "");
        const matches = gcodeFiles.filter(g => g.toLowerCase().includes(stlBaseName.toLowerCase()));

        if (matches.length === 1) {
          const gcodePath = join(folderPath, matches[0]);
          let gcodeMetadata = { printTime: 0, filamentLen: 0 };

          try {
            const content = await readFile(gcodePath, 'utf-8');
            gcodeMetadata = parseGcodeMetadata(content);
          } catch (e) {
            console.warn(`Could not parse G-code metadata for ${matches[0]}:`, e);
          }

          await prisma.slicerFile.create({
            data: {
              stlFileId: newStl.id,
              name: matches[0],
              filePath: gcodePath,
              printTime: gcodeMetadata.printTime,
              filamentLen: gcodeMetadata.filamentLen,
              filamentId: undefined
            }
          });
          associatedGcodeCount++;
        } else if (matches.length > 1) {
          associationWarnings.push(`${stlFilename} : Plusieurs G-codes trouvés (${matches.join(", ")})`);
        }
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      addedCount,
      associatedGcodeCount,
      skippedCount: skippedFiles.length,
      skippedFiles,
      associationWarnings
    };
  } catch (error) {
    console.error("Error scanning folder:", error);
    return { success: false, error: "Erreur lors du scan du dossier" };
  }
}

export async function generateProjectDescription(projectId: number, projectName: string) {
  try {
    // Logic for generating description for "jeu de société"
    const templates = [
      `Bienvenue dans l'univers passionnant de **${projectName}** ! Préparez-vous à vivre une aventure inoubliable avec vos amis et votre famille. Ce jeu de société combine stratégie, réflexion et moments de convivialité pour des parties endiablées. Idéal pour animer vos soirées !`,
      `Découvrez **${projectName}**, le nouveau jeu de société qui va révolutionner vos moments de détente. Plongez dans un gameplay immersif où chaque décision compte. Que vous soyez un joueur aguerri ou débutant, ce jeu saura vous séduire par sa mécanique fluide et son univers riche.`,
      `**${projectName}** est le compagnon idéal pour des heures de divertissement. Un jeu de société conçu pour stimuler votre esprit tout en garantissant une ambiance festive. Recommandé pour tous les âges, il promet des défis variés et une rejouabilité exceptionnelle.`
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

    await prisma.project.update({
      where: { id: projectId },
      data: { description: randomTemplate }
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, description: randomTemplate };
  } catch (error) {
    console.error("Error generating description:", error);
    return { success: false, error: "Erreur lors de la génération de la description" };
  }
}

export async function uploadPastedImage(formData: FormData) {
  try {
    const projectId = parseInt(formData.get("projectId") as string);
    const imageFile = formData.get("image") as File;

    if (!imageFile || isNaN(projectId)) {
      return { success: false, error: "Données invalides" };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) return { success: false, error: "Projet introuvable" };

    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const timestamp = new Date().getTime();
    const filename = `pasted_${timestamp}.png`;

    let targetFolder = project.localFolderPath;
    if (!targetFolder) {
      targetFolder = join(process.cwd(), "storage", "pasted_images");
    } else {
      // Create a 'photos' subfolder in the project folder
      targetFolder = join(targetFolder, "photos");
    }

    await mkdir(targetFolder, { recursive: true });
    const filePath = join(targetFolder, filename);

    await writeFile(filePath, buffer);

    // Add to database
    return await addProjectImage(projectId, filePath);
  } catch (error) {
    console.error("Error uploading pasted image:", error);
    return { success: false, error: "Erreur lors de la sauvegarde de l'image : " + (error as Error).message };
  }
}