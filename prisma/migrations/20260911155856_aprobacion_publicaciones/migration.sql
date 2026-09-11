-- CreateEnum
CREATE TYPE "TipoSolicitud" AS ENUM ('ALTA_CLIENTE', 'INCIDENCIA', 'TAREA_NUEVA', 'MODIFICACION', 'APROBACION_PUBLICACION');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('NUEVA', 'EN_PROCESO', 'RESUELTA');

-- CreateEnum
CREATE TYPE "RespuestaAprobacion" AS ENUM ('APROBADO', 'CAMBIOS');

-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "paso" TEXT NOT NULL,
    "contextoJson" JSONB NOT NULL DEFAULT '{}',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplicativos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSolicitud" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'NUEVA',
    "telefono" TEXT NOT NULL,
    "nombre" TEXT,
    "aplicativo" TEXT,
    "descripcion" TEXT,
    "respuestas" JSONB,
    "notaInterna" TEXT,
    "detalleResolucion" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "archivo" TEXT,
    "linkPreview" TEXT,
    "respuestaAprobacion" "RespuestaAprobacion",
    "aplicadoEnPlanilla" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_telefono_key" ON "Conversacion"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_telefono_key" ON "Cliente"("telefono");

-- CreateIndex
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");

-- CreateIndex
CREATE INDEX "Solicitud_tipo_idx" ON "Solicitud"("tipo");
