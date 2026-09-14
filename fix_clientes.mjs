// Arregla el Cliente de Romina (corrompido por el loop del 13/09) y crea los
// que faltaban. Ajustá nombre/aplicativos si querés otro valor por defecto
// antes de correrlo.
//
// Uso: node fix_clientes.mjs   (parado en la raíz de bot-atencion-agencia)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const registros = [
  { telefono: "5493543318665", nombre: "Romina Balquinta", aplicativos: [] }, // trabajo — corrompido por el loop, se resetea
  { telefono: "5493515733863", nombre: "Romina Balquinta", aplicativos: [] }, // personal — no existía
  { telefono: "5493518154420", nombre: "Loyola María Cecilia", aplicativos: [] }, // Club — no existía
];

async function main() {
  for (const r of registros) {
    const resultado = await prisma.cliente.upsert({
      where: { telefono: r.telefono },
      update: { nombre: r.nombre, aplicativos: r.aplicativos },
      create: { telefono: r.telefono, nombre: r.nombre, aplicativos: r.aplicativos },
    });
    console.log(`OK ${r.telefono} -> nombre="${resultado.nombre}", aplicativos=${JSON.stringify(resultado.aplicativos)}`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
