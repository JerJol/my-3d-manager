-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "localFolderPath" TEXT,
    "status" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "filamentId" INTEGER,
    CONSTRAINT "Project_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StlFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dimX" REAL,
    "dimY" REAL,
    "dimZ" REAL,
    "volume" REAL,
    CONSTRAINT "StlFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SlicerFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stlFileId" INTEGER NOT NULL,
    "filamentId" INTEGER,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "printTime" INTEGER,
    "filamentLen" REAL,
    "filamentWgt" REAL,
    "nozzleTemp" INTEGER,
    "bedTemp" INTEGER,
    "costElec" REAL,
    "costMachine" REAL,
    "costFilament" REAL,
    CONSTRAINT "SlicerFile_stlFileId_fkey" FOREIGN KEY ("stlFileId") REFERENCES "StlFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlicerFile_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Filament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "material" TEXT NOT NULL,
    "density" REAL NOT NULL DEFAULT 1.24,
    "diameter" REAL NOT NULL DEFAULT 1.75,
    "weight" REAL NOT NULL,
    "price" REAL NOT NULL,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");
