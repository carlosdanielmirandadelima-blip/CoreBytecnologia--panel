-- CreateTable
CREATE TABLE "DynamicDns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'A',
    "currentIp" TEXT NOT NULL DEFAULT '',
    "lastIp" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT 'cloudflare',
    "zoneId" TEXT NOT NULL DEFAULT '',
    "recordId" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL DEFAULT '',
    "interval" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdate" DATETIME,
    "lastCheck" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BuildJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'dockerfile',
    "dockerfile" TEXT NOT NULL DEFAULT 'Dockerfile',
    "context" TEXT NOT NULL DEFAULT '.',
    "gitUrl" TEXT NOT NULL DEFAULT '',
    "gitBranch" TEXT NOT NULL DEFAULT 'main',
    "imageName" TEXT NOT NULL DEFAULT '',
    "imageTag" TEXT NOT NULL DEFAULT 'latest',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "logs" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "icon" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL,
    "ports" TEXT NOT NULL DEFAULT '[]',
    "envVars" TEXT NOT NULL DEFAULT '[]',
    "volumes" TEXT NOT NULL DEFAULT '[]',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerId" TEXT NOT NULL,
    "containerName" TEXT NOT NULL,
    "sourceServer" TEXT NOT NULL DEFAULT 'local',
    "targetServer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT NOT NULL DEFAULT '',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
