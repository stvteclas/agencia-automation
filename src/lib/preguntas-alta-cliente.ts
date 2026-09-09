// Cuestionario de alta de cliente nuevo, contestado por WhatsApp en vez de
// Google Forms. Mismas preguntas que agencia/formulario-alta-cliente-preguntas.md
// (Sección 0, 1 y 3 — la Sección 2 es infraestructura técnica que releva
// Pablo directamente, no tiene sentido preguntarla por chat). Se guarda una
// respuesta por id en Solicitud.respuestas (JSON).
//
// Cada pregunta puede:
// - `texto` fijo, o una función que arma el texto usando las respuestas ya
//   dadas (para sonar cordial y no repetitivo — ej. usar el nombre del
//   negocio, o adaptar "servicios" vs "productos").
// - `mostrarSi` opcional: si devuelve false, la pregunta se salta según lo
//   que el cliente ya contestó antes.
// - `tipo: "imagen"` — la pregunta espera que mande una foto/archivo por
//   WhatsApp en vez de texto (hoy solo el logo). El motor de conversación
//   descarga la imagen de Meta, la sube a Vercel Blob, y guarda esa URL
//   como respuesta. Si en cambio escribe texto (ej. "no tengo"), se guarda
//   el texto tal cual — no se lo obliga a mandar archivo si no tiene.
//
// Si se ajusta el checklist general en agencia/formulario-alta-cliente-preguntas.md,
// reflejar el cambio también acá.

export type Respuestas = Record<string, string>;

export type PreguntaAltaCliente = {
  id: string;
  texto: string | ((r: Respuestas) => string);
  mostrarSi?: (r: Respuestas) => boolean;
  tipo?: "texto" | "imagen";
};

function ofreceProductos(r: Respuestas) {
  const v = (r.turnos_o_productos ?? "").toLowerCase();
  return v.includes("producto") && !v.includes("turno") && !v.includes("servicio");
}

export const PREGUNTAS_ALTA_CLIENTE: PreguntaAltaCliente[] = [
  { id: "nombre_negocio", texto: "Para arrancar, ¿cómo se llama tu negocio?" },
  { id: "rubro", texto: (r) => `Genial, ${r.nombre_negocio} 🙌 ¿A qué rubro o actividad se dedican?` },
  {
    id: "contacto_aprobador",
    texto:
      "¿Nombre y contacto (WhatsApp o mail) de la persona que va a aprobar el contenido antes de publicarse?",
  },
  { id: "direccion", texto: "¿Dirección del local? (si no tenés local físico, respondé 'no aplica')" },
  { id: "horario_atencion", texto: "¿Cuál es el horario de atención?" },
  {
    id: "turnos_o_productos",
    texto: "Contame un poco del negocio: ¿ofrecen turnos/servicios, venden productos, o ambos?",
  },
  {
    id: "tono_de_voz",
    texto:
      "Ahora hablemos de cómo suena la marca: ¿tuteo o usted?, ¿formal o cercano?, ¿usamos emojis?, ¿hay lugar para humor?",
  },
  {
    id: "promesas_prohibidas",
    texto: "¿Hay algo que la marca NO pueda prometer? (ej. rubros de salud no pueden prometer resultados médicos)",
  },
  {
    id: "publico_objetivo",
    texto: "¿A quién le hablamos? Contame edad, ubicación, qué busca y cómo consume redes tu público.",
  },
  {
    id: "colores_marca",
    texto:
      "Vamos con los colores de marca — mandanos los códigos hex si los tenés (fondo, acento principal, acento secundario, texto). Si no los tenés a mano, describilos igual con tus palabras y los definimos juntos.",
  },
  {
    id: "logo_claro",
    tipo: "imagen",
    texto:
      "Mandanos tu logo en versión clara (fondo blanco o transparente) como foto o archivo acá mismo. Si todavía no tenés uno armado, escribí 'no tengo' y seguimos sin problema.",
  },
  {
    id: "logo_oscuro",
    tipo: "imagen",
    mostrarSi: (r) => !/no\s*teng/i.test(r.logo_claro ?? ""),
    texto: "Perfecto, ese ya quedó guardado ✅ ¿Tenés también una versión del logo para fondo oscuro? Mandala, o escribí 'no tengo'.",
  },
  {
    id: "tipografias",
    texto: "¿Tenés tipografías de marca definidas? Contanos cuáles (nombre de la fuente) o si no tenés, escribí 'no tengo'.",
  },
  {
    id: "datos_contacto_piezas",
    texto: "¿Qué datos de contacto querés en cada pieza? (dirección, WhatsApp, @ de Instagram, horario)",
  },
  {
    id: "pilares_contenido",
    texto: (r) =>
      `Ya casi terminamos con la parte de marca. Elegí 4 a 6 pilares de contenido para ${r.nombre_negocio} (ej. educación/tips, resultados o testimonios, promociones, detrás de escena, bienestar).`,
  },
  {
    id: "ideas_por_servicio",
    texto: (r) =>
      ofreceProductos(r)
        ? "Contanos ideas de contenido para tus principales productos (uno por línea si son varios)."
        : "Contanos ideas de contenido para tus principales servicios (uno por línea si son varios).",
  },
  {
    id: "hashtags",
    texto: "Mandanos entre 8 y 15 hashtags que uses o quieras usar (de marca, locales y de tu rubro).",
  },
  {
    id: "consentimiento_fotos_reales",
    texto: "¿Podemos usar fotos o testimonios reales de tus clientas/clientes? (sí/no, y con qué condiciones)",
  },
  {
    id: "frecuencia_publicacion",
    texto: "Última parte, sobre el calendario: ¿con qué frecuencia querés publicar? (para arrancar, lo ideal es 2-3 veces por semana)",
  },
  { id: "horarios_publicacion", texto: "¿Tenés horarios preferidos para publicar? Se pueden ajustar después con métricas reales." },
  {
    id: "aprobador_unico",
    texto: "Confirmame: ¿quién es la única persona habilitada para aprobar o rechazar contenido antes de publicarse?",
  },
  {
    id: "reciclaje_contenido",
    texto: "¿Se puede repetir contenido evergreen ya publicado? Si sí, ¿cada cuánto tiempo?",
  },
  {
    id: "fechas_puntuales",
    texto: "¿Hay fechas o eventos puntuales a tener en cuenta? (aniversario, temporada alta, lanzamientos)",
  },
  {
    id: "aviso_contenido_nuevo",
    texto: "¿Preferís que te avisemos cada vez que hay contenido nuevo para aprobar, o preferís revisar vos por tu cuenta?",
  },
  {
    id: "detalles_adicionales",
    texto: (r) =>
      `Última pregunta, ${r.nombre_negocio} — ¿hay algo más sobre tu marca o tu negocio que no te hayamos preguntado y quieras contarnos? Si no se te ocurre nada, escribí 'no' y ya quedamos.`,
  },
];
