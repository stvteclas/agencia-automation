// MCP server de bot-atencion-agencia — ver agencia/decision-mcp-bot-atencion-agencia.md
// para el diseño completo (qué entra acá y qué no, y por qué), y docs/MCP.md
// para el historial de esta ruta (dos intentos fallidos antes de este).
//
// v3 (17/09/2026): mcp-handler espera este archivo en app/api/[transport]/
// (segmento dinámico) — así resuelve internamente /api/mcp (Streamable
// HTTP) y /api/sse. Antes estaba en app/api/mcp/route.ts a secas, lo que
// daba 404 porque mcp-handler nunca encontraba el segmento "transport".
// El basePath abajo tiene que coincidir con el prefijo real de la carpeta
// (acá "/api").
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { mcpAutorizado } from "@/lib/mcp-auth";
import { registrarTools } from "@/lib/mcp-tools";

const handler = createMcpHandler(
  (server) => registrarTools(server),
  {},
  { basePath: "/api" },
);

async function conAuth(req: NextRequest) {
  if (!mcpAutorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return handler(req);
}

export { conAuth as GET, conAuth as POST, conAuth as DELETE };
