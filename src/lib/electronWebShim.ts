// src/lib/electronWebShim.ts
import { supabase } from "./supabaseClient";

/**
 * Minimal shim that mimics the Electron IPC API used throughout the codebase.
 * Each method either uses the Supabase client or falls back to a browser‑compatible
 * implementation. The goal is to keep the existing code unchanged – it accesses
 * `window.electron` – while enabling the web‑only version to function.
 */
export const electronShim = {
  // ------------------- Network helpers -------------------
  async fetchBggData(url: string) {
    try {
      const res = await fetch(url);
      const data = await res.text();
      return { success: true, status: res.status, data };
    } catch (e) {
      console.error("fetchBggData error:", e);
      return { success: false, status: 0, error: String(e) };
    }
  },

  // ------------------- Translation -------------------
  async translateText(text: string, targetLang: string) {
    console.warn("translateText stub called – returning original text.");
    return text;
  },

  // ------------------- Storage helpers -------------------
  async importFileToStorage(projectId: number | string, localPath: string, storagePath: string, subFolder: string = "files") {
    console.warn("importFileToStorage stub – returning constructed storage URL.");
    const fileName = localPath.split(/[\\/]/).pop() ?? "file";
    const bucket = "projects";
    const path = `${projectId}/${subFolder}/${fileName}`;
    // Stub: normally upload via supabase.storage.from(bucket).upload(...)
    return `${storagePath}/${path}`;
  },

  async getFileMetadata(path: string) {
    console.warn("getFileMetadata stub – returning empty metadata for", path);
    return { dimX: 0, dimY: 0, dimZ: 0, volume: 0, printTime: 0, filamentLen: 0 };
  },

  async scanLocalStls(folderPath: string) {
    console.warn("scanLocalStls stub – returning empty list.");
    return [];
  },

  async savePastedImage(projectId: number | string, buffer: ArrayBuffer, folderPath: string | null, storagePath: string) {
    const file = new Blob([buffer]);
    const fileName = `pasted_${Date.now()}.png`;
    const bucket = "projects";
    const path = `${projectId}/photos/${fileName}`;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: "image/png" });
      if (error) throw error;
      return data?.fullPath ?? `${storagePath}/${path}`;
    } catch (e) {
      console.error("savePastedImage error", e);
      throw e;
    }
  },

  async relocateAppData(newPath: string, copyData: boolean) {
    console.warn("relocateAppData called in web – no effect.");
    return { success: true };
  },

  // ------------------- UI dialogs (fallback) -------------------
  async showOpenDialog(options: any) {
    return new Promise<string | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      if (options && options.properties?.includes("openDirectory")) {
        // @ts-ignore – directory selection is non‑standard but supported in Chrome.
        input.webkitdirectory = true;
      }
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ? (file as any).path || file.name : null);
      };
      input.click();
    });
  },

  async showSaveDialog(_options: any) {
    const suggested = "download.txt";
    return suggested;
  },

  async copyFile(_src: string, _dest: string) {
    console.warn("copyFile stub – no operation in web.");
    return true;
  },

  async openPath(path: string) {
    if (path.startsWith("http")) {
      window.open(path, "_blank");
    } else {
      console.warn("openPath called with non‑URL path:", path);
    }
  },

  async getSetupStatus() {
    return { ready: true };
  },

  async getUserDataPath() {
    return "/user/data";
  },

  async checkDbExists(_path: string) {
    return true;
  },

  async initStorage(_path: string) {
    return { success: true };
  }
};

export const electron = electronShim;

// Expose on window for legacy code.
if (typeof window !== "undefined") {
  (window as any).electron = electronShim;
}
