// Logging estándar de llamadas al MCP — un solo lugar, para que ninguna
// tool tenga que acordarse de loguearse a sí misma. Ver el wrapper `tool()`
// en mcp-tools.ts, que es el único que llama esto.
//
// Diseño deliberadamente simple (no es un sistema de logging genérico):
// una fila por llamada en Postgres (misma base que el resto de la app, sin
// infraestructura nueva), con el input/output truncados para no inflar la
// base con payloads grandes (ej. una lista de 200 solicitudes). Sirve para
// responder "¿qué hizo el agente hoy?" igual que antes servía revisar el
// historial del browser — no es para debugging fino de performance.
import { prisma } from "@/lib/db";

const TRUNCADO_MAX = 2000; // caracteres — de sobra para ver qué pasó, poco para inflar la tabla

function truncar(valor: unknown): string {
  const texto = JSON.stringify(valor, (_key, v) => (v === undefined ? null : v));
  if (!texto) return "null";
  return texto.length > TRUNCADO_MAX ? texto.slice(0, TRUNCADO_MAX) + "…(truncado)" : texto;
}

export async function registrarLlamadaMcp(params: {
  tool: string;
  args: unknown;
  ok: boolean;
  errorMsg?: string;
  resultado?: unknown;
  duracionMs: number;
}) {
  try {
    await prisma.mcpToolLog.create({
      data: {
        tool: params.tool,
        argsJson: truncar(params.args),
        ok: params.ok,
        errorMsg: params.errorMsg?.slice(0, 500),
        resumenJson: params.resultado !== undefined ? truncar(params.resultado) : null,
        duracionMs: params.duracionMs,
      },
    });
  } catch (e) {
    // El logging nunca debe romper la tool real. Si falla (ej. migración
    // todavía no corrida), se deja constancia en stdout (Vercel lo captura
    // en Logs) y se sigue — la tool ya devolvió su resultado igual.
    console.error("[mcp-log] no se pudo registrar la llamada:", e);
  }
}
