import { prisma } from "./db";
import { sendWhatsappText } from "./whatsapp";
import { descargarImagenDeWhatsapp, guardarLogoEnBlob } from "./whatsapp-media";
import {
  crearSolicitud,
  listarSolicitudes,
  etiquetaTipo,
  buscarAprobacionPendiente,
  registrarRespuestaAprobacion,
} from "./solicitudes";
import { buscarClientePorTelefono, crearOActualizarCliente, agregarAplicativoSiNoExiste } from "./clientes";
import { PREGUNTAS_ALTA_CLIENTE, type Respuestas } from "./preguntas-alta-cliente";
import type { TipoSolicitud } from "@prisma/client";

// Pasos posibles. "alta_pregunta" cubre todas las preguntas del cuestionario
// de alta de cliente — cuál pregunta va ahora se resuelve con el índice
// guardado en el contexto, no con un paso por pregunta.
type Paso =
  | "inicio"
  | "esperando_es_cliente"
  | "esperando_tipo_pedido"
  | "esperando_nombre_pedido"
  | "esperando_aplicativo_pedido"
  | "esperando_aplicativo_conocido_pedido"
  | "esperando_descripcion_pedido"
  | "alta_pregunta"
  | "terminado";

type Contexto = {
  respuestas?: Respuestas;
  indicePregunta?: number;
  tipoPedido?: TipoSolicitud;
  nombrePedido?: string;
  aplicativoPedido?: string;
  // Presente solo cuando el teléfono ya es un Cliente conocido — evita
  // volver a preguntar nombre, y si tiene aplicativos cargados, también
  // evita volver a preguntar cuál.
  esClienteConocido?: boolean;
  aplicativosConocidos?: string[];
};

const MENSAJE_BIENVENIDA =
  "¡Hola! 👋 Este es el canal de atención de nuestra agencia de automatización. Contame: ¿ya sos cliente nuestro? (Sí / No)";

const PRESENTACION_PRODUCTOS =
  "¡Buenísimo que te sumes! 🚀 Automatizamos la atención y el contenido de negocios como el tuyo: manejo de redes sociales con IA, bots de WhatsApp para turnos y consultas, y sistemas propios de reservas. Para armar tu propuesta, te voy a hacer un cuestionario cortito (unas 20 preguntas, se responde tranquilo y de a poco). Empecemos:";

function esAfirmativo(texto: string) {
  const t = texto.trim().toLowerCase();
  return ["si", "sí", "s", "yes", "dale", "obvio", "arrancamos", "ok", "listo"].some((p) => t.startsWith(p));
}

function esNegativo(texto: string) {
  const t = texto.trim().toLowerCase();
  return ["no", "n", "nop"].some((p) => t === p || t.startsWith(p + " "));
}

// Umbral de aprobación para una pieza de contenido: cualquier variante clara
// de sí/aprobado/dale/bien. Deliberadamente angosto — cualquier otra cosa
// (incluido "ok" pelado, un emoji, una pregunta) se trata como comentario de
// cambios, no como aprobación, porque es más seguro equivocarse hacia "pedir
// confirmación" que publicar algo que el cliente no aprobó de verdad (ver
// agencia/decision-bot-aprobacion-publicaciones.md, "Ambigüedad de
// respuesta").
function esAprobacion(texto: string) {
  const t = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, ""); // saca acentos: "sí"→"si", "está bien"→"esta bien"
  return [
    "si",
    "s",
    "sisi",
    "dale",
    "aprobado",
    "apruebo",
    "aprobada",
    "aprobar",
    "perfecto",
    "buenisimo",
    "excelente",
    "joya",
    "me gusta",
    "esta bien",
    "esta perfecto",
    "todo bien",
  ].some((p) => t === p || t.startsWith(p + " ") || t.startsWith(p + "!") || t.startsWith(p + "."));
}

async function obtenerOCrearConversacion(telefono: string) {
  const existente = await prisma.conversacion.findUnique({ where: { telefono } });
  if (existente) return existente;
  return prisma.conversacion.create({
    data: { telefono, paso: "inicio", contextoJson: {} },
  });
}

async function guardarPaso(telefono: string, paso: Paso, contexto: Contexto) {
  await prisma.conversacion.update({
    where: { telefono },
    data: { paso, contextoJson: contexto as any },
  });
}

async function reiniciar(telefono: string) {
  await prisma.conversacion.delete({ where: { telefono } }).catch(() => {});
}

function textoPregunta(indice: number, respuestas: Respuestas): string | null {
  const pregunta = PREGUNTAS_ALTA_CLIENTE[indice];
  if (!pregunta) return null;
  return typeof pregunta.texto === "function" ? pregunta.texto(respuestas) : pregunta.texto;
}

