-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "localFolderPath" TEXT,
    "status" TEXT NOT NULL,
    "tags" TEXT,
    "versionName" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "parentProjectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "filamentId" INTEGER,
    "printerId" INTEGER,
    CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "description", "filamentId", "id", "localFolderPath", "name", "printerId", "status", "tags", "theme", "updatedAt") SELECT "createdAt", "description", "filamentId", "id", "localFolderPath", "name", "printerId", "status", "tags", "theme", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
