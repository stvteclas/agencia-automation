import { prisma } from "./db";

export async function buscarClientePorTelefono(telefono: string) {
  return prisma.cliente.findUnique({ where: { telefono } });
}

export async function crearOActualizarCliente(telefono: string, nombre: string) {
  return prisma.cliente.upsert({
    where: { telefono },
    update: { nombre },
    create: { telefono, nombre },
  });
}

// Suma un aplicativo nuevo a la lista del cliente (si no lo tenía ya), para
// que la próxima consulta sobre ese mismo aplicativo ya se lo podamos
// ofrecer como opción en vez de preguntarlo de cero.
export async function agregarAplicativoSiNoExiste(telefono: string, nombre: string, aplicativo?: string) {
  const cliente = await prisma.cliente.upsert({
    where: { telefono },
    update: {},
    create: { telefono, nombre, aplicativos: [] },
  });
  if (aplicativo && !cliente.aplicativos.some((a) => a.toLowerCase() === aplicativo.toLowerCase())) {
    await prisma.cliente.update({
      where: { telefono },
      data: { aplicativos: { push: aplicativo } },
    });
  }
}