// Busca la próxima pregunta a partir de `desde` que no deba saltearse según
// `mostrarSi`. Devuelve el índice, o null si ya no quedan preguntas.
function proximoIndice(desde: number, respuestas: Respuestas): number | null {
  for (let i = desde; i < PREGUNTAS_ALTA_CLIENTE.length; i++) {
    const p = PREGUNTAS_ALTA_CLIENTE[i];
    if (!p.mostrarSi || p.mostrarSi(respuestas)) return i;
  }
  return null;
}

async function enviarPreguntaOFinalizar(telefono: string, indice: number, respuestas: Respuestas) {
  const siguiente = proximoIndice(indice, respuestas);
  if (siguiente === null) {
    // Cuestionario completo: se crea la Solicitud y, a partir de ahora, este
    // teléfono ya queda como Cliente conocido para la próxima consulta.
    await crearSolicitud({ tipo: "ALTA_CLIENTE", telefono, respuestas });
    await crearOActualizarCliente(telefono, respuestas.nombre_negocio ?? telefono);
    await guardarPaso(telefono, "terminado", {});
    await sendWhatsappText(
      telefono,
      `¡Genial, ${respuestas.nombre_negocio ?? ""}! 🎉 Ya tenemos todo lo que necesitamos para armar tu propuesta. En breve te contactamos para los próximos pasos (accesos técnicos y arranque). ¡Gracias por tu tiempo!`,
    );
    return;
  }
  await guardarPaso(telefono, "alta_pregunta", { respuestas, indicePregunta: siguiente });
  await sendWhatsappText(telefono, textoPregunta(siguiente, respuestas)!);
}

function menuTipoPedido() {
  return "Contame qué necesitás:\n1) Reportar una incidencia (algo que no funciona)\n2) Pedir una tarea nueva\n3) Pedir una modificación\n\nRespondé con el número o la palabra.";
}

function interpretarTipoPedido(texto: string): TipoSolicitud | null {
  const t = texto.trim().toLowerCase();
  if (t.startsWith("1") || t.includes("incidencia") || t.includes("problema") || t.includes("no funciona")) return "INCIDENCIA";
  if (t.startsWith("2") || t.includes("tarea")) return "TAREA_NUEVA";
  if (t.startsWith("3") || t.includes("modificaci")) return "MODIFICACION";
  return null;
}

async function pedirDescripcion(telefono: string, contexto: Contexto) {
  await guardarPaso(telefono, "esperando_descripcion_pedido", contexto);
  await sendWhatsappText(
    telefono,
    contexto.aplicativoPedido
      ? `Dale, contame con el detalle que puedas qué pasó o qué necesitás sobre ${contexto.aplicativoPedido}.`
      : "Contame con el detalle que puedas qué pasó o qué necesitás.",
  );
}

// Le permite al dueño (OWNER_WHATSAPP) pedir por WhatsApp, en cualquier
// momento, un resumen de lo que está pendiente — sin pasar por el flujo de
// cliente ni tocar su Conversacion. Palabras como "pendiente(s)" o "pedido(s)"
// disparan el resumen (ej. "mostrame el pedido", "qué tengo pendiente").
function esComandoDePendientes(texto: string) {
  const t = texto.trim().toLowerCase();
  return t.includes("pendiente") || t.includes("pedido");
}

async function responderPendientesAlDueño(telefono: string) {
  const todas = await listarSolicitudes();
  const pendientes = todas.filter((s) => s.estado !== "RESUELTA").slice(0, 10);

  if (pendientes.length === 0) {
    await sendWhatsappText(telefono, "✅ No tenés nada pendiente por ahora.");
    return;
  }

  const lineas = pendientes.map((s, i) => {
    const respuestas = s.respuestas as Respuestas | null;
    const quien = s.tipo === "ALTA_CLIENTE" ? respuestas?.nombre_negocio ?? s.telefono : s.nombre ?? s.telefono;
    const fecha = s.creadoEn.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    const estado = s.estado === "EN_PROCESO" ? "en proceso" : "nueva";
    return `${i + 1}) [${etiquetaTipo(s.tipo)}] ${quien} — ${fecha} (${estado})`;
  });

  await sendWhatsappText(
    telefono,
    `📋 Tenés ${pendientes.length} pendiente(s):\n\n${lineas.join("\n")}\n\nEntrá a /admin para ver el detalle completo.`,
  );
}

