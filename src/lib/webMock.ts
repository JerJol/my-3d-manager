// Replace Electron mock with Supabase‑based shim
import { electron } from './electronWebShim';
(window as any).electron = electron;

if (!(window as any).electron) {
  console.log("Initializing Pure JS Web/Browser Mock Layer...");

  // 1. IndexedDB File System
  const filesRegistry = new Map<string, File | Blob>();
  const objectUrlsMap = new Map<string, string>();

  const openFileDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VirtualFilesDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const getVirtualFile = async (path: string): Promise<Blob | null> => {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req = store.get(path);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error("IndexedDB get error:", e);
      return null;
    }
  };

  const saveVirtualFile = async (path: string, blob: Blob | File): Promise<void> => {
    try {
      const db = await openFileDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        const req = store.put(blob, path);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error("IndexedDB put error:", e);
    }
  };

  // 2. Pure JS In-Memory Database Manager
  const tables = ['AppConfig', 'Categories', 'Filaments', 'Printers', 'Projects', 'ProjectLinks', 'ProjectImages', 'StlFiles', 'SlicerConfigs'];
  const dbData: Record<string, any[]> = {};

  const loadFromLocalStorage = () => {
    for (const table of tables) {
      const data = localStorage.getItem(`db_${table}`);
      dbData[table] = data ? JSON.parse(data) : [];
    }
  };

  const saveToLocalStorage = () => {
    for (const table of tables) {
      localStorage.setItem(`db_${table}`, JSON.stringify(dbData[table]));
    }
  };

  loadFromLocalStorage();

  // Populate default categories if empty
  if (dbData['Categories'].length === 0) {
    dbData['Categories'] = [
      { id: 1, name: "Jeu de société" },
      { id: 2, name: "Figurine" },
      { id: 3, name: "Outil" },
      { id: 4, name: "Décoration" }
    ];
    saveToLocalStorage();
  }

  // Populate some default filaments and printers if empty
  if (dbData['Filaments'].length === 0) {
    dbData['Filaments'] = [
      { id: 1, name: "PLA Basic Black", brand: "Bambu Lab", material: "PLA", density: 1.24, diameter: 1.75, weight: 1000, price: 24.99, color: "#000000" },
      { id: 2, name: "PLA Basic White", brand: "Bambu Lab", material: "PLA", density: 1.24, diameter: 1.75, weight: 1000, price: 24.99, color: "#FFFFFF" }
    ];
    saveToLocalStorage();
  }
  if (dbData['Printers'].length === 0) {
    dbData['Printers'] = [
      { id: 1, name: "Bambu Lab P1S", model: "P1S", powerConsumptionW: 200, machineHourlyCost: 0.5, purchasePrice: 749, lifespanHours: 5000, maintenanceCost: 50 }
    ];
    saveToLocalStorage();
  }

  const nextId = (tableName: string): number => {
    const list = dbData[tableName] || [];
    return list.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
  };

  // Helper to parse STL file metadata in JS
  const parseStlMetadata = (data: ArrayBuffer) => {
    const view = new DataView(data);
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let volume = 0;

    // Check if binary
    const isBinary = data.byteLength > 84 && view.getUint32(80, true) * 50 + 84 === data.byteLength;

    if (isBinary) {
      const faceCount = view.getUint32(80, true);
      for (let i = 0; i < faceCount; i++) {
        const offset = 84 + i * 50;
        for (let v = 0; v < 3; v++) {
          const vx = view.getFloat32(offset + 12 + v * 12, true);
          const vy = view.getFloat32(offset + 12 + v * 12 + 4, true);
          const vz = view.getFloat32(offset + 12 + v * 12 + 8, true);
          minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
          minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
          minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
        }
        const x1 = view.getFloat32(offset + 12, true), y1 = view.getFloat32(offset + 16, true), z1 = view.getFloat32(offset + 20, true);
        const x2 = view.getFloat32(offset + 24, true), y2 = view.getFloat32(offset + 28, true), z2 = view.getFloat32(offset + 32, true);
        const x3 = view.getFloat32(offset + 36, true), y3 = view.getFloat32(offset + 40, true), z3 = view.getFloat32(offset + 44, true);
        volume += (x1 * y2 * z3 - x1 * y3 * z2 - x2 * y1 * z3 + x2 * y3 * z1 + x3 * y1 * z2 - x3 * y2 * z1) / 6.0;
      }
    } else {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(data);
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
  };

  // Helper to parse GCode file metadata
  const parseGcodeMetadata = (content: string) => {
    let printTime = 0;
    let filamentLen = 0;
    const lines = content.split('\n');
    const head = lines.slice(0, 1000);
    const tail = lines.slice(-1000);
    const searchLines = [...head, ...tail];

    for (const line of searchLines) {
      if (line.includes(";TIME:")) {
        printTime = parseInt(line.split(":")[1].trim());
      } else if (line.includes("; estimated printing time")) {
        const timeStr = line.split("=")[1]?.trim();
        if (timeStr) {
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

      if (line.includes("Filament used") && line.includes("m") && !line.includes("[")) {
        const match = line.match(/([0-9.]+)m/);
        if (match) filamentLen = parseFloat(match[1]) * 1000;
      } else if (line.includes("filament used [mm]")) {
        const match = line.match(/=\s*([0-9.]+)/);
        if (match) filamentLen = parseFloat(match[1]);
      }
    }
    return { printTime, filamentLen };
  };

  // 3. Expose Window DB
  (window as any).db = {
    async select(query: string, params: any[] = []) {
      const q = query.trim().replace(/\s+/g, ' ');
      console.log("[Mock DB Select]", q, params);
      
      // 1. AppConfig value check
      if (q.includes("SELECT value FROM AppConfig")) {
        const key = params[0];
        const row = dbData['AppConfig'].find(r => r.key === key);
        return row ? [row] : [];
      }
      
      // 2. Projects dashboard root listing
      if (q.includes("SELECT * FROM Projects p WHERE isDefault = 1 OR (parentProjectId IS NULL")) {
        let list = dbData['Projects'].filter(p => {
          if (p.isDefault == 1 || p.isDefault === true) return true;
          if (!p.parentProjectId) {
            const hasDefaultVersion = dbData['Projects'].some(v => v.parentProjectId == p.id && (v.isDefault == 1 || v.isDefault === true));
            return !hasDefaultVersion;
          }
          return false;
        });
        list = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return list;
      }
      
      // 3. StlFiles check
      if (q.includes("SELECT * FROM StlFiles WHERE projectId")) {
        return dbData['StlFiles'].filter(s => s.projectId == params[0]);
      }
      
      // 4. SlicerConfigs check
      if (q.includes("SELECT * FROM SlicerConfigs WHERE stlId")) {
        return dbData['SlicerConfigs'].filter(s => s.stlId == params[0]);
      }
      
      // 5. Filaments check
      if (q.includes("SELECT * FROM Filaments WHERE id")) {
        return dbData['Filaments'].filter(f => f.id == params[0]);
      }
      
      // 6. Printers check
      if (q.includes("SELECT * FROM Printers WHERE id")) {
        return dbData['Printers'].filter(p => p.id == params[0]);
      }
      
      // 7. ProjectImages check (first image thumbnail or all)
      if (q.includes("SELECT id, url FROM ProjectImages WHERE projectId")) {
        const filtered = dbData['ProjectImages'].filter(img => img.projectId == params[0]).map(img => ({ id: img.id, url: img.url }));
        if (q.includes("LIMIT 1")) {
          return filtered.slice(0, 1);
        }
        return filtered;
      }
      
      // 8. Single project details
      if (q.includes("SELECT * FROM Projects WHERE id")) {
        return dbData['Projects'].filter(p => p.id == params[0]);
      }
      
      // 9. ProjectLinks list
      if (q.includes("SELECT * FROM ProjectLinks WHERE projectId")) {
        return dbData['ProjectLinks'].filter(link => link.projectId == params[0]);
      }
      
      // 10. Categories list
      if (q.includes("SELECT id FROM Categories LIMIT 1")) {
        return dbData['Categories'].slice(0, 1);
      }
      
      // 11. Projects versions
      if (q.includes("SELECT id, versionName, versionNumber, isDefault FROM Projects WHERE id = ? OR parentProjectId = ?")) {
        const id = params[0];
        const ppid = params[1];
        let list = dbData['Projects'].filter(p => p.id == id || p.parentProjectId == ppid);
        list = [...list].sort((a, b) => (a.versionNumber || 0) - (b.versionNumber || 0));
        return list.map(p => ({ id: p.id, versionName: p.versionName, versionNumber: p.versionNumber, isDefault: p.isDefault }));
      }
      
      // 12. Check STL duplication scan
      if (q.includes("SELECT id FROM StlFiles WHERE projectId") && q.includes("path = ? OR name = ?")) {
        return dbData['StlFiles'].filter(s => s.projectId == params[0] && (s.path == params[1] || s.name == params[2]));
      }

      // 13. Check Gcode duplication scan
      if (q.includes("SELECT id FROM SlicerConfigs WHERE stlId") && q.includes("path = ? OR name = ?")) {
        return dbData['SlicerConfigs'].filter(s => s.stlId == params[0] && (s.path == params[1] || s.name == params[2]));
      }

      // 14. Filaments all
      if (q.includes("SELECT * FROM Filaments ORDER BY name")) {
        return [...dbData['Filaments']].sort((a, b) => a.name.localeCompare(b.name));
      }

      // 15. Printers all
      if (q.includes("SELECT * FROM Printers ORDER BY name")) {
        return [...dbData['Printers']].sort((a, b) => a.name.localeCompare(b.name));
      }

      // 16. Categories all
      if (q.includes("SELECT * FROM Categories ORDER BY name")) {
        return [...dbData['Categories']].sort((a, b) => a.name.localeCompare(b.name));
      }

      // 17. ProjectImages all path migrate
      if (q.includes("SELECT id, projectId, url FROM ProjectImages")) {
        return dbData['ProjectImages'];
      }

      // 18. ProjectLinks check BGG
      if (q.includes("SELECT id FROM ProjectLinks WHERE projectId = ? AND (url = ? OR url LIKE ?)")) {
        const pid = params[0];
        const url = params[1];
        const likeUrl = params[2].replace(/%/g, '');
        return dbData['ProjectLinks'].filter(l => l.projectId == pid && (l.url === url || l.url.includes(likeUrl)));
      }

      console.warn("Unhandled Select query:", q, params);
      return [];
    },

    async get(query: string, params: any[] = []) {
      const results = await this.select(query, params);
      return results.length > 0 ? results[0] : null;
    },

    async execute(query: string, params: any[] = []) {
      const q = query.trim().replace(/\s+/g, ' ');
      console.log("[Mock DB Execute]", q, params);
      
      let lastInsertId: number | string = 0;
      let rowsAffected = 0;

      // 1. AppConfig upsert
      if (q.includes("INSERT OR REPLACE INTO AppConfig")) {
        const key = params[0], value = params[1];
        const idx = dbData['AppConfig'].findIndex(r => r.key === key);
        if (idx > -1) dbData['AppConfig'][idx].value = value;
        else dbData['AppConfig'].push({ key, value });
        rowsAffected = 1;
      }
      
      // 2. Create standard project
      else if (q.includes("INSERT INTO Projects") && q.includes("versionNumber, categoryId")) {
        const id = nextId('Projects');
        dbData['Projects'].push({
          id,
          name: params[0],
          description: params[1],
          status: 'En cours',
          versionNumber: 1,
          categoryId: params[2],
          filamentId: params[3],
          printerId: params[4],
          isDefault: 1,
          createdAt: new Date().toISOString()
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 3. Delete Project
      else if (q.includes("DELETE FROM Projects WHERE id")) {
        const id = params[0];
        dbData['Projects'] = dbData['Projects'].filter(p => p.id != id);
        
        // Cascade delete
        const stlIds = dbData['StlFiles'].filter(s => s.projectId == id).map(s => s.id);
        dbData['StlFiles'] = dbData['StlFiles'].filter(s => s.projectId != id);
        dbData['SlicerConfigs'] = dbData['SlicerConfigs'].filter(sc => !stlIds.includes(sc.stlId));
        dbData['ProjectImages'] = dbData['ProjectImages'].filter(img => img.projectId != id);
        dbData['ProjectLinks'] = dbData['ProjectLinks'].filter(l => l.projectId != id);
        rowsAffected = 1;
      }

      // 4. Update project localFolderPath
      else if (q.includes("UPDATE Projects SET localFolderPath")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.localFolderPath = params[0]; rowsAffected = 1; }
      }

      // 5. Update project description
      else if (q.includes("UPDATE Projects SET description")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.description = params[0]; rowsAffected = 1; }
      }

      // 6. Update project name
      else if (q.includes("UPDATE Projects SET name")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.name = params[0]; rowsAffected = 1; }
      }

      // 7. Update project filament
      else if (q.includes("UPDATE Projects SET filamentId")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.filamentId = params[0]; rowsAffected = 1; }
      }

      // 8. Update project printer
      else if (q.includes("UPDATE Projects SET printerId")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.printerId = params[0]; rowsAffected = 1; }
      }

      // 9. Update project category
      else if (q.includes("UPDATE Projects SET categoryId")) {
        const row = dbData['Projects'].find(p => p.id == params[1]);
        if (row) { row.categoryId = params[0]; rowsAffected = 1; }
      }

      // 10. Add single STL file
      else if (q.includes("INSERT INTO StlFiles") && q.includes("volume")) {
        const id = nextId('StlFiles');
        dbData['StlFiles'].push({
          id,
          projectId: params[0],
          name: params[1],
          path: params[2],
          quantity: 1,
          printedQty: 0,
          comment: '',
          status: 'todo',
          dimX: params[3],
          dimY: params[4],
          dimZ: params[5],
          volume: params[6]
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 11. Add slicer config
      else if (q.includes("INSERT INTO SlicerConfigs") && q.includes("filamentLen")) {
        const id = nextId('SlicerConfigs');
        dbData['SlicerConfigs'].push({
          id,
          stlId: params[0],
          name: params[1],
          path: params[2],
          printTime: params[3],
          filamentLen: params[4],
          filamentWgt: 0, nozzleTemp: 0, bedTemp: 0, costElec: 0, costMachine: 0, costFilament: 0
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 12. Delete single STL file
      else if (q.includes("DELETE FROM StlFiles WHERE id")) {
        const id = params[0];
        dbData['StlFiles'] = dbData['StlFiles'].filter(s => s.id != id);
        dbData['SlicerConfigs'] = dbData['SlicerConfigs'].filter(sc => sc.stlId != id);
        rowsAffected = 1;
      }

      // 13. Update STL printed quantity
      else if (q.includes("UPDATE StlFiles SET printedQty")) {
        const row = dbData['StlFiles'].find(s => s.id == params[1]);
        if (row) { row.printedQty = params[0]; rowsAffected = 1; }
      }

      // 14. Create project version
      else if (q.includes("INSERT INTO Projects") && q.includes("versionName, versionNumber")) {
        const id = nextId('Projects');
        dbData['Projects'].push({
          id,
          name: params[0],
          description: params[1],
          status: params[2],
          versionName: params[3],
          versionNumber: params[4],
          theme: params[5],
          localFolderPath: params[6],
          isDefault: params[7],
          parentProjectId: params[8],
          categoryId: params[9],
          filamentId: params[10],
          printerId: params[11],
          createdAt: new Date().toISOString()
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 15. Create STL version clone
      else if (q.includes("INSERT INTO StlFiles") && q.includes("printedQty, comment")) {
        const id = nextId('StlFiles');
        dbData['StlFiles'].push({
          id,
          projectId: params[0],
          name: params[1],
          path: params[2],
          quantity: params[3],
          printedQty: params[4],
          comment: params[5],
          status: params[6],
          dimX: params[7],
          dimY: params[8],
          dimZ: params[9],
          volume: params[10]
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 16. Create Slicer config version clone
      else if (q.includes("INSERT INTO SlicerConfigs") && q.includes("filamentWgt, nozzleTemp")) {
        const id = nextId('SlicerConfigs');
        dbData['SlicerConfigs'].push({
          id,
          stlId: params[0],
          name: params[1],
          path: params[2],
          printTime: params[3],
          filamentLen: params[4],
          filamentWgt: params[5],
          nozzleTemp: params[6],
          bedTemp: params[7],
          costElec: params[8],
          costMachine: params[9],
          costFilament: params[10],
          filamentId: params[11]
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 17. Reset all default versions
      else if (q.includes("UPDATE Projects SET isDefault = 0 WHERE id = ? OR parentProjectId = ?")) {
        const id = params[0];
        const ppid = params[1];
        dbData['Projects'].forEach(p => {
          if (p.id == id || p.parentProjectId == ppid) p.isDefault = 0;
        });
        rowsAffected = 1;
      }

      // 18. Set default version
      else if (q.includes("UPDATE Projects SET isDefault = 1 WHERE id")) {
        const row = dbData['Projects'].find(p => p.id == params[0]);
        if (row) { row.isDefault = 1; rowsAffected = 1; }
      }

      // 19. Update STL comment
      else if (q.includes("UPDATE StlFiles SET comment")) {
        const row = dbData['StlFiles'].find(s => s.id == params[1]);
        if (row) { row.comment = params[0]; rowsAffected = 1; }
      }

      // 20. Update STL quantity
      else if (q.includes("UPDATE StlFiles SET quantity")) {
        const row = dbData['StlFiles'].find(s => s.id == params[1]);
        if (row) { row.quantity = params[0]; rowsAffected = 1; }
      }

      // 21. Add filament
      else if (q.includes("INSERT INTO Filaments")) {
        const id = nextId('Filaments');
        dbData['Filaments'].push({
          id,
          name: params[0], brand: params[1], material: params[2],
          density: params[3], diameter: params[4], weight: params[5],
          price: params[6], color: params[7]
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 22. Update filament
      else if (q.includes("UPDATE Filaments SET name")) {
        const row = dbData['Filaments'].find(f => f.id == params[8]);
        if (row) {
          row.name = params[0]; row.brand = params[1]; row.material = params[2];
          row.density = params[3]; row.diameter = params[4]; row.weight = params[5];
          row.price = params[6]; row.color = params[7];
          rowsAffected = 1;
        }
      }

      // 23. Delete filament
      else if (q.includes("DELETE FROM Filaments WHERE id")) {
        dbData['Filaments'] = dbData['Filaments'].filter(f => f.id != params[0]);
        rowsAffected = 1;
      }

      // 24. Add printer
      else if (q.includes("INSERT INTO Printers")) {
        const id = nextId('Printers');
        dbData['Printers'].push({
          id,
          name: params[0], model: params[1], powerConsumptionW: params[2],
          machineHourlyCost: params[3], purchasePrice: params[4],
          lifespanHours: params[5], maintenanceCost: params[6]
        });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 25. Update printer
      else if (q.includes("UPDATE Printers SET name")) {
        const row = dbData['Printers'].find(p => p.id == params[7]);
        if (row) {
          row.name = params[0]; row.model = params[1]; row.powerConsumptionW = params[2];
          row.machineHourlyCost = params[3]; row.purchasePrice = params[4];
          row.lifespanHours = params[5]; row.maintenanceCost = params[6];
          rowsAffected = 1;
        }
      }

      // 26. Delete printer
      else if (q.includes("DELETE FROM Printers WHERE id")) {
        dbData['Printers'] = dbData['Printers'].filter(p => p.id != params[0]);
        rowsAffected = 1;
      }

      // 27. Add category
      else if (q.includes("INSERT INTO Categories (name) VALUES (?)")) {
        const id = nextId('Categories');
        dbData['Categories'].push({ id, name: params[0] });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 28. Update category
      else if (q.includes("UPDATE Categories SET name")) {
        const row = dbData['Categories'].find(c => c.id == params[1]);
        if (row) { row.name = params[0]; rowsAffected = 1; }
      }

      // 29. Delete category
      else if (q.includes("DELETE FROM Categories WHERE id")) {
        dbData['Categories'] = dbData['Categories'].filter(c => c.id != params[0]);
        rowsAffected = 1;
      }

      // 30. Add project link
      else if (q.includes("INSERT INTO ProjectLinks")) {
        const id = nextId('ProjectLinks');
        dbData['ProjectLinks'].push({ id, projectId: params[0], name: params[1], url: params[2] });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 31. Delete project link
      else if (q.includes("DELETE FROM ProjectLinks WHERE id")) {
        dbData['ProjectLinks'] = dbData['ProjectLinks'].filter(l => l.id != params[0]);
        rowsAffected = 1;
      }

      // 32. Add project image
      else if (q.includes("INSERT INTO ProjectImages")) {
        const id = nextId('ProjectImages');
        dbData['ProjectImages'].push({ id, projectId: params[0], url: params[1] });
        lastInsertId = id;
        rowsAffected = 1;
      }

      // 33. Delete project image
      else if (q.includes("DELETE FROM ProjectImages WHERE id")) {
        dbData['ProjectImages'] = dbData['ProjectImages'].filter(img => img.id != params[0]);
        rowsAffected = 1;
      }

      else {
        console.warn("Unhandled Execute query:", q, params);
      }

      saveToLocalStorage();
      return { lastInsertId, rowsAffected };
    }
  };

  // 4. Expose Window Electron Mock
  (window as any).electron = {
    async getSetupStatus() {
      return { isConfigured: true, storagePath: 'BrowserLocalStorage' };
    },
    async initStorage(folderPath: string) {
      return { success: true };
    },
    async checkDbExists(path: string) {
      return true;
    },
    async getUserDataPath() {
      return 'BrowserUserData';
    },
    async checkDirEmpty(path: string) {
      return true;
    },
    async migrateStorage(data: any) {
      return { success: true };
    },
    async relocateAppData(newPath: string, copyData: boolean = true) {
      return { success: true };
    },
    
    // File upload dialog
    async showOpenDialog(options: any) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        
        if (options.properties?.includes('openDirectory')) {
          input.setAttribute('webkitdirectory', '');
          input.setAttribute('directory', '');
        } else {
          if (options.properties?.includes('multiSelections')) {
            input.multiple = true;
          }
          if (options.filters) {
            const accept = options.filters.map((f: any) => f.extensions.map((ext: string) => `.${ext}`).join(',')).join(',');
            input.accept = accept;
          }
        }
        
        input.onchange = async () => {
          if (!input.files || input.files.length === 0) {
            resolve(null);
            return;
          }
          
          const filePaths: string[] = [];
          for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            // Use virtual path
            const virtualPath = `virtual://${file.name}`;
            filesRegistry.set(virtualPath, file);
            await saveVirtualFile(virtualPath, file);
            filePaths.push(virtualPath);
          }
          
          if (options.properties?.includes('openDirectory')) {
            resolve(`virtual://SelectedDirectory`);
          } else {
            resolve(options.properties?.includes('multiSelections') ? filePaths : filePaths[0]);
          }
        };
        
        input.onerror = () => resolve(null);
        input.click();
      });
    },

    async showSaveDialog(options: any) {
      return 'virtual://SavedFile';
    },

    async importFileToStorage(projectId: number, sourcePath: string, customBaseDir: string | null = null, subFolder: string = 'files') {
      const file = filesRegistry.get(sourcePath);
      const filename = sourcePath.split('://').pop() || 'file';
      const targetPath = `virtual://projects/${projectId}/${subFolder}/${filename}`;
      if (file) {
        filesRegistry.set(targetPath, file);
        await saveVirtualFile(targetPath, file);
      }
      return targetPath;
    },

    async savePastedImage(projectId: number, buffer: ArrayBuffer, folderPath: string | null, customBaseDir: string | null = null) {
      const blob = new Blob([buffer], { type: 'image/png' });
      const targetPath = `virtual://projects/${projectId}/photos/pasted_${Date.now()}.png`;
      filesRegistry.set(targetPath, blob);
      await saveVirtualFile(targetPath, blob);
      return targetPath;
    },

    async getFileMetadata(filePath: string) {
      let file = filesRegistry.get(filePath);
      if (!file) {
        file = await getVirtualFile(filePath) || undefined;
      }
      if (!file) return null;

      try {
        const ext = filePath.toLowerCase().split('.').pop();
        if (ext === 'stl') {
          const buffer = await file.arrayBuffer();
          return parseStlMetadata(buffer);
        } else if (ext === 'gcode' || ext === 'gco') {
          const text = await file.text();
          return parseGcodeMetadata(text);
        }
      } catch (e) {
        console.error("Metadata extraction error:", e);
      }
      return null;
    },

    async readTextFile(filePath: string) {
      let file = filesRegistry.get(filePath);
      if (!file) {
        file = await getVirtualFile(filePath) || undefined;
      }
      if (!file) throw new Error(`File not found: ${filePath}`);
      return await file.text();
    },

    async readBinaryFile(filePath: string) {
      let file = filesRegistry.get(filePath);
      if (!file) {
        file = await getVirtualFile(filePath) || undefined;
      }
      if (!file) throw new Error(`File not found: ${filePath}`);
      const buffer = await file.arrayBuffer();
      return buffer;
    },

    async scanLocalStls(folderPath: string) {
      return Array.from(filesRegistry.keys());
    },

    async copyFile(source: string, target: string) {
      const file = filesRegistry.get(source) || await getVirtualFile(source);
      if (file) {
        filesRegistry.set(target, file);
        await saveVirtualFile(target, file);
        return true;
      }
      return false;
    },

    async fetchBggData(url: string) {
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const json = await response.json();
          return { success: true, data: json.contents };
        }
      } catch (e) {
        console.error("BGG proxy fetch failed:", e);
      }
      return { success: false, error: "CORS error on fetchBggData" };
    },

    async translateText(text: string, targetLang: string = 'fr') {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && data[0]) {
            return data[0].map((s: any) => s[0]).join('');
          }
        }
      } catch (e) {
        console.error("Google translation failed:", e);
      }
      return text;
    },

    async openPath(path: string) {
      console.log("Mock openPath:", path);
    }
  };

  // 5. Expose Window Assets Mock
  (window as any).assets = {
    convertFileSrc(path: string) {
      if (!path) return '';
      
      if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http')) {
        return path;
      }

      const cachedUrl = objectUrlsMap.get(path);
      if (cachedUrl) return cachedUrl;

      const file = filesRegistry.get(path);
      if (file) {
        const url = URL.createObjectURL(file);
        objectUrlsMap.set(path, url);
        return url;
      }

      return `local-resource://get-asset?path=${encodeURIComponent(path)}`;
    }
  };

  // Pre-load all virtual files from IndexedDB to in-memory filesRegistry on startup
  (async () => {
    try {
      const db = await openFileDB();
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      
      const req = store.openCursor();
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          const path = cursor.key as string;
          const blob = cursor.value as Blob;
          filesRegistry.set(path, blob);
          cursor.continue();
        } else {
          console.log("Pre-loaded all virtual files from IndexedDB.");
        }
      };
    } catch (e) {
      console.error("Error pre-loading virtual files:", e);
    }
  })();

  // 6. Network Interceptor for fetch
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    if (urlStr.startsWith('local-resource://')) {
      const url = new URL(urlStr.replace('local-resource://', 'http://localhost/'));
      const filePath = url.searchParams.get('path');
      if (filePath) {
        const decodedPath = decodeURIComponent(filePath);
        let file = filesRegistry.get(decodedPath);
        if (!file) {
          file = await getVirtualFile(decodedPath) || undefined;
        }
        if (file) {
          return new Response(file);
        }
      }
      return new Response('File not found', { status: 404 });
    }
    return originalFetch(input, init);
  };
}
