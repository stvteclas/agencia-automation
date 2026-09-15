import Link from "next/link";
import { prisma } from "@/lib/db";
import { estaAutenticado } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Landing del dashboard de contenido: un cliente por fila, con cuántas
// publicaciones tiene en cada Estado (solo para los que ya migraron a la
// tabla Publicacion — ver agencia/decision-cron-avisos-fotos-pendientes.md).
export default async function ContenidoPage() {
  if (!estaAutenticado()) {
    return (
      <main className="page page--narrow">
        <div className="card">Iniciá sesión en <Link href="/admin">/admin</Link> primero.</div>
      </main>
    );
  }

  const clientes = await prisma.clienteContenidoConfig.findMany({ orderBy: { nombre: "asc" } });
  const conteos = await prisma.publicacion.groupBy({
    by: ["clienteSlug", "estado"],
    _count: { _all: true },
  });

  const conteoPorCliente = new Map<string, Record<string, number>>();
  for (const c of conteos) {
    const actual = conteoPorCliente.get(c.clienteSlug) ?? {};
    actual[c.estado] = c._count._all;
    conteoPorCliente.set(c.clienteSlug, actual);
  }

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <div className="brand">
            <span className="brand-dot" />
            Panel de atención
          </div>
          <h1>Contenido por cliente</h1>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="card empty">
          Todavía no hay ningún cliente cargado en ClienteContenidoConfig. Sumalo con un POST a
          <code> /api/admin/clientes-contenido</code>.
        </div>
      ) : (
        <div className="list">
          {clientes.map((c) => {
            const conteo = conteoPorCliente.get(c.slug) ?? {};
            const total = Object.values(conteo).reduce((a, b) => a + b, 0);
            return (
              <Link key={c.slug} href={`/admin/contenido/${c.slug}`} className="row">
                <div className="row-top">
                  <div>
                    <div className="row-title">{c.nombre}</div>
                    <div className="row-meta">
                      {c.planillaSheetId
                        ? "Todavía en Google Sheets — no migrado a Publicacion"
                        : total > 0
                          ? `${total} publicaciones — Esperando foto: ${conteo.ESPERANDO_FOTO ?? 0} · Pendiente: ${conteo.PENDIENTE ?? 0} · Aprobado: ${conteo.APROBADO ?? 0} · Denegado: ${conteo.DENEGADO ?? 0}`
                          : "Sin publicaciones cargadas todavía"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