// Punto de entrada para un mensaje de TEXTO entrante. `imagenUrl`, cuando la
// pregunta actual es de tipo "imagen" y este mensaje en particular es una
// imagen, ya viene resuelta a una URL de Blob (ver route.ts).
export async function manejarMensajeEntrante(telefono: string, texto: string, imagenUrl?: string) {
  if (telefono === process.env.OWNER_WHATSAPP && esComandoDePendientes(texto)) {
    await responderPendientesAlDueño(telefono);
    return;
  }

  // Aprobación de una pieza de contenido: tiene prioridad sobre cualquier
  // otro flujo (alta/incidencia en curso incluido) porque es una conversación
  // aparte, en paralelo a la de Conversacion. Si hay una APROBACION_PUBLICACION
  // sin responder para este teléfono, el próximo mensaje SIEMPRE se
  // interpreta como la respuesta a esa pieza, no como un mensaje nuevo.
  const aprobacionPendiente = await buscarAprobacionPendiente(telefono);
  if (aprobacionPendiente) {
    if (esAprobacion(texto)) {
      await registrarRespuestaAprobacion(aprobacionPendiente.id, "APROBADO");
      await sendWhatsappText(telefono, "¡Buenísimo, gracias! ✅ Ya queda aprobada, la programamos para publicar.");
    } else {
      await registrarRespuestaAprobacion(aprobacionPendiente.id, "CAMBIOS", texto);
      await sendWhatsappText(
        telefono,
        "Gracias por el comentario 📝 Ya se lo paso a la agencia para el ajuste — te vuelvo a mandar la pieza corregida para que la revises de nuevo.",
      );
    }
    return;
  }

  const conversacion = await obtenerOCrearConversacion(telefono);
  const contexto = (conversacion.contextoJson as Contexto) ?? {};
  const paso = conversacion.paso as Paso;

  // Comando de escape disponible en cualquier punto.
  if (texto.trim().toLowerCase() === "hablar") {
    await sendWhatsappText(telefono, "Perfecto, ya le avisamos a una persona del equipo para que te contacte directamente. ¡Gracias por tu paciencia!");
    await reiniciar(telefono);
    return;
  }

  switch (paso) {
    case "inicio": {
      const cliente = await buscarClientePorTelefono(telefono);
      if (cliente) {
        await sendWhatsappText(telefono, `¡Hola de nuevo, ${cliente.nombre}! 👋 ${menuTipoPedido()}`);
        await guardarPaso(telefono, "esperando_tipo_pedido", {
          esClienteConocido: true,
          nombrePedido: cliente.nombre,
          aplicativosConocidos: cliente.aplicativos,
        });
      } else {
        await sendWhatsappText(telefono, MENSAJE_BIENVENIDA);
        await guardarPaso(telefono, "esperando_es_cliente", {});
      }
      return;
    }

    case "esperando_es_cliente": {
      if (esAfirmativo(texto)) {
        await sendWhatsappText(telefono, menuTipoPedido());
        await guardarPaso(telefono, "esperando_tipo_pedido", {});
      } else if (esNegativo(texto)) {
        await sendWhatsappText(telefono, PRESENTACION_PRODUCTOS);
        await enviarPreguntaOFinalizar(telefono, 0, {});
      } else {
        await sendWhatsappText(telefono, "Perdón, no te entendí 🙏 ¿Podés responder Sí o No? ¿Ya sos cliente nuestro?");
      }
      return;
    }

    case "esperando_tipo_pedido": {
      const tipo = interpretarTipoPedido(texto);
      if (!tipo) {
        await sendWhatsappText(telefono, "No te entendí bien — respondé 1, 2 o 3:\n" + menuTipoPedido());
        return;
      }
      const nuevoContexto: Contexto = { ...contexto, tipoPedido: tipo };

      if (contexto.esClienteConocido) {
        const aplicativos = contexto.aplicativosConocidos ?? [];
        if (aplicativos.length === 1) {
          nuevoContexto.aplicativoPedido = aplicativos[0];
          await pedirDescripcion(telefono, nuevoContexto);
        } else if (aplicativos.length > 1) {
          await guardarPaso(telefono, "esperando_aplicativo_conocido_pedido", nuevoContexto);
          await sendWhatsappText(
            telefono,
            `¿Sobre cuál de estos es?\n${aplicativos.map((a, i) => `${i + 1}) ${a}`).join("\n")}`,
          );
        } else {
          await guardarPaso(telefono, "esperando_aplicativo_pedido", nuevoContexto);
          await sendWhatsappText(telefono, "¿Sobre qué aplicativo, sistema o servicio es? (ej. bot de turnos, redes sociales, etc.)");
        }
      } else {
        await guardarPaso(telefono, "esperando_nombre_pedido", nuevoContexto);
        await sendWhatsappText(telefono, "Dale, contame tu nombre.");
      }
      return;
    }

    case "esperando_nombre_pedido": {
      const nuevoContexto: Contexto = { ...contexto, nombrePedido: texto };
      await guardarPaso(telefono, "esperando_aplicativo_pedido", nuevoContexto);
      await sendWhatsappText(telefono, "¿Sobre qué aplicativo, sistema o servicio es? (ej. bot de turnos, redes sociales, etc.)");
      return;
    }

    case "esperando_aplicativo_pedido": {
      await pedirDescripcion(telefono, { ...contexto, aplicativoPedido: texto });
      return;
    }

    case "esperando_aplicativo_conocido_pedido": {
      const opciones = contexto.aplicativosConocidos ?? [];
      const idx = parseInt(texto.trim(), 10) - 1;
      const elegido = !Number.isNaN(idx) && opciones[idx] ? opciones[idx] : opciones.find((a) => texto.toLowerCase().includes(a.toLowerCase()));
      if (!elegido) {
        await sendWhatsappText(telefono, `No te entendí, elegí el número de la lista:\n${opciones.map((a, i) => `${i + 1}) ${a}`).join("\n")}`);
        return;
      }
      await pedirDescripcion(telefono, { ...contexto, aplicativoPedido: elegido });
      return;
    }

    case "esperando_descripcion_pedido": {
      const tipo = contexto.tipoPedido ?? "INCIDENCIA";
      await crearSolicitud({
        tipo,
        telefono,
        nombre: contexto.nombrePedido,
        aplicativo: contexto.aplicativoPedido,
        descripcion: texto,
      });
      // Si el aplicativo era nuevo (texto libre, no venía de la lista
      // conocida), lo sumamos al perfil del cliente para la próxima vez.
      if (contexto.nombrePedido) {
        await agregarAplicativoSiNoExiste(telefono, contexto.nombrePedido, contexto.aplicativoPedido);
      }
      await guardarPaso(telefono, "terminado", {});
      await sendWhatsappText(
        telefono,
        "¡Listo, ya quedó registrado! 📋 Lo vamos a revisar y te escribimos por acá apenas tengamos novedades. ¡Gracias!",
      );
      return;
    }

    case "alta_pregunta": {
      const indiceActual = contexto.indicePregunta ?? 0;
      const preguntaActual = PREGUNTAS_ALTA_CLIENTE[indiceActual];
      const respuestas = { ...(contexto.respuestas ?? {}) };

      if (preguntaActual?.tipo === "imagen" && imagenUrl) {
        respuestas[preguntaActual.id] = imagenUrl;
      } else {
        respuestas[preguntaActual?.id ?? `pregunta_${indiceActual}`] = texto;
      }

      await enviarPreguntaOFinalizar(telefono, indiceActual + 1, respuestas);
      return;
    }

    case "terminado":
    default: {
      // Alguien vuelve a escribir después de haber cerrado un pedido: arranca de cero.
      await reiniciar(telefono);
      await manejarMensajeEntrante(telefono, texto, imagenUrl);
      return;
    }
  }
}

