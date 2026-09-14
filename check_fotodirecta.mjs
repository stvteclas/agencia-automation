// Chequeo rápido del circuito de "publicación directa" (fotoDirecta) —
// confirma que la migración de Prisma se aplicó bien y muestra el estado
// real de los Cliente y las fotos sueltas que llegaron.
//
// Uso: node check_fotodirecta.mjs   (parado en la raíz de bot-atencion-agencia)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== 1) ¿Existe el campo fotoDirecta? ===");
  try {
    const count = await prisma.solicitud.count({ where: { fotoDirecta: true } });
    console.log(`OK — la columna existe. Solicitudes con fotoDirecta=true: ${count}`);
  } catch (err) {
    console.error("FALLÓ — probablemente la migración de Prisma no se aplicó todavía.");
    console.error(err.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n=== 2) Clientes registrados (Romina y Club) ===");
  const telefonos = [
    "5493543318665", // Romina - trabajo
    "5493515733863", // Romina - personal
    "5493518154420", // Loyola / Club
  ];
  for (const telefono of telefonos) {
    const cliente = await prisma.cliente.findUnique({ where: { telefono } });
    console.log(
      cliente
        ? `${telefono} -> Cliente OK: nombre="${cliente.nombre}", aplicativos=${JSON.stringify(cliente.aplicativos)}`
        : `${telefono} -> NO está registrado como Cliente`,
    );
  }

  console.log("\n=== 3) Últimas 10 Solicitud tipo APROBACION_PUBLICACION (cualquier circuito) ===");
  const solicitudes = await prisma.solicitud.findMany({
    where: { tipo: "APROBACION_PUBLICACION" },
    orderBy: { creadoEn: "desc" },
    take: 10,
  });
  if (solicitudes.length === 0) {
    console.log("(no hay ninguna todavía)");
  }
  for (const s of solicitudes) {
    console.log(
      `${s.creadoEn.toISOString()} | tel=${s.telefono} | fotoDirecta=${s.fotoDirecta} | estado=${s.estado} | respuesta=${s.respuestaAprobacion ?? "-"} | aplicadoEnPlanilla=${s.aplicadoEnPlanilla} | archivo=${s.archivo ?? "-"} | link=${s.linkPreview ?? "-"}`,
    );
  }

  console.log("\n=== 4) Solo las fotos del circuito directo, sin aplicar todavía ===");
  const pendientes = await prisma.solicitud.findMany({
    where: { tipo: "APROBACION_PUBLICACION", fotoDirecta: true, aplicadoEnPlanilla: false },
    orderBy: { creadoEn: "asc" },
  });
  if (pendientes.length === 0) {
    console.log("(ninguna pendiente de emparejar — o no llegó ninguna foto todavía, o ya se aplicaron todas)");
  }
  for (const p of pendientes) {
    console.log(`${p.creadoEn.toISOString()} | tel=${p.telefono} | link=${p.linkPreview}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Error inesperado:", err);
  await prisma.$disconnect();
  process.exit(1);
});
