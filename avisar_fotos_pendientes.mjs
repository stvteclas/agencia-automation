// OBSOLETO (14/09/2026) — este script necesitaba WHATSAPP_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID reales en el .env local, pero esas credenciales
// solo están cargadas en el entorno de Vercel (deploy), no en la PC.
//
// Usar en su lugar el endpoint admin, que corre con las credenciales reales
// del deploy — navegar (o pegar en la barra del navegador vinculado a la PC
// de Pablo) a:
//
//   https://agencia-automation.vercel.app/api/admin/avisar-foto-pendiente
//     ?telefono=5493515733863
//     &mensaje=<mensaje, URL-encoded>
//     &key=<ADMIN_API_KEY>
//
// Ver src/app/api/admin/avisar-foto-pendiente/route.ts y el paso 0.ter de
// cursor-rules/revision-diaria.mdc.
console.log(
  "Este script quedó obsoleto — usar GET /api/admin/avisar-foto-pendiente en el deploy de Vercel (ver el comentario arriba del archivo).",
);
