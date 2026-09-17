-- CreateTable
CREATE TABLE "McpToolLog" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "argsJson" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    "resumenJson" TEXT,
    "duracionMs" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpToolLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpToolLog_tool_idx" ON "McpToolLog"("tool");

-- CreateIndex
CREATE INDEX "McpToolLog_creadoEn_idx" ON "McpToolLog"("creadoEn");
