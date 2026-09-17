# MCP server — estado y cómo desplegarlo

Ver `agencia/decision-mcp-bot-atencion-agencia.md` (Proyecto de Claude) para el diseño completo (qué tools existen y por qué; qué queda deliberadamente afuera).

## Estado: validado de punta a punta en local (17/09/2026)

Probado con `npm run dev` + `curl` reales contra la base de desarrollo (Neon):
- `tools/list` devuelve las tools con sus schemas (14 desde que se sumó `listar_logs_mcp`, ver "Logging" abajo).
- `tools/call` sobre `listar_clientes_contenido` devolvió el registro real de Romina Balquinta — confirma protocolo, auth (`MCP_API_KEY`) y conexión a la base, los tres juntos.

Todavía no está desplegado a producción (Vercel) ni conectado en Claude — ver "Deploy" abajo.

## Bugs reales que aparecieron en el camino (por si un colega clona esto y los repite)

1. **Primer intento con un puente manual Request→Node** (`route.ts` original, escrito sin poder compilar por el bloqueo de npm del entorno donde se armó) falló con `-32700 Parse error`. Se reemplazó por el paquete `mcp-handler` (adaptador oficial de Vercel).
2. **`mcp-handler` espera el archivo en `app/api/[transport]/route.ts`** (carpeta con segmento dinámico), no en `app/api/mcp/route.ts` a secas — con la carpeta fija, siempre devolvía 404. El archivo real quedó en `src/app/api/[transport]/route.ts`, con `basePath: "/api"` pasado a `createMcpHandler`.
3. **El transporte Streamable HTTP exige el header `Accept: application/json, text/event-stream`** — sin él, responde `406 Not Acceptable`. Ojo si escribís un cliente de prueba nuevo.
4. **`curl` con JSON inline se escapa distinto en PowerShell y en cmd.exe** — en cmd.exe, `-d "{\"jsonrpc\":...}"` funciona directo; en PowerShell hace falta pasar el body en una variable o un archivo (`-d "@archivo.json"`), nunca escapado inline con backslashes.

## Logging — auditoría estándar de llamadas (18/09/2026)

Cada tool queda registrada automáticamente en la tabla `McpToolLog` (Postgres, misma base que el resto de la app) — es el reemplazo del rastro que antes quedaba solo en el historial del browser de quien navegaba `/api/admin/...` a mano. No hay que tocar nada tool por tool: `registrarTools()` envuelve `server.tool()` en un wrapper local (`tool()`, definido arriba de las 14 registraciones en `mcp-tools.ts`) que loguea antes de devolver o relanzar cualquier error.

Qué guarda cada fila: nombre de la tool, argumentos (JSON truncado a 2000 caracteres — nunca incluye `MCP_API_KEY` ni `ADMIN_API_KEY`, esas no viajan como argumento de ninguna tool), si terminó bien u tiró excepción, el mensaje de error si falló, un resumen truncado del resultado, duración en ms, y la fecha. El logging en sí nunca revienta la tool real: si `prisma.mcpToolLog.create` falla (ej. la migración todavía no corrió), queda un `console.error` en los Logs de Vercel y la tool sigue devolviendo su resultado igual.

Para consultarlo, la tool `listar_logs_mcp(tool?, soloErrores?, limite?)` (Grupo A, es solo lectura) — se puede llamar como cualquier otra desde Claude ("mostrame las últimas llamadas al MCP", "hubo algún error hoy"), sin entrar a Neon a mano.

**Migración de base de datos pendiente antes de poder usar esto:** el modelo `McpToolLog` se agregó a `prisma/schema.prisma`, pero hace falta generar y aplicar la migración (ver el paso 0 de "Deploy" más abajo) — hasta entonces las tools siguen funcionando igual, solo que cada llamada queda sin loguear (el `catch` del wrapper lo absorbe en silencio, con el `console.error` de arriba).

## Bug corregido en `actualizar_solicitud_interna` (18/09/2026)

Al escribir el wrapper de logging se encontró que esta tool, tal como quedó el 17/09, **pasaba siempre `"EN_PROCESO"` a `actualizarEstado()`**, incluso cuando `marcarEnProceso` era `false`/`undefined` y solo se quería agregar una `notaInterna`. Como `actualizarEstado()` escribe el campo `estado` sin condición (ver `solicitudes.ts`), esto podía hacer retroceder una solicitud que ya estaba `RESUELTA` de vuelta a `EN_PROCESO`, sin que nadie lo pidiera, solo por agregar una nota. Corregido: ahora, si `marcarEnProceso` no es `true`, la tool actualiza `notaInterna` directo por Prisma sin tocar `estado` en absoluto.

## Cómo probarlo vos (o un colega) en local

```cmd
cd D:\TRABAJO\comunityManager\bot-atencion-agencia
npm install
npm run dev
```

En otra terminal (cmd.exe — con PowerShell, ver el punto 4 de arriba):

```cmd
curl.exe -i -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Authorization: Bearer <tu MCP_API_KEY local>" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"
```

Debería devolver las 14 tools (incluida `listar_logs_mcp`). Para probar una de lectura real:

```cmd
curl.exe -i -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "Authorization: Bearer <tu MCP_API_KEY local>" -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"listar_clientes_contenido\",\"arguments\":{}}}"
```

## Deploy

0. **Generar y aplicar la migración de `McpToolLog`** (nueva, todavía no corrida en ningún lado):
   ```cmd
   cd D:\TRABAJO\comunityManager\bot-atencion-agencia
   npx prisma migrate dev --name agrega_mcp_tool_log
   ```
   Esto la aplica en tu Postgres de desarrollo (Neon) y deja el archivo de migración en `prisma/migrations/` listo para pushear — Vercel corre `prisma migrate deploy` contra producción en cada build (mismo mecanismo que las migraciones anteriores, no hace falta nada manual en Vercel para esto).
1. `MCP_API_KEY` cargada en Vercel (Settings → Environment Variables), con un valor **distinto** al que uses en tu `.env` local y distinto de `ADMIN_API_KEY`.
2. Push a `main` → deploy automático (mismo flujo de siempre).
3. Repetir la prueba de `tools/list` contra `https://<tu-deploy>.vercel.app/api/mcp` antes de conectarlo en Claude.
4. En Claude: Configuración → Conectores → agregar conector MCP remoto, esa URL + Bearer token con el valor de `MCP_API_KEY` de producción.

## Qué NO está acá (a propósito)

`notificar_publicacion`, `avisar_foto_pendiente`, `resolverSolicitud` con `detalleResolucion`, y crear plantillas de WhatsApp — ninguna de estas se envuelve como tool de MCP. Ver la sección "Grupo B" de `agencia/decision-mcp-bot-atencion-agencia.md` para el porqué (acciones que le escriben a un tercero por primera vez, nunca deben quedar a un llamado de agente).
