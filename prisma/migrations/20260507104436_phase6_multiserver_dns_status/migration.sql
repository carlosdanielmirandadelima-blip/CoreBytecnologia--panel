-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 2375,
    "protocol" TEXT NOT NULL DEFAULT 'http',
    "tlsCa" TEXT NOT NULL DEFAULT '',
    "tlsCert" TEXT NOT NULL DEFAULT '',
    "tlsKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'offline',
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "cpuPercent" REAL NOT NULL DEFAULT 0,
    "memoryPercent" REAL NOT NULL DEFAULT 0,
    "diskPercent" REAL NOT NULL DEFAULT 0,
    "containers" INTEGER NOT NULL DEFAULT 0,
    "lastCheck" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DnsRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'A',
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proxied" BOOLEAN NOT NULL DEFAULT true,
    "ttl" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusMonitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'http',
    "target" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 60,
    "timeout" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastCheck" DATETIME,
    "lastResponse" INTEGER NOT NULL DEFAULT 0,
    "uptime24h" REAL NOT NULL DEFAULT 100,
    "pageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StatusMonitor_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "StatusPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "monitorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusCheck_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "StatusMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusPage_slug_key" ON "StatusPage"("slug");
