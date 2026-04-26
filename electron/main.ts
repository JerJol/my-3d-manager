import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let db: any
let currentDbPath: string

async function getStorageConfig() {
    const configPath = path.join(app.getPath('userData'), 'storage-config.json');
    try {
        const data = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(data);
        console.log(`[Config] Loaded storage path: ${config.storagePath}`);
        if (config.storagePath) return { storagePath: config.storagePath, isConfigured: true };
    } catch (e) {
        console.log("[Config] No storage-config.json found.");
    }
    return { storagePath: null, isConfigured: false };
}

async function saveStorageConfig(storagePath: string) {
    const userData = app.getPath('userData');
    const configPath = path.join(userData, 'storage-config.json');
    console.log(`[Config] Saving storage path ${storagePath} to ${configPath}`);
    await fs.mkdir(userData, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({ storagePath }, null, 2));
}

console.log("Main process starting...");

// Register local-resource protocol
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-resource', privileges: { bypassCSP: true, stream: true, secure: true, supportFetchAPI: true } }
])

async function initDb() {
    try {
        const config = await getStorageConfig();
        currentDbPath = path.join(config.storagePath, 'my3dmanager.db');

        console.log("Initializing database at:", currentDbPath);
        // Ensure directory exists
        await fs.mkdir(path.dirname(currentDbPath), { recursive: true });

        db = new Database(currentDbPath)

        // Initialize schema
        db.exec(`
          CREATE TABLE IF NOT EXISTS AppConfig (key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS Categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS Filaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL, 
            diameter REAL DEFAULT 1.75, 
            density REAL DEFAULT 1.25, 
            weight REAL DEFAULT 1000, 
            price REAL DEFAULT 0,
            brand TEXT,
            material TEXT,
            color TEXT
          );
          CREATE TABLE IF NOT EXISTS Printers (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL, 
            machineHourlyCost REAL DEFAULT 0,
            model TEXT,
            powerConsumptionW INTEGER DEFAULT 0,
            purchasePrice REAL DEFAULT 0,
            lifespanHours INTEGER DEFAULT 5000,
            maintenanceCost REAL DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS Projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'En cours', versionName TEXT, versionNumber INTEGER DEFAULT 1, theme TEXT, localFolderPath TEXT, isDefault BOOLEAN DEFAULT 0, parentProjectId INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, categoryId INTEGER, filamentId INTEGER, printerId INTEGER, FOREIGN KEY(categoryId) REFERENCES Categories(id), FOREIGN KEY(filamentId) REFERENCES Filaments(id), FOREIGN KEY(printerId) REFERENCES Printers(id), FOREIGN KEY(parentProjectId) REFERENCES Projects(id));
          CREATE TABLE IF NOT EXISTS ProjectLinks (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER, name TEXT NOT NULL, url TEXT NOT NULL, FOREIGN KEY(projectId) REFERENCES Projects(id) ON DELETE CASCADE);
          CREATE TABLE IF NOT EXISTS ProjectImages (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER, url TEXT NOT NULL, FOREIGN KEY(projectId) REFERENCES Projects(id) ON DELETE CASCADE);
          CREATE TABLE IF NOT EXISTS StlFiles (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER, name TEXT NOT NULL, path TEXT NOT NULL, quantity INTEGER DEFAULT 1, printedQty INTEGER DEFAULT 0, comment TEXT, status TEXT DEFAULT 'todo', dimX REAL, dimY REAL, dimZ REAL, volume REAL, FOREIGN KEY(projectId) REFERENCES Projects(id) ON DELETE CASCADE);
          CREATE TABLE IF NOT EXISTS SlicerConfigs (id INTEGER PRIMARY KEY AUTOINCREMENT, stlId INTEGER, name TEXT NOT NULL, path TEXT NOT NULL, printTime INTEGER, filamentLen REAL, filamentWgt REAL, nozzleTemp INTEGER, bedTemp INTEGER, costElec REAL, costMachine REAL, costFilament REAL, filamentId INTEGER, FOREIGN KEY(stlId) REFERENCES StlFiles(id) ON DELETE CASCADE, FOREIGN KEY(filamentId) REFERENCES Filaments(id));
        `)

        // Migrations
        const tables = ['Filaments', 'Printers'];
        const columns: Record<string, string[]> = {
            'Filaments': [
                'ALTER TABLE Filaments ADD COLUMN brand TEXT',
                'ALTER TABLE Filaments ADD COLUMN material TEXT',
                'ALTER TABLE Filaments ADD COLUMN color TEXT'
            ],
            'Printers': [
                'ALTER TABLE Printers ADD COLUMN model TEXT',
                'ALTER TABLE Printers ADD COLUMN powerConsumptionW INTEGER DEFAULT 0',
                'ALTER TABLE Printers ADD COLUMN purchasePrice REAL DEFAULT 0',
                'ALTER TABLE Printers ADD COLUMN lifespanHours INTEGER DEFAULT 5000',
                'ALTER TABLE Printers ADD COLUMN maintenanceCost REAL DEFAULT 0'
            ]
        };

        for (const table of tables) {
            const currentCols = db.prepare(`PRAGMA table_info(${table})`).all();
            const colNames = currentCols.map((c: any) => c.name);

            for (const migration of columns[table]) {
                const newColName = migration.split('ADD COLUMN ')[1].split(' ')[0];
                if (!colNames.includes(newColName)) {
                    console.log(`Migrating ${table}: adding column ${newColName}`);
                    try {
                        db.exec(migration);
                    } catch (e) {
                        console.warn(`Migration failed for ${table}.${newColName}:`, e);
                    }
                }
            }
        }

        const row = db.prepare('SELECT id FROM Categories LIMIT 1').get()
        if (!row) {
            db.prepare("INSERT INTO Categories (name) VALUES (?), (?), (?), (?)").run('Jeu de société', 'Figurine', 'Outil', 'Décoration')
        }
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Database initialization failed:", error);
    }
}

