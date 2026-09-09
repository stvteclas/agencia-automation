// Aviso por mail cuando entra algo nuevo. Mismo proveedor (Resend) que ya
// usa turnos-app para mails de confirmación.

export async function notifyOwnerByEmail(subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.OWNER_EMAIL;
  if (!apiKey || !from || !to) {
    console.error("Faltan RESEND_API_KEY / EMAIL_FROM / OWNER_EMAIL en el .env — no se pudo avisar por mail");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!res.ok) {
    console.error("Error mandando mail de aviso:", res.status, await res.text());
  }
}
