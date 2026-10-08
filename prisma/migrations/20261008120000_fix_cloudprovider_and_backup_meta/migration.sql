-- AlterTable
ALTER TABLE "BackupSchedule" ADD COLUMN "cloudDestination" TEXT;

-- CreateTable
CREATE TABLE "CloudProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'credentials',
    "config" TEXT NOT NULL DEFAULT '{}',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "folder" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoBackup" BOOLEAN NOT NULL DEFAULT false,
    "autoFrequency" TEXT NOT NULL DEFAULT 'daily',
    "lastSync" DATETIME,
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Backup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'volume',
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduleId" TEXT,
    "cloudProviderId" TEXT DEFAULT '',
    "remotePath" TEXT NOT NULL DEFAULT '',
    "uploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Backup_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BackupSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Backup" ("createdAt", "fileName", "filePath", "fileSize", "id", "name", "scheduleId", "source", "status", "type") SELECT "createdAt", "fileName", "filePath", "fileSize", "id", "name", "scheduleId", "source", "status", "type" FROM "Backup";
DROP TABLE "Backup";
ALTER TABLE "new_Backup" RENAME TO "Backup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

