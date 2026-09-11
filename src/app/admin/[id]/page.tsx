import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerSolicitud, etiquetaTipo } from "@/lib/solicitudes";
import { marcarResuelta, marcarEnProceso, marcarAplicada } from "../actions";
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

const ETIQUETA_ESTADO: Record<string, string> = {
  NUEVA: "Nueva",
  EN_PROCESO: "En proceso",
  RESUELTA: "Resuelta",
};

function Badge({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.toLowerCase()}`}>{ETIQUETA_ESTADO[estado] ?? estado}</span>;
}

function esUrlDeImagen(v: string) {
  return /^https?:\/\//.test(v) && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(v);
}

export default async function DetalleSolicitud({ params }: { params: { id: string } }) {
  if (!estaAutenticado()) {
    return (
      <main className="page page--narrow">
        <div className="card">No autorizado. Entrá por <Link href="/admin">/admin</Link>.</div>
      </main>
    );
  }

  const solicitud = await obtenerSolicitud(params.id);
  if (!solicitud) return notFound();

  const marcarResueltaConId = marcarResuelta.bind(null, solicitud.id);
  const marcarEnProcesoConId = marcarEnProceso.bind(null, solicitud.id);
  const marcarAplicadaConId = marcarAplicada.bind(null, solicitud.id);

  return (
    <main className="page">
      <Link href="/admin" className="btn-ghost" style={{ display: "inline-block", marginBottom: 16, padding: "4px 0" }}>
        ← Volver
      </Link>

      <div className="card">
        <div className="topbar" style={{ marginBottom: 8 }}>
          <div>
            <span className="badge-tipo">{etiquetaTipo(solicitud.tipo)}</span>
            <h1 style={{ marginTop: 8 }}>{solicitud.telefono}</h1>
            <p className="subtitle">Creada el {new Date(solicitud.creadoEn).toLocaleString("es-AR")}</p>
          </div>
          <Badge estado={solicitud.estado} />
        </div>

        <hr className="sep" />

        {solicitud.tipo === "ALTA_CLIENTE" ? (
          <dl className="kv">
            {Object.entries((solicitud.respuestas as Record<string, string>) ?? {}).map(([id, valor]) => (
              <Fragment key={id}>
                <dt>{ETIQUETAS_PREGUNTAS[id] ?? id}</dt>
                <dd>
                  {esUrlDeImagen(valor) ? (
                    <a href={valor} target="_blank" rel="noreferrer">
                      <img src={valor} alt={id} />
                    </a>
                  ) : (
                    valor
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : solicitud.tipo === "APROBACION_PUBLICACION" ? (
          <dl className="kv">
            <dt>Archivo</dt>
            <dd>{solicitud.archivo}</dd>
            <dt>Link enviado al cliente</dt>
            <dd>
              {solicitud.linkPreview ? (
                <a href={solicitud.linkPreview} target="_blank" rel="noreferrer">
                  {solicitud.linkPreview}
                </a>
              ) : (
                "-"
              )}
            </dd>
            <dt>Respuesta del cliente</dt>
            <dd>
              {solicitud.respuestaAprobacion === "APROBADO" && "✅ Aprobado"}
              {solicitud.respuestaAprobacion === "CAMBIOS" && "✏️ Pidió cambios"}
              {!solicitud.respuestaAprobacion && "Esperando respuesta por WhatsApp…"}
            </dd>
            {solicitud.respuestaAprobacion === "CAMBIOS" && (
              <>
                <dt>Comentario del cliente</dt>
                <dd>{solicitud.descripcion}</dd>
              </>
            )}
            <dt>Aplicado en la planilla</dt>
            <dd>{solicitud.aplicadoEnPlanilla ? "Sí" : "Todavía no"}</dd>
          </dl>
        ) : (
          <dl className="kv">
            <dt>Nombre</dt>
            <dd>{solicitud.nombre}</dd>
            <dt>Aplicativo</dt>
            <dd>{solicitud.aplicativo}</dd>
            <dt>Descripción</dt>
            <dd>{solicitud.descripcion}</dd>
          </dl>
        )}

        {solicitud.tipo === "APROBACION_PUBLICACION" ? (
          <>
            {solicitud.estado === "NUEVA" ? (
              <p className="subtitle">Esperando que el cliente responda por WhatsApp (aprobado o comentario) — no hace falta ninguna acción acá todavía.</p>
            ) : solicitud.aplicadoEnPlanilla ? (
              <div className="resolved-banner">
                <strong>Ya está aplicado en la planilla.</strong>
              </div>
            ) : (
              <>
                <p className="subtitle" style={{ marginBottom: 12 }}>
                  {solicitud.respuestaAprobacion === "APROBADO"
                    ? "El cliente aprobó. Una vez que la fila de la planilla quede en Estado=Aprobado (vía el webhook de Make), marcá esto como aplicado."
                    : "El cliente pidió cambios. Corregí la pieza según el comentario, subí la fila nueva a la planilla (Estado=Pendiente) y marcá esto como aplicado."}
                </p>
                <form action={marcarAplicadaConId}>
                  <button type="submit" className="btn btn-outline">
                    Marcar aplicado en la planilla
                  </button>
                </form>
              </>
            )}
          </>
        ) : solicitud.estado === "RESUELTA" ? (
          <div className="resolved-banner">
            <strong>Resuelta</strong>
            {solicitud.resueltoEn && ` el ${new Date(solicitud.resueltoEn).toLocaleString("es-AR")}`}
            {solicitud.detalleResolucion && (
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Aviso mandado al cliente: <i>{solicitud.detalleResolucion}</i>
              </p>
            )}
          </div>
        ) : (
          <>
            <hr className="sep" />
            {solicitud.estado === "NUEVA" && (
              <form action={marcarEnProcesoConId} style={{ marginBottom: 16 }}>
                <button type="submit" className="btn btn-outline">
                  Marcar en proceso
                </button>
              </form>
            )}

            <form action={marcarResueltaConId}>
              <div className="field">
                <label>
                  Detalle de la reparación <span className="field-hint">— si lo cargás, se le manda por WhatsApp al cliente tal cual</span>
                </label>
                <textarea name="detalle" rows={4} />
              </div>
              <div className="field">
                <label>Nota interna <span className="field-hint">— no la ve el cliente</span></label>
                <input name="nota" />
              </div>
              <button type="submit" className="btn">
                Marcar como resuelta
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
