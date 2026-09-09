export default function Home() {
  return (
    <main className="page page--narrow">
      <div className="card">
        <div className="brand">
          <span className="brand-dot" />
          Bot de atención
        </div>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          Esta app no tiene página pública propia — el bot funciona por WhatsApp.
        </p>
        <a className="btn" href="/admin" style={{ display: "inline-block" }}>
          Ir al panel →
        </a>
      </div>
    </main>
  );
}
