-- AlterTable: planillaSheetId pasa a ser opcional — un cliente que ya vive
-- 100% en Publicacion no necesita ninguna planilla de Google.
ALTER TABLE "ClienteContenidoConfig" ALTER COLUMN "planillaSheetId" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('ESPERANDO_FOTO', 'PENDIENTE', 'APROBADO', 'DENEGADO');

-- CreateTable
CREATE TABLE "Publicacion" (
    "id" TEXT NOT NULL,
    "clienteSlug" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "linkImagen" TEXT,
    "red" TEXT,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'PENDIENTE',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "archivo" TEXT,
    "observacion" TEXT,
    "linkDrive" TEXT,
    "tema" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Publicacion_clienteSlug_idx" ON "Publicacion"("clienteSlug");

-- CreateIndex
CREATE INDEX "Publicacion_estado_idx" ON "Publicacion"("estado");

-- CreateIndex
CREATE INDEX "Publicacion_fecha_idx" ON "Publicacion"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Publicacion_clienteSlug_fecha_hora_key" ON "Publicacion"("clienteSlug", "fecha", "hora");
