export type SpreadsheetCell = string | number | boolean | null | undefined

export interface SpreadsheetSheet {
  rows: SpreadsheetCell[][]
}

export interface SpreadsheetWorkbook {
  SheetNames: string[]
  Sheets: Record<string, SpreadsheetSheet>
}

export function createWorkbook(): SpreadsheetWorkbook {
  return { SheetNames: [], Sheets: {} }
}

export function createSheet(rows: SpreadsheetCell[][]): SpreadsheetSheet {
  return { rows }
}

export function appendSheet(workbook: SpreadsheetWorkbook, sheet: SpreadsheetSheet, name: string) {
  if (workbook.Sheets[name]) throw new Error(`工作表名稱重複：${name}`)
  workbook.SheetNames.push(name)
  workbook.Sheets[name] = sheet
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function columnName(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function worksheetXml(sheet: SpreadsheetSheet) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      if (cell == null || cell === '') return ''
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`
      if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}"><v>${cell}</v></c>`
      if (typeof cell === 'boolean') return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(cell))}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
}

function workbookXml(workbook: SpreadsheetWorkbook) {
  const sheets = workbook.SheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`
}

function workbookRelsXml(workbook: SpreadsheetWorkbook) {
  const sheets = workbook.SheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${workbook.SheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
}

function contentTypesXml(workbook: SpreadsheetWorkbook) {
  const sheets = workbook.SheetNames.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
}

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="1"><font><name val="Microsoft JhengHei"/><family val="2"/><sz val="11"/></font></fonts><fills count="2"><fill><patternFill/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function joinBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  parts.forEach((part) => { output.set(part, offset); offset += part.length })
  return output
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  files.forEach((file) => {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, file.data.length, true)
    localView.setUint32(22, file.data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    locals.push(local, file.data)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, file.data.length, true)
    centralView.setUint32(24, file.data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length + file.data.length
  })
  const centralBytes = joinBytes(centrals)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralBytes.length, true)
  endView.setUint32(16, offset, true)
  return joinBytes([...locals, centralBytes, end])
}

export function writeWorkbook(workbook: SpreadsheetWorkbook) {
  const encoder = new TextEncoder()
  const files = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml(workbook)) },
    { name: '_rels/.rels', data: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(workbook)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml(workbook)) },
    { name: 'xl/styles.xml', data: encoder.encode(styles) },
    ...workbook.SheetNames.map((name, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: encoder.encode(worksheetXml(workbook.Sheets[name])) })),
  ]
  return zipStore(files)
}

export function sheetToCsv(sheet: SpreadsheetSheet) {
  return sheet.rows.map((row) => row.map((cell) => {
    const value = cell == null ? '' : String(cell)
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }).join(',')).join('\n')
}
