import Link from "next/link";
import { listarSolicitudes, etiquetaTipo } from "@/lib/solicitudes";
import { login, cerrarSesion } from "./actions";
import { estaAutenticado } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function LoginForm() {
  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Panel de atención — Agencia</h1>
      <form action={login} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <input
          type="password"
          name="clave"
          placeholder="Clave de administración"
          style={{ padding: 8, fontSize: 14 }}
          autoFocus
        />
        <button type="submit" style={{ padding: 8, fontSize: 14, cursor: "pointer" }}>
          Entrar
        </button>
      </form>
    </main>
  );
}

const COLOR_ESTADO: Record<string, string> = {
  NUEVA: "#c0392b",
  EN_PROCESO: "#d68910",
  RESUELTA: "#1e8449",
};

export default async function AdminPage({ searchParams }: { searchParams: { estado?: string } }) {
  if (!estaAutenticado()) return <LoginForm />;

  const filtro = searchParams.estado;
  const solicitudes = filtro
    ? await listarSolicitudes(filtro as any)
    : (await Promise.all([listarSolicitudes("NUEVA"), listarSolicitudes("EN_PROCESO")])).flat();

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22 }}>Solicitudes del bot de atención</h1>
        <form action={cerrarSesion}>
          <button type="submit" style={{ fontSize: 12, color: "#666", background: "none", border: "none", cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </form>
      </div>

      <div style={{ margin: "12px 0", display: "flex", gap: 8, fontSize: 13 }}>
        <Link href="/admin">Pendientes</Link>
        <Link href="/admin?estado=RESUELTA">Resueltas</Link>
      </div>

      {solicitudes.length === 0 && <p style={{ color: "#666" }}>No hay solicitudes acá.</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "6px 8px" }}>Cuándo</th>
            <th style={{ padding: "6px 8px" }}>Tipo</th>
            <th style={{ padding: "6px 8px" }}>Teléfono</th>
            <th style={{ padding: "6px 8px" }}>Resumen</th>
            <th style={{ padding: "6px 8px" }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap", color: "#666" }}>
                {new Date(s.creadoEn).toLocaleString("es-AR")}
              </td>
              <td style={{ padding: "6px 8px" }}>{etiquetaTipo(s.tipo)}</td>
              <td style={{ padding: "6px 8px" }}>{s.telefono}</td>
              <td style={{ padding: "6px 8px" }}>
                <Link href={`/admin/${s.id}`}>
                  {s.tipo === "ALTA_CLIENTE"
                    ? (s.respuestas as any)?.nombre_negocio ?? "(ver detalle)"
                    : `${s.aplicativo ?? "-"} — ${(s.descripcion ?? "").slice(0, 60)}`}
                </Link>
              </td>
              <td style={{ padding: "6px 8px", color: COLOR_ESTADO[s.estado], fontWeight: 600 }}>{s.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
