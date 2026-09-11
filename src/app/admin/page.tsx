import Link from "next/link";
import { listarSolicitudes, etiquetaTipo } from "@/lib/solicitudes";
import { login, cerrarSesion } from "./actions";
import { estaAutenticado } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function LoginForm() {
  return (
    <main className="page page--narrow">
      <div className="card">
        <div className="brand">
          <span className="brand-dot" />
          Panel de atención
        </div>
        <p className="subtitle" style={{ marginBottom: 20 }}>Agencia de automatización</p>
        <form action={login}>
          <div className="field">
            <label>Clave de administración</label>
            <input type="password" name="clave" placeholder="••••••••••••" autoFocus />
          </div>
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}

const ETIQUETA_ESTADO: Record<string, string> = {
  NUEVA: "Nueva",
  EN_PROCESO: "En proceso",
  RESUELTA: "Resuelta",
};

function Badge({ estado }: { estado: string }) {
  return <span className={`badge badge-${estado.toLowerCase()}`}>{ETIQUETA_ESTADO[estado] ?? estado}</span>;
}

export default async function AdminPage({ searchParams }: { searchParams: { estado?: string } }) {
  if (!estaAutenticado()) return <LoginForm />;

  const filtro = searchParams.estado;
  const solicitudes = filtro
    ? await listarSolicitudes(filtro as any)
    : (await Promise.all([listarSolicitudes("NUEVA"), listarSolicitudes("EN_PROCESO")])).flat();

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <div className="brand">
            <span className="brand-dot" />
            Panel de atención
          </div>
          <h1>Solicitudes</h1>
        </div>
        <form action={cerrarSesion}>
          <button type="submit" className="btn btn-ghost">
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="tabs">
        <Link href="/admin" className={`tab ${!filtro ? "tab-active" : ""}`}>
          Pendientes
        </Link>
        <Link href="/admin?estado=RESUELTA" className={`tab ${filtro === "RESUELTA" ? "tab-active" : ""}`}>
          Resueltas
        </Link>
      </div>

      {solicitudes.length === 0 ? (
        <div className="card empty">No hay solicitudes acá.</div>
      ) : (
        <div className="list">
          {solicitudes.map((s) => (
            <Link key={s.id} href={`/admin/${s.id}`} className="row">
              <div className="row-top">
                <div>
                  <span className="badge-tipo">{etiquetaTipo(s.tipo)}</span>
                  <div className="row-title" style={{ marginTop: 6 }}>
                    {s.tipo === "ALTA_CLIENTE"
                      ? (s.respuestas as any)?.nombre_negocio ?? "(sin nombre)"
                      : s.tipo === "APROBACION_PUBLICACION"
                        ? `${s.archivo ?? "(sin archivo)"} ${s.respuestaAprobacion ? `— ${s.respuestaAprobacion === "APROBADO" ? "✅ Aprobado" : "✏️ Pidió cambios"}` : "— esperando respuesta"}`
                        : `${s.aplicativo ?? "Sin aplicativo"} — ${(s.descripcion ?? "").slice(0, 70)}`}
                  </div>
                  <div className="row-meta">
                    {s.telefono} · {new Date(s.creadoEn).toLocaleString("es-AR")}
                  </div>
                </div>
                <Badge estado={s.estado} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