// IPC Handlers
ipcMain.handle('db-select', (event, query, params = []) => {
    if (!db) {
        console.warn(`[DB] Attempted select before init: ${query}`);
        return [];
    }
    try {
        const safeParams = Array.isArray(params) ? params : [params]
        return db.prepare(query).all(...safeParams)
    } catch (error) {
        console.error(`DB Select Error [${query}]:`, error)
        throw error
    }
})

ipcMain.handle('db-get', (event, query, params = []) => {
    if (!db) {
        console.warn(`[DB] Attempted get before init: ${query}`);
        return null;
    }
    try {
        const safeParams = Array.isArray(params) ? params : [params]
        return db.prepare(query).get(...safeParams)
    } catch (error) {
        console.error(`DB Get Error [${query}]:`, error)
        throw error
    }
})

ipcMain.handle('db-execute', (event, query, params = []) => {
    if (!db) {
        console.warn(`[DB] Attempted execute before init: ${query}`);
        return { lastInsertId: 0, rowsAffected: 0 };
    }
    try {
        const safeParams = Array.isArray(params) ? params : [params]
        const result = db.prepare(query).run(...safeParams)
        return { lastInsertId: Number(result.lastInsertRowid), rowsAffected: result.changes }
    } catch (error) {
        console.error(`DB Execute Error [${query}]:`, error)
        throw error
    }
})
ipcMain.handle('read-text-file', async (event, filePath) => {
    return fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('read-binary-file', async (event, filePath) => {
    const buffer = await fs.readFile(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

ipcMain.handle('fetch-bgg-data', async (event, url) => {
    try {
        console.log(`[Main] Fetching BGG URL: ${url}`);
        const isApi = url.includes('xmlapi2') || url.includes('xmlapi');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://boardgamegeek.com/',
                'Accept': isApi ? 'application/xml, text/xml, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Could not read error body");
            console.error(`[Main] BGG Fetch failed. Status: ${response.status}. Body: ${errorText.substring(0, 100)}`);
            return {
                success: false,
                status: response.status,
                error: `HTTP ${response.status}`
            };
        }

        const text = await response.text();
        console.log(`[Main] BGG Fetch success. Data length: ${text.length}`);
        return {
            success: true,
            data: text
        };
    } catch (error: any) {
        console.error('[Main] BGG fetch error:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
});

ipcMain.handle('translate-text', async (event, { text, targetLang = 'fr' }) => {
    try {
        console.log(`[Main] Translating text to ${targetLang} (length: ${text?.length})`);
        if (!text || text.trim().length === 0) return text;

        // Use Google Translate free RPC endpoint
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }

        const data = await response.json();
        // Google's format: [[["translated", "source", null, null, 3], ...], null, "en"]
        if (data && data[0]) {
            const translated = data[0].map((s: any) => s[0]).join('');
            console.log(`[Main] Translation success.`);
            return translated;
        }

        return text;
    } catch (error) {
        console.error('[Main] Translation error:', error);
        return text; // Return original on failure
    }
});

ipcMain.handle('check-db-exists', async (event, folderPath) => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    try {
        const dbPath = path.join(folderPath, 'my3dmanager.db');
        await fs.access(dbPath);
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('relocate-app-data', async (event, newPath, copyData = true) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    try {
        const config = await getStorageConfig();
        const oldPath = config.storagePath;
        if (oldPath === newPath) {
            console.log("[Relocate] Target path is identical to current path. Skipping.");
            return { success: true };
        }

        console.log(`[Relocate] Closing DB at ${currentDbPath}. CopyData: ${copyData}`);
        if (db) {
            db.close();
        }

        if (copyData) {
            console.log(`[Relocate] Copying data from ${oldPath} to ${newPath}`);
            const foldersToMove = ['projects', 'storage', 'pasted_images', 'photos', 'my3dmanager.db'];

            for (const item of foldersToMove) {
                const src = path.join(oldPath, item);
                const dest = path.join(newPath, item);

                try {
                    const stats = await fs.stat(src);
                    console.log(`[Relocate] Moving ${item}...`);
                    // Copy recursively
                    async function copyRecursive(s: string, d: string) {
                        const st = await fs.stat(s);
                        if (st.isDirectory()) {
                            await fs.mkdir(d, { recursive: true });
                            const entries = await fs.readdir(s);
                            for (const entry of entries) {
                                await copyRecursive(path.join(s, entry), path.join(d, entry));
                            }
                        } else {
                            await fs.copyFile(s, d);
                        }
                    }
                    await copyRecursive(src, dest);
                } catch (err: any) {
                    console.log(`[Relocate] Skipping ${item} (not found or error: ${err.message})`);
                }
            }

            // After successful copy, delete original items from oldPath
            console.log(`[Relocate] Cleaning up source files from ${oldPath}`);
            for (const item of foldersToMove) {
                const src = path.join(oldPath, item);
                try {
                    await fs.rm(src, { recursive: true, force: true });
                    console.log(`[Relocate] Removed source: ${item}`);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        }

        // Cleanup: remove system folders that might be in the target folder
        const cleanupFolders = ['Cache', 'Code Cache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GPUCache', 'Local Storage', 'Network', 'blob_storage', 'Session Storage', 'Shared Dictionary', 'Local State', 'Preferences', 'SharedStorage', 'DIPS', 'DIPS-wal'];
        for (const folder of cleanupFolders) {
            const folderPath = path.join(newPath, folder);
            try {
                await fs.rm(folderPath, { recursive: true, force: true });
            } catch (e) { }
        }

        // Update config and reopen
        await saveStorageConfig(newPath);
        currentDbPath = path.join(newPath, 'my3dmanager.db');
        console.log(`[Relocate] Reopening DB at ${currentDbPath}`);
        db = new Database(currentDbPath);

        return { success: true };
    } catch (error: any) {
        console.error('[Relocate] Error:', error);
        // Try to reopen old db to avoid broken state
        try { if (!db) db = new Database(currentDbPath); } catch (e) { }
        return { success: false, error: error.message };
    }
})

ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData')
})

ipcMain.handle('check-dir-empty', async (event, dirPath) => {
    try {
        const files = await fs.readdir(dirPath)
        return files.length === 0
    } catch (e) {
        return true // If doesn't exist, it's empty
    }
})

ipcMain.handle('migrate-storage', async (event, { oldPath, newPath }) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function copyRecursive(src: string, dest: string) {
        const stats = await fs.stat(src)
        if (stats.isDirectory()) {
            await fs.mkdir(dest, { recursive: true })
            const entries = await fs.readdir(src)
            for (const entry of entries) {
                await copyRecursive(path.join(src, entry), path.join(dest, entry))
            }
        } else {
            await fs.copyFile(src, dest)
        }
    }

    try {
        if (oldPath === newPath) return { success: true }
        await copyRecursive(oldPath, newPath)
        return { success: true }
    } catch (error: any) {
        console.error('Migration Error:', error)
        return { success: false, error: error.message }
    }
})

function parseGcodeMetadata(content: string) {
    let printTime = 0;
    let filamentLen = 0;
    const lines = content.split('\n');
    const head = lines.slice(0, 1000);
    const tail = lines.slice(-1000);
    const searchLines = [...head, ...tail];

    for (const line of searchLines) {
        // --- Print Time ---
        // Cura
        if (line.includes(";TIME:")) {
            printTime = parseInt(line.split(":")[1].trim());
        }
        // Prusa / Bambu / Orca
        else if (line.includes("; estimated printing time")) {
            const timeStr = line.split("=")[1]?.trim();
            if (timeStr) {
                // Handle "1h 2m 3s" or "2m 3s" or "3s"
                let totalS = 0;
                const h = timeStr.match(/(\d+)h/);
                const m = timeStr.match(/(\d+)m/);
                const s = timeStr.match(/(\d+)s/);
                if (h) totalS += parseInt(h[1]) * 3600;
                if (m) totalS += parseInt(m[1]) * 60;
                if (s) totalS += parseInt(s[1]);
                if (totalS > 0) printTime = totalS;
            }
        }

        // --- Filament Length (mm) ---
        // Cura: "Filament used: 1.23m"
        if (line.includes("Filament used") && line.includes("m") && !line.includes("[")) {
            const match = line.match(/([0-9.]+)m/);
            if (match) filamentLen = parseFloat(match[1]) * 1000;
        }
        // Prusa / Bambu / Orca: "; filament used [mm] = 1234.5"
        else if (line.includes("filament used [mm]")) {
            const match = line.match(/=\s*([0-9.]+)/);
            if (match) filamentLen = parseFloat(match[1]);
        }
    }
    return { printTime, filamentLen };
}

function parseStlMetadata(data: Buffer) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let volume = 0;

    const isBinary = data.length > 84 && data.readUInt32LE(80) * 50 + 84 === data.length;

    if (isBinary) {
        const faceCount = data.readUInt32LE(80);
        for (let i = 0; i < faceCount; i++) {
            const offset = 84 + i * 50;
            for (let v = 0; v < 3; v++) {
                const vx = data.readFloatLE(offset + 12 + v * 12);
                const vy = data.readFloatLE(offset + 12 + v * 12 + 4);
                const vz = data.readFloatLE(offset + 12 + v * 12 + 8);
                minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
                minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
                minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
            }
            const x1 = data.readFloatLE(offset + 12), y1 = data.readFloatLE(offset + 16), z1 = data.readFloatLE(offset + 20);
            const x2 = data.readFloatLE(offset + 24), y2 = data.readFloatLE(offset + 28), z2 = data.readFloatLE(offset + 32);
            const x3 = data.readFloatLE(offset + 36), y3 = data.readFloatLE(offset + 40), z3 = data.readFloatLE(offset + 44);
            volume += (x1 * y2 * z3 - x1 * y3 * z2 - x2 * y1 * z3 + x2 * y3 * z1 + x3 * y1 * z2 - x3 * y2 * z1) / 6.0;
        }
    } else {
        const text = data.toString('utf-8');
        const lines = text.split('\n');
        let triangle: number[][] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('vertex')) {
                const parts = trimmed.split(/\s+/);
                const vx = parseFloat(parts[1]), vy = parseFloat(parts[2]), vz = parseFloat(parts[3]);
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

ipcMain.handle('get-file-metadata', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.stl') {
            const buffer = await fs.readFile(filePath);
            return parseStlMetadata(buffer);
        } else if (ext === '.gcode' || ext === '.gco') {
            const content = await fs.readFile(filePath, 'utf-8');
            const meta = parseGcodeMetadata(content);
            console.log('Gcode Metadata for', filePath, ':', meta);
            return meta;
        }
    } catch (e) {
        console.error('Metadata Error for', filePath, ':', e);
    }
    return null;
})

ipcMain.handle('scan-local-stls', async (event, folderPath) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function getProjectFiles(dir: string): Promise<string[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const files = await Promise.all(entries.map((res) => {
            const fullPath = path.join(dir, res.name)
            if (res.isDirectory()) return getProjectFiles(fullPath)
            const ext = res.name.toLowerCase()
            return (ext.endsWith('.stl') || ext.endsWith('.gcode') || ext.endsWith('.gco')) ? fullPath : []
        }))
        return Array.prototype.concat(...files)
    }

    try {
        return await getProjectFiles(folderPath)
    } catch (error) {
        console.error('Scan Error:', error)
        return []
    }
})

ipcMain.handle('show-open-dialog', async (event, options) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(options)
    if (canceled) return null
    return options.properties?.includes('multiSelections') ? filePaths : filePaths[0]
})

ipcMain.handle('copy-file', async (event, sourcePath, targetPath) => {
    const fs = await import('node:fs/promises')
    await fs.copyFile(sourcePath, targetPath)
    return true
})

ipcMain.handle('import-file-to-storage', async (event, projectId, sourcePath, customBaseDir = null, subFolder = 'files') => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const { app } = await import('electron')

    const filename = path.basename(sourcePath)
    const baseDir = customBaseDir || app.getPath('userData')
    const targetFolder = path.join(baseDir, 'projects', projectId.toString(), subFolder)

    await fs.mkdir(targetFolder, { recursive: true })
    const targetPath = path.join(targetFolder, filename)

    // Copy the file
    await fs.copyFile(sourcePath, targetPath)

    return targetPath
})

