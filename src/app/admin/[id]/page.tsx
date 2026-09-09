import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSolicitud, etiquetaTipo } from "@/lib/solicitudes";
import { marcarResuelta, marcarEnProceso } from "../actions";
import { estaAutenticado } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ETIQUETAS_PREGUNTAS: Record<string, string> = {
  nombre_negocio: "Nombre del negocio",
  rubro: "Rubro",
  contacto_aprobador: "Contacto que aprueba",
  direccion: "Dirección",
  horario_atencion: "Horario de atención",
  turnos_o_productos: "Turnos / productos",
  tono_de_voz: "Tono de voz",
  promesas_prohibidas: "Promesas prohibidas",
  publico_objetivo: "Público objetivo",
  colores_marca: "Colores de marca",
  logo_claro: "Logo (claro)",
  logo_oscuro: "Logo (oscuro)",
  tipografias: "Tipografías",
  datos_contacto_piezas: "Datos de contacto en piezas",
  pilares_contenido: "Pilares de contenido",
  ideas_por_servicio: "Ideas por servicio/producto",
  hashtags: "Hashtags",
  consentimiento_fotos_reales: "Consentimiento fotos reales",
  frecuencia_publicacion: "Frecuencia de publicación",
  horarios_publicacion: "Horarios de publicación",
  aprobador_unico: "Aprobador único",
  reciclaje_contenido: "Reciclaje de contenido",
  fechas_puntuales: "Fechas puntuales",
  aviso_contenido_nuevo: "Aviso de contenido nuevo",
  detalles_adicionales: "Detalles adicionales",
};

function esUrlDeImagen(v: string) {
  return /^https?:\/\//.test(v) && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(v);
}

export default async function DetalleSolicitud({ params }: { params: { id: string } }) {
  if (!estaAutenticado()) return <p style={{ fontFamily: "system-ui" }}>No autorizado. Entrá por /admin.</p>;

  const solicitud = await obtenerSolicitud(params.id);
  if (!solicitud) return notFound();

  const marcarResueltaConId = marcarResuelta.bind(null, solicitud.id);
  const marcarEnProcesoConId = marcarEnProceso.bind(null, solicitud.id);

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <Link href="/admin">← Volver</Link>
      <h1 style={{ fontSize: 20, marginTop: 8 }}>
        {etiquetaTipo(solicitud.tipo)} — {solicitud.telefono}
      </h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Creada el {new Date(solicitud.creadoEn).toLocaleString("es-AR")} · Estado actual: <b>{solicitud.estado}</b>
      </p>

      {solicitud.tipo === "ALTA_CLIENTE" ? (
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse", marginTop: 16 }}>
          <tbody>
            {Object.entries((solicitud.respuestas as Record<string, string>) ?? {}).map(([id, valor]) => (
              <tr key={id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px", color: "#666", verticalAlign: "top", width: 220 }}>
                  {ETIQUETAS_PREGUNTAS[id] ?? id}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  {esUrlDeImagen(valor) ? (
                    <a href={valor} target="_blank" rel="noreferrer">
                      <img src={valor} alt={id} style={{ maxWidth: 160, display: "block" }} />
                    </a>
                  ) : (
                    valor
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse", marginTop: 16 }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 8px", color: "#666", width: 140 }}>Nombre</td>
              <td style={{ padding: "6px 8px" }}>{solicitud.nombre}</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 8px", color: "#666" }}>Aplicativo</td>
              <td style={{ padding: "6px 8px" }}>{solicitud.aplicativo}</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 8px", color: "#666" }}>Descripción</td>
              <td style={{ padding: "6px 8px", whiteSpace: "pre-wrap" }}>{solicitud.descripcion}</td>
            </tr>
          </tbody>
        </table>
      )}

      {solicitud.estado === "RESUELTA" ? (
        <div style={{ marginTop: 24, padding: 12, background: "#eafaf1", borderRadius: 6 }}>
          <b>Resuelta</b> el {solicitud.resueltoEn ? new Date(solicitud.resueltoEn).toLocaleString("es-AR") : ""}
          {solicitud.detalleResolucion && (
            <p style={{ marginTop: 8 }}>
              Aviso mandado al cliente: <i>{solicitud.detalleResolucion}</i>
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          {solicitud.estado === "NUEVA" && (
            <form action={marcarEnProcesoConId} style={{ marginBottom: 12 }}>
              <button type="submit" style={{ padding: "6px 12px", cursor: "pointer" }}>
                Marcar en proceso
              </button>
            </form>
          )}

          <form action={marcarResueltaConId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, color: "#666" }}>
              Detalle de la reparación (si lo cargás, se le manda por WhatsApp al cliente tal cual)
            </label>
            <textarea name="detalle" rows={4} style={{ padding: 8, fontSize: 14 }} />
            <label style={{ fontSize: 13, color: "#666" }}>Nota interna (no la ve el cliente)</label>
            <input name="nota" style={{ padding: 8, fontSize: 14 }} />
            <button type="submit" style={{ padding: "8px 12px", cursor: "pointer", alignSelf: "start" }}>
              Marcar como resuelta
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
