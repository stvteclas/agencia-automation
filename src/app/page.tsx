export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "80px auto" }}>
      <h1>Bot de atención de la agencia</h1>
      <p>Esta app no tiene una página pública propia. El bot funciona por WhatsApp.</p>
      <p>
        Panel para revisar solicitudes: <a href="/admin">/admin</a>
      </p>
    </main>
  );
}
