-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Printer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "powerConsumptionW" INTEGER NOT NULL DEFAULT 0,
    "machineHourlyCost" REAL NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "lifespanHours" INTEGER NOT NULL DEFAULT 0,
    "maintenanceCost" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Printer" ("id", "machineHourlyCost", "model", "name", "powerConsumptionW") SELECT "id", "machineHourlyCost", "model", "name", "powerConsumptionW" FROM "Printer";
DROP TABLE "Printer";
ALTER TABLE "new_Printer" RENAME TO "Printer";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
