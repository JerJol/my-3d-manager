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

// Fonction pour récupérer les projets (on l'utilisera juste après)
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
  return await prisma.project.findUnique({
    where: { id },
    include: {
      stls: {
        include: {
          slicers: true
        }
      }
    }
  });
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
    await prisma.project.update({
      where: { id: projectId },
      data: {
        stls: {
          create: {
            name: name,
            filePath: filename,
            status: "todo"
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
    // We use a one-liner to avoid escaping issues with multiline strings in exec
    let script = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Sélectionnez le dossier';`;

    if (initialPath) {
      // In JS, we want to escape single quotes by doubling them for PowerShell single-quoted strings
      const escapedPath = initialPath.replace(/'/g, "''");
      script += ` $dialog.SelectedPath = '${escapedPath}';`;
    }

    script += ` if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }`;

    exec(`powershell -Command "${script}"`, (error, stdout) => {
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

export async function pickFile(initialPath?: string) {
  return new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
    // PowerShell script to open File Browser Dialog
    let script = `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Filter = 'STL Files (*.stl)|*.stl|All Files (*.*)|*.*'; $dialog.Title = 'Sélectionnez un fichier STL';`;

    if (initialPath) {
      // Escape single quotes for PowerShell
      const escapedPath = initialPath.replace(/'/g, "''");
      script += ` $dialog.InitialDirectory = '${escapedPath}';`;
    }

    script += ` if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName }`;

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, (error, stdout) => {
      if (error) {
        console.error("File picker error:", error);
        resolve({ success: false, error: "Impossible d'ouvrir le sélecteur de fichier : " + error.message });
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

    await prisma.stlFile.create({
      data: {
        projectId,
        name: filename,
        filePath: filePath,
        status: "todo"
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

        const newStl = await prisma.stlFile.create({
          data: {
            projectId,
            name: stlFilename,
            filePath: filePath,
            status: "todo"
          }
        });
        addedCount++;

        // Auto-associate G-code
        const stlBaseName = stlFilename.replace(/\.[^/.]+$/, ""); // Remove extension
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
        } else if (gcodeFiles.length > 0) {
          // If there are G-codes in the folder but none match this STL
          // We could potentially be less strict, but let's stick to the request
          // associationWarnings.push(`${stlFilename} : Aucun G-code correspondant`);
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