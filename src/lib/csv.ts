// Parser de CSV mínimo, a mano — alcanza para lo que devuelve el export
// público de Google Sheets (gviz/tq?tqx=out:csv) y evita sumar una
// dependencia nueva solo para esto. Soporta campos entre comillas con comas
// y saltos de línea adentro (el caso real: la columna Texto), y comillas
// escapadas como "" dentro de un campo entre comillas (formato estándar de
// Google Sheets/Excel).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignorar — el \n que sigue cierra la fila
    } else {
      field += c;
    }
  }

  // última fila si el archivo no termina en \n
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Convierte filas CSV (con la primera fila como encabezado) en objetos
// { encabezado: valor }, tal como usa src/lib/planilla-contenido.ts.
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== "")) // saltar filas vacías al final
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}
