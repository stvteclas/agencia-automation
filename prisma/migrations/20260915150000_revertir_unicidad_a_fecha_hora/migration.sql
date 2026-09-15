-- Revierte la migración 20260915140000: Pablo decidió que dos filas con la
-- misma fecha+hora para un cliente son un error de carga en el Sheet (no un
-- caso real a soportar), así que la unicidad vuelve a ser solo
-- [clienteSlug, fecha, hora] — la fila más nueva sigue pisando a la vieja
-- en ese caso, a propósito.

-- DropIndex
DROP INDEX "Publicacion_clienteSlug_fecha_hora_archivo_key";

-- DropIndex
DROP INDEX "AvisoFotoPendiente_clienteSlug_fecha_hora_archivo_key";

-- CreateIndex
CREATE UNIQUE INDEX "Publicacion_clienteSlug_fecha_hora_key" ON "Publicacion"("clienteSlug", "fecha", "hora");

-- CreateIndex
CREATE UNIQUE INDEX "AvisoFotoPendiente_clienteSlug_fecha_hora_key" ON "AvisoFotoPendiente"("clienteSlug", "fecha", "hora");
