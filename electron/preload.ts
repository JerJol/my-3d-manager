import { contextBridge, ipcRenderer } from 'electron'

console.log("Preload script starting...");

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electron', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...rest] = args
        return ipcRenderer.off(channel, ...rest)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...rest] = args
        return ipcRenderer.send(channel, ...rest)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...rest] = args
        return ipcRenderer.invoke(channel, ...rest)
    },

    // Native Dialogs
    showOpenDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('show-save-dialog', options),

    // File System
    readTextFile: (path: string) => ipcRenderer.invoke('read-text-file', path),
    readBinaryFile: (path: string) => ipcRenderer.invoke('read-binary-file', path),
    scanLocalStls: (folderPath: string) => ipcRenderer.invoke('scan-local-stls', folderPath),
    getFileMetadata: (path: string) => ipcRenderer.invoke('get-file-metadata', path),
    copyFile: (source: string, target: string) => ipcRenderer.invoke('copy-file', source, target),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    checkDirEmpty: (path: string) => ipcRenderer.invoke('check-dir-empty', path),
    migrateStorage: (data: { oldPath: string, newPath: string }) => ipcRenderer.invoke('migrate-storage', data),
    importFileToStorage: (projectId: number, sourcePath: string, customBaseDir: string | null = null, subFolder: string = 'files') => ipcRenderer.invoke('import-file-to-storage', projectId, sourcePath, customBaseDir, subFolder),
    savePastedImage: (projectId: number, buffer: ArrayBuffer, folderPath: string | null, customBaseDir: string | null = null) => ipcRenderer.invoke('save-pasted-image', projectId, buffer, folderPath, customBaseDir),
    checkDbExists: (path: string) => ipcRenderer.invoke('check-db-exists', path),
    fetchBggData: (url: string) => ipcRenderer.invoke('fetch-bgg-data', url),
    translateText: (text: string, targetLang?: string) => ipcRenderer.invoke('translate-text', { text, targetLang }),
    relocateAppData: (newPath: string, copyData: boolean = true) => ipcRenderer.invoke('relocate-app-data', newPath, copyData),
    getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
    initStorage: (folderPath: string) => ipcRenderer.invoke('init-storage', folderPath),

    // Shell
    openPath: (path: string) => ipcRenderer.invoke('open-path', path),
})

// Specifically for database operations
contextBridge.exposeInMainWorld('db', {
    select: (query: string, params?: any[]) => ipcRenderer.invoke('db-select', query, params),
    get: (query: string, params?: any[]) => ipcRenderer.invoke('db-get', query, params),
    execute: (query: string, params?: any[]) => ipcRenderer.invoke('db-execute', query, params),
})

// Asset URL conversion helper (will be implemented via custom protocol in main)
contextBridge.exposeInMainWorld('assets', {
    convertFileSrc: (path: string) => `local-resource://get-asset?path=${encodeURIComponent(path)}`,
})
