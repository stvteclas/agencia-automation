---
name: plan-bot-atencion-agencia
description: Plan del bot de WhatsApp que reemplaza los Google Forms de alta de cliente e incidencias/tareas — flujo de conversación, modelo de datos, notificaciones y qué queda pendiente de decidir antes de programar el resto.
sources: cowork
---

# Bot de atención de la agencia — plan

Reemplaza, para clientes existentes y prospectos, los Google Forms actuales de alta de cliente y de feedback/incidencias. Un solo número de WhatsApp de la agencia, una app propia (Next.js + Prisma + Postgres, mismo stack que `turnos-app`), con su propia base de datos.

## 1. Flujo de conversación

1. **Bienvenida.** El bot se presenta como atención al cliente de la agencia de automatización.
2. **¿Ya sos cliente?** (Sí/No)
   - **No** → el bot presenta brevemente los productos/servicios que la agencia puede automatizar, y a continuación **hace él mismo** el cuestionario de alta de cliente (ya no se manda un link a un Google Form) — 23 preguntas tomadas de `agencia/formulario-alta-cliente-preguntas.md` (Secciones 0, 1 y 3; la Sección 2 de infraestructura técnica la releva Pablo aparte, no tiene sentido preguntarla por chat). Las respuestas se guardan en la base propia de la app, una por una, a medida que van llegando. El tono es cordial y dinámico: el bot usa el nombre del negocio en preguntas siguientes, agradece cada respuesta antes de pasar a la próxima, y adapta el texto de alguna pregunta según lo ya contestado (ej. "servicios" vs "productos"). Al terminar, confirma recepción del alta.
   - **Sí** → el bot pregunta qué necesita: **reportar una incidencia**, pedir una **tarea nueva**, o pedir una **modificación**. Después pide nombre, aplicativo/proyecto al que se refiere, y una descripción. Al terminar, confirma recepción y aclara que la agencia lo va a revisar.
3. En cualalquier punto, si el bot no entiende la respuesta, repregunta una sola vez antes de ofrecer "escribí HABLAR para que te contactemos directamente" (evita loops infinitos).

## 2. Qué se guarda (`Solicitud`)

Una sola tabla para las cuatro cosas que puede traer el bot:

| tipo | de dónde sale | campos propios |
|---|---|---|
| `ALTA_CLIENTE` | rama "No soy cliente" | `respuestas` (JSON, una clave por pregunta) |
| `INCIDENCIA` | rama "Sí soy cliente" | `nombre`, `aplicativo`, `descripcion` |
| `TAREA_NUEVA` | rama "Sí soy cliente" | `nombre`, `aplicativo`, `descripcion` |
| `MODIFICACION` | rama "Sí soy cliente" | `nombre`, `aplicativo`, `descripcion` |

Estados: `NUEVA` → `EN_PROCESO` → `RESUELTA`.

## 3. Notificaciones

- **A Pablo, por mail** (Resend, mismo proveedor que ya usa `turnos-app`): cada vez que se crea una `Solicitud` nueva, sin importar el tipo. Asunto indica el tipo; cuerpo trae el detalle.
- **Al cliente, por WhatsApp, automático:** dos momentos —
  1. Al terminar el intercambio (confirmación de recepción del incidente/tarea/modificación/alta).
  2. Cuando Pablo (o quien revise) marca la `Solicitud` como `RESUELTA` y carga un `detalleResolucion` — el bot le manda ese texto al mismo teléfono que abrió la solicitud, sin que nadie tenga que entrar a WhatsApp Web a mano.

## 4. Cómo se revisa (reemplaza el paso de Google Forms en la revisión diaria)

La tarea programada de revisión diaria pasa a consultar la base de esta app en vez de (o adem��s de) los Google Forms de feedback. Se expone:

- `GET /api/admin/solicitudes?estado=NUEVA` — lista lo pendiente.
- `PATCH /api/admin/solicitudes/:id` — cambia `estado`/`notaInterna`/`detalleResolucion` (dispara el WhatsApp de resolución si corresponde).

Autenticación simple por header `x-admin-key` (variable `ADMIN_API_KEY`), pensada para que la llame la rutina programada, no para un panel visual todavía.

**Pendiente, no se toca hasta que la app esté deployada:** actualizar el skill/Routine de `revision-diaria-community-manager-ia` (o el Cursor Automation equivalente) para que, además de las planillas de cada cliente, pegue contra esta API. Hace falta la URL de producción y el `ADMIN_API_KEY` antes de poder cablearlo.

## 5. Stack y dónde vive

- Next.js 14 + Prisma + Postgres (Neon) + Vercel — igual que `turnos-app` y `rb-estetica-turnos`.
- Carpeta: `bot-atencion-agencia/` en la raíz del workspace (es una herramienta de la agencia, no de un cliente puntual — no va dentro de `clientes/`).
- Repo de GitHub aparte (igual criterio que los otros: no pushear esta carpeta al repo grande `comunityManager`).
- Número de WhatsApp Business **de la agencia**, con app propia en Meta for Developers (no reusar la de ningún cliente).

## 6. Pasos manuales que solo puede hacer Pablo (no se resuelven desde el código)

1. Alta de proyecto en Neon (Postgres) → `DATABASE_URL` / `DIRECT_URL`.
2. Repo en GitHub + proyecto en Vercel conectado a ese repo (deploy en cada push a `main`).
3. App de WhatsApp Business en developers.facebook.com para el número de la agencia → `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, webhook apuntando a `/api/whatsapp/webhook` con el `WHATSAPP_VERIFY_TOKEN` que se defina.
4. Cuenta en Resend (o reusar la que ya tiene la agencia) → `RESEND_API_KEY`, dominio verificado para `EMAIL_FROM`.
5. Generar `ADMIN_API_KEY` (`openssl rand -hex 32`) y guardarlo para cablear después la revisión diaria.

## 7. Qué queda afuera de esta primera versión (a definir si hace falta después)

- Subida de logo por WhatsApp (imagen) — por ahora la pregunta de logo es sí/no por texto; si tiene, se pide por mail aparte. Se puede sumar manejo de imágenes (mismo patrón que usa `turnos-app` para comprobantes) si hace falta.
- Panel visual `/admin` con login — por ahora la interacción es solo por API con `ADMIN_API_KEY`, pensada para que la use la rutina programada. Se puede agregar una pantalla simple después si Pablo prefiere mirarlo a mano en vez de por la revisión automática.
- Detección automática de si un teléfono "ya es cliente" (hoy se lo pregunta directamente al usuario, no cruza contra una lista).

---

**Esto es lo que ya está armado como scaffold de código** (falta terminar el webhook y las rutas de admin, y no está deployado): estructura del proyecto, `schema.prisma`, cliente de Prisma, helper de envío de WhatsApp, helper de mail, y las 23 preguntas de alta de cliente con las reglas de tono/adaptación. Falta: el motor de conversación (máquina de estados que recorre las preguntas y arma las Solicitudes), el webhook de WhatsApp, y las rutas `/api/admin/solicitudes`.
