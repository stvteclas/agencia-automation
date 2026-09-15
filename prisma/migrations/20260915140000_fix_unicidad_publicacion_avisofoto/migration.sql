-- Fix (15/09/2026): la unicidad de Publicacion y AvisoFotoPendiente era
-- [clienteSlug, fecha, hora] — se descubrió al migrar a Romina que dos
-- publicaciones reales de su calendario (campana-horarios-viernes4.png y
-- campana-radiofrecuencia.png, ambas 1/9/2026 11:00) comparten fecha+hora.
-- Con la clave vieja, el importador las trató como la misma fila: la
-- segunda pisó a la primera en silencio (ver
-- agencia/decision-cron-avisos-fotos-pendientes.md). Se agrega `archivo` a
-- la clave para desambiguar.

-- DropIndex
DROP INDEX "Publicacion_clienteSlug_fecha_hora_key";

-- DropIndex
DROP INDEX "AvisoFotoPendiente_clienteSlug_fecha_hora_key";

-- CreateIndex
CREATE UNIQUE INDEX "Publicacion_clienteSlug_fecha_hora_archivo_key" ON "Publicacion"("clienteSlug", "fecha", "hora", "archivo");

-- CreateIndex
CREATE UNIQUE INDEX "AvisoFotoPendiente_clienteSlug_fecha_hora_archivo_key" ON "AvisoFotoPendiente"("clienteSlug", "fecha", "hora", "archivo");
