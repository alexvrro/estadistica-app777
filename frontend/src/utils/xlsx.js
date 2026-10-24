/**
 * Generador mínimo de archivos Excel (.xlsx) sin dependencias.
 * Un .xlsx es un ZIP con varios XML; aquí se arma el ZIP sin compresión (método
 * «stored»), que Excel, LibreOffice y Google Sheets abren sin problema.
 *
 * hojas: [{ nombre, filas: (string | number | null)[][], encabezado?: true }]
 * La primera fila de cada hoja se escribe en negrita si `encabezado` es true.
 */

const codificador = new TextEncoder();

/* --- CRC32 (lo exige el formato ZIP) ------------------------------------------ */

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* --- ZIP sin compresión -------------------------------------------------------- */

function zip(archivos) {
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  for (const { nombre, contenido } of archivos) {
    const nombreBytes = codificador.encode(nombre);
    const datos = codificador.encode(contenido);
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // firma de encabezado local
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombreBytes.length, true);
    partes.push(new Uint8Array(local.buffer), nombreBytes, datos);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); // firma del directorio central
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, datos.length, true);
    dir.setUint32(24, datos.length, true);
    dir.setUint16(28, nombreBytes.length, true);
    dir.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(dir.buffer), nombreBytes);

    desplazamiento += 30 + nombreBytes.length + datos.length;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); // fin del directorio central
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* --- Hojas de cálculo --------------------------------------------------------- */

const escapar = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML 1.0 no admite caracteres de control
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** 0 → A, 25 → Z, 26 → AA */
function columna(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function hojaXml({ filas, encabezado }) {
  const anchos = [];
  filas.forEach((fila) =>
    fila.forEach((v, j) => {
      anchos[j] = Math.max(anchos[j] || 8, Math.min(60, String(v ?? '').length + 2));
    }),
  );
  const cols = anchos.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('');

  const cuerpo = filas
    .map((fila, i) => {
      const estilo = encabezado && i === 0 ? ' s="1"' : '';
      const celdas = fila
        .map((v, j) => {
          if (v === null || v === undefined || v === '') return '';
          const ref = `${columna(j)}${i + 1}`;
          return typeof v === 'number' && Number.isFinite(v)
            ? `<c r="${ref}"${estilo}><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"${estilo}><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${i + 1}">${celdas}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${cuerpo}</sheetData></worksheet>`;
}

/** Excel limita los nombres de hoja a 31 caracteres y prohíbe : \ / ? * [ ] */
const nombreHoja = (n) => n.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

export function crearXlsx(hojas) {
  const archivos = [
    {
      nombre: '[Content_Types].xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    },
    {
      nombre: '_rels/.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas
        .map((h, i) => `<sheet name="${escapar(nombreHoja(h.nombre))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      // Estilo 0: normal · estilo 1: negrita con fondo gris (encabezados)
      nombre: 'xl/styles.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFE8D8"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(h) })),
  ];
  return zip(archivos);
}

export function descargarBlob(blob, nombre) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