ipcMain.handle('open-path', async (event, path) => {
    await shell.openPath(path)
})

ipcMain.handle('show-save-dialog', async (event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(options)
    if (canceled) return null
    return filePath
})

ipcMain.handle('save-pasted-image', async (event, projectId, buffer, folderPath, customBaseDir = null) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    console.log(`[save-pasted-image] Project: ${projectId}, Folder: ${folderPath}, CustomBase: ${customBaseDir}`);
    const timestamp = Date.now()
    const filename = `pasted_${timestamp}.png`

    let targetFolder: string;

    // Always use global storage path for photos, even if a custom folderPath for STLs is defined
    const baseDir = customBaseDir || app.getPath('userData');
    targetFolder = path.join(baseDir, 'projects', projectId.toString(), 'photos');

    console.log(`[save-pasted-image] Target Folder: ${targetFolder}`);
    await fs.mkdir(targetFolder, { recursive: true })
    const filePath = path.join(targetFolder, filename)
    await fs.writeFile(filePath, Buffer.from(buffer))
    console.log(`[save-pasted-image] Saved to: ${filePath}`);

    return filePath
})

ipcMain.handle('get-setup-status', async () => {
    const config = await getStorageConfig();
    return {
        isConfigured: config.isConfigured,
        storagePath: config.storagePath
    };
});

