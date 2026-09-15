-- CreateTable
CREATE TABLE "ClienteContenidoConfig" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "planillaSheetId" TEXT NOT NULL,
    "planillaGid" TEXT NOT NULL DEFAULT '0',
    "ventanaAvisoDias" INTEGER NOT NULL DEFAULT 5,
    "telefonoAviso" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteContenidoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisoFotoPendiente" (
    "id" TEXT NOT NULL,
    "clienteSlug" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "archivo" TEXT,
    "tituloUsado" TEXT NOT NULL,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisoFotoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClienteContenidoConfig_slug_key" ON "ClienteContenidoConfig"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AvisoFotoPendiente_clienteSlug_fecha_hora_key" ON "AvisoFotoPendiente"("clienteSlug", "fecha", "hora");