// Punto de entrada para un mensaje de IMAGEN entrante, cuando la conversación
// está parada en una pregunta de tipo "imagen".
export async function manejarImagenEntrante(telefono: string, mediaId: string) {
  const conversacion = await obtenerOCrearConversacion(telefono);
  const contexto = (conversacion.contextoJson as Contexto) ?? {};
  if (conversacion.paso !== "alta_pregunta") {
    await sendWhatsappText(telefono, "Recibí tu imagen, pero no la esperaba en este punto — seguimos con las preguntas de texto por ahora.");
    return;
  }
  const indiceActual = contexto.indicePregunta ?? 0;
  const preguntaActual = PREGUNTAS_ALTA_CLIENTE[indiceActual];
  if (preguntaActual?.tipo !== "imagen") {
    await sendWhatsappText(telefono, "Recibí tu imagen, pero esta pregunta es de texto — contestame con palabras y seguimos.");
    return;
  }

  try {
    const bytes = await descargarImagenDeWhatsapp(mediaId);
    const url = await guardarLogoEnBlob(telefono, preguntaActual.id, bytes);
    await manejarMensajeEntrante(telefono, "(imagen recibida)", url);
  } catch (err) {
    console.error("Error procesando imagen entrante:", err);
    await sendWhatsappText(telefono, "Uy, no pude guardar la imagen. ¿Podés volver a mandarla?");
  }
}
