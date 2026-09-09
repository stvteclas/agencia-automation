# Bot de atención — Agencia

Bot de WhatsApp que reemplaza los Google Forms de alta de cliente nuevo y de
incidencias/tareas/modificaciones de clientes existentes. Detalle completo
del diseño en `agencia/plan-bot-atencion-agencia.md` (base de conocimiento
del Proyecto de la agencia).

- **Stack:** Next.js 14 (App Router) + Prisma + Postgres (Neon) + Vercel — mismo esquema que `turnos-app` / `rb-estetica-turnos`.
- **Canal:** WhatsApp Business Platform (Cloud API), número propio de la agencia.
- **Panel:** `/admin` — ver y resolver solicitudes a mano (login con `ADMIN_API_KEY`). Lo mismo se puede hacer por API (`/api/admin/solicitudes`), pensado para que lo use la revisión diaria programada.

## Flujo del bot (resumen)

1. Bienvenida → "¿ya sos cliente?"
2. **No** → presenta los servicios de la agencia y hace el cuestionario de alta de cliente (23 preguntas, incluye pedir el logo como imagen) → guarda todo en `Solicitud` (tipo `ALTA_CLIENTE`) y da de alta el `Cliente`.
3. **Sí** (o directamente si el teléfono ya es un `Cliente` conocido) → pregunta si es incidencia / tarea nueva / modificación, y solo pide nombre/aplicativo si todavía no los tiene guardados.
4. Al cerrar cualquier flujo, confirma recepción por WhatsApp y avisa a `OWNER_EMAIL` por mail.
5. Cuando alguien del equipo marca una solicitud como `RESUELTA` con un detalle (desde `/admin` o `PATCH /api/admin/solicitudes/:id`), el bot le manda ese detalle al cliente por WhatsApp automáticamente.

## Arranque

1. Proyecto **Neon nuevo** (no reusar el de ningún cliente). `DATABASE_URL` (pool) y `DIRECT_URL` en `.env`.
2. `ADMIN_API_KEY` (`openssl rand -hex 32`) — protege `/admin` y `/api/admin/*`.
3. `npm install` → `npx prisma db push` → `npm run dev`.
4. Conectar **Vercel Blob Storage** al proyecto (Vercel dashboard → Storage) para que se generen solos los logos que manden los prospectos → copiar `BLOB_READ_WRITE_TOKEN` al `.env`.
5. Cuenta en **Resend** (o reusar la de la agencia) → `RESEND_API_KEY`, dominio verificado para `EMAIL_FROM`, y `OWNER_EMAIL` con la casilla que recibe los avisos.

## WhatsApp (Meta) — paso a paso

1. developers.facebook.com → crear (o reusar) una app de la **agencia**, no la de un cliente.
2. Agregar el producto WhatsApp → conseguir `WHATSAPP_TOKEN` (permanente) y `WHATSAPP_PHONE_NUMBER_ID`.
3. Inventar un `WHATSAPP_VERIFY_TOKEN` propio y cargarlo en el `.env`.
4. Configurar el webhook apuntando a `https://<tu-deploy>.vercel.app/api/whatsapp/webhook`, con ese mismo verify token. Suscribir el campo `messages` (ver `patrones-reutilizables-turnos-bot-whatsapp.md` si más adelante hace falta el patrón de "pausar el bot cuando contesta un humano").
5. Probar mandándole un WhatsApp al número de la agencia — tiene que contestar con la bienvenida.

## GitHub y Vercel

Repo aparte (igual criterio que los otros proyectos de código): no pushear
esta carpeta al repo grande `comunityManager`. Push a `main` → deploy en
Vercel.

## Pendiente (no bloquea el arranque)

- Cablear la revisión diaria de la agencia (Cursor/Claude) para que consulte `GET /api/admin/solicitudes?estado=NUEVA` con el `ADMIN_API_KEY`, una vez que la app esté deployada y se tenga la URL de producción.
- Definir si además de logo hace falta pedir otros archivos (ej. fotos de producto) durante el alta.
