import Link from "next/link";
import { listarPublicaciones } from "@/lib/publicaciones";
import { prisma } from "@/lib/db";
import { estaAutenticado } from "@/lib/admin-auth";
import { cambiarEstado } from "../actions";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  ESPERANDO_FOTO: "Esperando foto",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  DENEGADO: "Denegado",
};
const ESTADOS = Object.keys(ETIQUETA_ESTADO);

function fmtFecha(fecha: Date) {
  return new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ContenidoClientePage({ params }: { params: { slug: string } }) {
  if (!estaAutenticado()) {
    return (
      <main className="page page--narrow">
        <div className="card">Iniciá sesión en <Link href="/admin">/admin</Link> primero.</div>
      </main>
    );
  }

  const config = await prisma.clienteContenidoConfig.findUnique({ where: { slug: params.slug } });
  const publicaciones = await listarPublicaciones(params.slug);

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <div className="brand">
            <span className="brand-dot" />
            <Link href="/admin/contenido">Contenido</Link>
          </div>
          <h1>{config?.nombre ?? params.slug}</h1>
        </div>
      </div>

      {config?.planillaSheetId && (
        <div className="card empty" style={{ marginBottom: 16 }}>
          Este cliente todavía tiene <code>planillaSheetId</code> configurado — puede seguir teniendo contenido en
          Google Sheets además de lo que se vea acá. Importalo con el endpoint de importación antes de dar de baja la
          planilla.
        </div>
      )}

      {publicaciones.length === 0 ? (
        <div className="card empty">Sin publicaciones cargadas todavía para este cliente.</div>
      ) : (
        <div className="list">
          {publicaciones.map((p) => (
            <div key={p.id} className="row" style={{ cursor: "default" }}>
              <div className="row-top">
                <div style={{ flex: 1 }}>
                  <div className="row-meta">
                    {fmtFecha(p.fecha)} · {p.hora} {p.publicado && "· ✅ Publicado"}
                  </div>
                  <div className="row-title" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {p.texto.length > 220 ? `${p.texto.slice(0, 220)}…` : p.texto}
                  </div>
                  <div className="row-meta" style={{ marginTop: 6 }}>
                    {p.archivo && <>Archivo: {p.archivo} · </>}
                    {p.linkImagen && (
                      <a href={p.linkImagen} target="_blank" rel="noreferrer">
                        Ver imagen
                      </a>
                    )}
                    {p.linkDrive && (
                      <>
                        {" · "}
                        <a href={p.linkDrive} target="_blank" rel="noreferrer">
                          Ver en Drive
                        </a>
                      </>
                    )}
                  </div>
                  {p.observacion && (
                    <div className="row-meta" style={{ marginTop: 4, fontStyle: "italic" }}>
                      Observación: {p.observacion}
                    </div>
                  )}
                </div>

                <form action={cambiarEstado} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="slug" value={params.slug} />
                  <select name="estado" defaultValue={p.estado} className={`badge badge-${p.estado.toLowerCase()}`}>
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {ETIQUETA_ESTADO[e]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-ghost">
                    Guardar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
