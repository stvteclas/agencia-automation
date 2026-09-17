// Autenticación del MCP server (src/app/api/mcp/route.ts).
//
// A propósito es una clave DISTINTA de ADMIN_API_KEY: el MCP es una
// superficie más chica y de menor riesgo (ver docs/MCP.md — solo expone las
// acciones de "Grupo A": lectura y transcripción de datos, nunca acciones
// que le escriban por primera vez a un tercero), así que conviene poder
// rotarla o revocarla sin afectar los endpoints /api/admin/* que ya usan
// Make, el cron y la revisión diaria por navegador.
//
// El conector MCP de Claude manda esta clave como Bearer token en el header
// Authorization — se configura UNA vez al conectar el MCP en Claude
// (Configuración → Conectores), nunca la escribe un agente en una
// conversación.
export function mcpAutorizado(req: Request): boolean {
  const clave = process.env.MCP_API_KEY;
  if (!clave) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${clave}`;
}