ipcMain.handle('init-storage', async (event, folderPath) => {
    console.log(`[Setup] Initializing storage at: ${folderPath}`);
    await saveStorageConfig(folderPath);
    await initDb();
    return { success: true };
});

function createWindow() {
    const publicPath = process.env.VITE_PUBLIC || path.join(process.env.DIST || __dirname, '../public')
    console.log("Creating window with publicPath:", publicPath);

    win = new BrowserWindow({
        icon: path.join(publicPath, 'electron-vite.svg'),
        width: 1280,
        minWidth: 1000,
        height: 800,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    // Maximized check
    // win.maximize();

    if (process.env.VITE_DEV_SERVER_URL) {
        console.log("Loading URL:", process.env.VITE_DEV_SERVER_URL);
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        const distPath = process.env.DIST || path.join(__dirname, '../dist')
        console.log("Loading file:", path.join(distPath, 'index.html'));
        win.loadFile(path.join(distPath, 'index.html'))
    }
}

app.whenReady().then(async () => {
    console.log("App ready!");

    // Register local-resource protocol handler
    protocol.handle('local-resource', (request) => {
        try {
            const url = new URL(request.url)
            const filePath = url.searchParams.get('path')
            if (!filePath) return new Response('Missing path', { status: 400 })
            const decodedPath = decodeURIComponent(filePath)
            return net.fetch(pathToFileURL(decodedPath).toString())
        } catch (e) {
            console.error('Protocol Error:', e)
            return new Response('Error', { status: 500 })
        }
    })

    const config = await getStorageConfig();
    if (config.isConfigured && config.storagePath) {
        await initDb()
    } else {
        console.log("[Setup] App not configured. Waiting for user setup.");
    }
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
