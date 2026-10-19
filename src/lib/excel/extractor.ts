import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase/client';
import { saveImageLocally } from '../utils/imageCompressor';

export interface TelemetryLogEntry {
  id: string;
  step: string;
  detail: string;
  durationMs: number;
  totalElapsedMs: number;
  status: 'pending' | 'running' | 'completed' | 'warning';
}

export interface ParsedItemRow {
  rowNumber: number;
  itemCode: string;
  internalCode?: string;
  itemName: string;
  priceCNY: number;
  pcsPerCarton: number;
  cartonCount: number;
  quantityPcs: number;
  cbmPerCarton: number;
  totalCbm: number;
  grossWeightKg: number;
  imageUrl?: string;
  imageBlob?: Blob | null;
  isUploaded?: boolean;
}

export interface ParsedExcelRow {
  rowIndex: number;
  extractedImageUrl?: string;
  itemCode?: string;
  itemNameCn?: string;
  itemNameEn?: string;
  unitPriceCny?: number;
  unitPriceUsd?: number;
  pcsPerCarton?: number;
  cartonLengthCm?: number;
  cartonWidthCm?: number;
  cartonHeightCm?: number;
  cartonCbm?: number;
  totalCbm?: number;
  cartonWeightKg?: number;
  quantity?: number;
  moq?: number;
  material?: string;
  notes?: string;
  rawColumns: Record<string, any>;
}

export interface ExtractedExcelData {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  headerRowIndex: number;
  rows: ParsedExcelRow[];
  totalImagesFound: number;
}

/**
 * Resolves the specific drawing XML and media files belonging strictly to the active worksheet
 */
export async function extractImagesFromSheetScoped(
  zip: JSZip,
  sheetName: string,
  onLog?: (entry: TelemetryLogEntry) => void,
  startTime = performance.now()
): Promise<Map<number, Blob>> {
  const rowImageMap = new Map<number, Blob>();
  const stepStart = performance.now();

  try {
    // 1. Find all media files in xl/media/
    const mediaFiles = new Map<string, JSZip.JSZipObject>();
    zip.folder('xl/media')?.forEach((relativePath, fileObj) => {
      mediaFiles.set(relativePath, fileObj);
      mediaFiles.set(`../media/${relativePath}`, fileObj);
      mediaFiles.set(`media/${relativePath}`, fileObj);
    });

    // 2. Identify the active sheet XML file from workbook.xml and workbook.xml.rels
    let sheetFilePath = 'worksheets/sheet1.xml';
    if (zip.file('xl/workbook.xml') && zip.file('xl/_rels/workbook.xml.rels')) {
      const wbXml = await zip.file('xl/workbook.xml')!.async('text');
      const wbRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('text');

      const relMap = new Map<string, string>();
      const relMatches = Array.from(wbRels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g));
      relMatches.forEach((m) => relMap.set(m[1], m[2]));

      const sheetMatches = Array.from(wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g));
      const targetRelId = sheetMatches.find((m) => m[1] === sheetName)?.[2];
      if (targetRelId && relMap.has(targetRelId)) {
        sheetFilePath = relMap.get(targetRelId)!;
      }
    }

    // 3. Find the exact drawing file linked in sheet relationships (e.g. xl/worksheets/_rels/sheet1.xml.rels)
    const sheetFileName = sheetFilePath.split('/').pop() || 'sheet1.xml';
    const sheetRelPath = `xl/worksheets/_rels/${sheetFileName}.rels`;
    let drawingFilePath = 'xl/drawings/drawing1.xml';

    if (zip.file(sheetRelPath)) {
      const sRelXml = await zip.file(sheetRelPath)!.async('text');
      const drawMatch = sRelXml.match(/Type="[^"]*relationships\/drawing"[^>]*Target="([^"]+)"/);
      if (drawMatch) {
        drawingFilePath = 'xl/' + drawMatch[1].replace('../', '');
      }
    }

    // 4. Read relationship map for this specific drawing
    const drawingFileName = drawingFilePath.split('/').pop() || 'drawing1.xml';
    const drawingRelPath = `xl/drawings/_rels/${drawingFileName}.rels`;
    const drawingRelsMap = new Map<string, string>();

    if (zip.file(drawingRelPath)) {
      const dRelsXml = await zip.file(drawingRelPath)!.async('text');
      const dRelMatches = Array.from(dRelsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g));
      dRelMatches.forEach((m) => {
        drawingRelsMap.set(m[1], m[2].replace('../media/', '').replace('media/', ''));
      });
    }

    // 5. Parse Drawing XML anchors for this active sheet
    if (zip.file(drawingFilePath)) {
      const dXml = await zip.file(drawingFilePath)!.async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(dXml, 'text/xml');

      const anchors = [
        ...Array.from(doc.getElementsByTagName('xdr:twoCellAnchor')),
        ...Array.from(doc.getElementsByTagName('xdr:oneCellAnchor')),
        ...Array.from(doc.getElementsByTagName('twoCellAnchor')),
        ...Array.from(doc.getElementsByTagName('oneCellAnchor')),
      ];

      for (const anchor of anchors) {
        const fromElem = anchor.getElementsByTagName('xdr:from')[0] || anchor.getElementsByTagName('from')[0];
        if (!fromElem) continue;

        const fromRowElem = fromElem.getElementsByTagName('xdr:row')[0] || fromElem.getElementsByTagName('row')[0];
        if (!fromRowElem || !fromRowElem.textContent) continue;

        const fromRow = parseInt(fromRowElem.textContent, 10);

        // Check if anchor spans multiple rows (to.row)
        let toRow = fromRow;
        const toElem = anchor.getElementsByTagName('xdr:to')[0] || anchor.getElementsByTagName('to')[0];
        if (toElem) {
          const toRowElem = toElem.getElementsByTagName('xdr:row')[0] || toElem.getElementsByTagName('row')[0];
          if (toRowElem && toRowElem.textContent) {
            toRow = parseInt(toRowElem.textContent, 10);
          }
        }

        const blipElem = anchor.getElementsByTagName('a:blip')[0] || anchor.getElementsByTagName('blip')[0];
        if (!blipElem) continue;

        const embedId = blipElem.getAttribute('r:embed') || blipElem.getAttribute('embed');
        if (!embedId) continue;

        const mediaFileName = drawingRelsMap.get(embedId);
        if (mediaFileName) {
          const mediaObj =
            mediaFiles.get(mediaFileName) ||
            mediaFiles.get(`../media/${mediaFileName}`) ||
            mediaFiles.get(`media/${mediaFileName}`);

          if (mediaObj) {
            const imageBlob = await mediaObj.async('blob');
            // Propagate image across all spanned rows (fromRow to toRow)
            for (let r = fromRow; r <= toRow; r++) {
              if (!rowImageMap.has(r)) {
                rowImageMap.set(r, imageBlob);
              }
            }
          }
        }
      }
    }

    if (onLog) {
      onLog({
        id: 'drawing-extract',
        step: 'Drawing & Media Extraction',
        detail: `Mapped ${rowImageMap.size} rows to exact drawings from "${drawingFileName}"`,
        durationMs: Math.round(performance.now() - stepStart),
        totalElapsedMs: Math.round(performance.now() - startTime),
        status: 'completed',
      });
    }
  } catch (err) {
    console.warn('Error in sheet-scoped drawing extraction:', err);
  }

  return rowImageMap;
}

/**
 * Saves approved image Blobs directly to local folder (C:\Users\hussi\Desktop\China\AppPics) as WebP files
 * ONLY executed upon explicit user commit ("Save to Sourced Items" or "Generate PO")
 */
export async function uploadApprovedItemImages(
  items: ParsedItemRow[],
  onProgress?: (completed: number, total: number) => void
): Promise<ParsedItemRow[]> {
  const itemsWithBlobs = items.filter((i) => i.imageBlob && !i.isUploaded);
  const total = itemsWithBlobs.length;

  if (total === 0) return items;

  let completedCount = 0;
  const CONCURRENCY = 6;
  const updatedItems = [...items];

  // Save single image blob locally as WebP
  const saveSingleLocal = async (item: ParsedItemRow, index: number) => {
    if (!item.imageBlob || item.isUploaded) return;

    try {
      const code = item.internalCode || item.itemCode || 'item';
      const localUrl = await saveImageLocally(item.imageBlob, code);

      if (localUrl) {
        updatedItems[index] = {
          ...item,
          imageUrl: localUrl,
          isUploaded: true,
        };
      }
    } catch (err) {
      console.error('Error saving local WebP image for item:', item.itemCode, err);
    } finally {
      completedCount++;
      if (onProgress) onProgress(completedCount, total);
    }
  };

  // Run in concurrent chunks of 6
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((item, chunkIdx) => saveSingleLocal(item, i + chunkIdx)));
  }

  return updatedItems;
}

/**
 * Helper to score and normalize header strings for auto-matching Chinese and English columns
 */
export function guessColumnType(header: string): string {
  const h = header.toLowerCase().trim();

  if (/图片|image|photo|pic|img/i.test(h)) return 'image';
  if (/货号|款号|型号|item.*code|item.*no|art.*no|model|产品编号/i.test(h)) return 'itemCode';
  if (/内部.*码|internal.*code|sku|自编码/i.test(h)) return 'internalCode';
  if (/品名|产品名称|中文名|中文描述|name.*cn|chinese.*name|名称/i.test(h)) return 'itemNameCn';
  if (/英文名|英文描述|description|name.*en|product.*name|item.*name|规格|描述/i.test(h)) return 'itemNameEn';
  if (/单价.*(元|rmb|￥|cny)|price.*cny|rmb.*price|price.*rmb/i.test(h)) return 'unitPriceCny';
  if (/单价.*(\$|usd|美金|美元)|price.*usd|usd.*price/i.test(h)) return 'unitPriceUsd';
  if (/单价|price|unit.*price|单价\(元\)/i.test(h)) return 'unitPriceCny';
  if (/装箱.*数|装箱量|pcs.*ctn|qty.*ctn|pcs.*box|packing|每箱/i.test(h)) return 'pcsPerCarton';
  if (/数量|qty|quantity|订购数|total.*pcs|总数量/i.test(h)) return 'quantity';
  if (/箱数|ctns|cartons|total.*ctn|总箱数/i.test(h)) return 'cartonCount';
  if (/总.*体积|total.*cbm|总体积|总cbm|total.*volume|总方数|总体积\(cbm\)/i.test(h)) return 'totalCbm';
  if (/单箱.*体积|cbm.*ctn|体积|cbm|立方|m3|体积\(cbm\)/i.test(h)) return 'cartonCbm';
  if (/毛重|gross.*weight|gw|g\.w|重量|weight|毛重\(kg\)/i.test(h)) return 'cartonWeightKg';
  if (/长|length|l\(cm\)/i.test(h)) return 'cartonLengthCm';
  if (/宽|width|w\(cm\)/i.test(h)) return 'cartonWidthCm';
  if (/高|height|h\(cm\)/i.test(h)) return 'cartonHeightCm';
  if (/起订量|moq|min.*order/i.test(h)) return 'moq';
  if (/材质|material/i.test(h)) return 'material';
  if (/备注|note|remark/i.test(h)) return 'notes';

  return 'unknown';
}

/**
 * Smart Non-First-Row Header Row Finder
 * Evaluates the first 15 rows of a spreadsheet and scores them to find the true table header row
 */
export function findSmartHeaderRow(matrix: any[][]): number {
  if (!matrix || matrix.length === 0) return 0;

  const maxScanRows = Math.min(matrix.length, 15);
  let bestRowIndex = 0;
  let highestScore = -1;

  const headerKeywords = [
    '货号', '款号', '型号', 'item', 'code', 'art',
    '品名', '名称', 'name', 'desc', 'description', '中文描述', '英文描述',
    '单价', 'price', 'rmb', '元', 'usd', '$',
    '装箱数', '装箱量', 'pcs/ctn', 'qty/ctn', 'packing',
    '数量', 'quantity', 'qty', '箱数', 'carton', 'ctn',
    '总体积', 'total cbm', '体积', 'cbm', '立方', '毛重', 'weight', 'gw',
    '图片', 'photo', 'image', 'pic', '产品图片'
  ];

  for (let r = 0; r < maxScanRows; r++) {
    const row = matrix[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    let stringCount = 0;

    for (const cell of row) {
      if (typeof cell === 'string' && cell.trim().length > 0) {
        stringCount++;
        const cellLower = cell.toLowerCase().trim();

        // Check keyword matches
        for (const kw of headerKeywords) {
          if (cellLower.includes(kw)) {
            score += 3;
            break;
          }
        }
      }
    }

    // Add string density weight
    score += Math.min(stringCount, 5);

    if (score > highestScore && stringCount >= 2) {
      highestScore = score;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

/**
 * Instant Universal In-Memory Parser with Sheet-Scoped Drawing Alignment
 */
export async function parseExcelWithImages(
  file: File,
  onLog?: (entry: TelemetryLogEntry) => void,
  targetSheetName?: string
): Promise<{
  items: ParsedItemRow[];
  sheetNames: string[];
  activeSheet: string;
  rawRows: any[];
  images: Record<string, string>;
  detectedHeaderRow: number;
  parseDurationMs: number;
}> {
  const globalStartTime = performance.now();

  if (onLog) {
    onLog({
      id: 'start',
      step: 'File Ingestion Initialized',
      detail: `Loading ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      durationMs: 0,
      totalElapsedMs: 0,
      status: 'running',
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames || ['Sheet1'];
  const activeSheet = targetSheetName && sheetNames.includes(targetSheetName) ? targetSheetName : sheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];

  // 1. Extract image blobs scoped to the active sheet
  const imageBlobsMap = await extractImagesFromSheetScoped(zip, activeSheet, onLog, globalStartTime);

  // 2. Generate zero-latency local Object URLs for instant preview
  const localBlobStart = performance.now();
  const localImageUrls: Record<string, string> = {};

  for (const [rowIdx, blob] of Array.from(imageBlobsMap.entries())) {
    const localUrl = URL.createObjectURL(blob);
    localImageUrls[`row_${rowIdx}`] = localUrl;
  }

  if (onLog) {
    onLog({
      id: 'local-blobs',
      step: 'Local Blob Preview URLs Created',
      detail: `Created ${Object.keys(localImageUrls).length} in-memory preview URLs`,
      durationMs: Math.round(performance.now() - localBlobStart),
      totalElapsedMs: Math.round(performance.now() - globalStartTime),
      status: 'completed',
    });
  }

  // 3. Parse SheetJS matrix
  const sheetStart = performance.now();
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const headerRowIndex = findSmartHeaderRow(rawMatrix);
  const headerRow = rawMatrix[headerRowIndex] || [];
  const headers = headerRow.map((h: any, colIdx: number) =>
    h ? String(h).trim() : `Column_${colIdx + 1}`
  );

  if (onLog) {
    onLog({
      id: 'sheetjs-matrix',
      step: 'Worksheet Matrix & Smart Header Analysis',
      detail: `Decoded ${rawMatrix.length} rows on sheet "${activeSheet}". Smart Header at Row ${headerRowIndex + 1}`,
      durationMs: Math.round(performance.now() - sheetStart),
      totalElapsedMs: Math.round(performance.now() - globalStartTime),
      status: 'completed',
    });
  }

  // 4. Parse data rows after detected header
  const rowStart = performance.now();
  const rawRows: any[] = [];
  const items: ParsedItemRow[] = [];

  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!row || !Array.isArray(row) || row.every((c) => c === '' || c === null || c === undefined)) {
      continue;
    }

    const rowObj: Record<string, any> = {};
    let itemCode = '';
    let internalCode = '';
    let itemName = '';
    let priceCNY = 0;
    let pcsPerCarton = 1;
    let cartonCount = 1;
    let quantityPcs = 0;
    let cbmPerCarton = 0;
    let totalCbm = 0;
    let grossWeightKg = 10;

    headers.forEach((h: string, colIdx: number) => {
      const val = row[colIdx];
      rowObj[h] = val;
      const type = guessColumnType(h);
      const strVal = String(val).trim();
      const numVal = parseFloat(String(val).replace(/[^0-9.-]/g, ''));

      if (type === 'itemCode' && !itemCode) itemCode = strVal;
      if (type === 'internalCode' && !internalCode) internalCode = strVal;
      if ((type === 'itemNameCn' || type === 'itemNameEn') && !itemName) itemName = strVal;
      if (type === 'unitPriceCny' && !isNaN(numVal)) priceCNY = numVal;
      if (type === 'pcsPerCarton' && !isNaN(numVal)) pcsPerCarton = Math.round(numVal) || 1;
      if (type === 'cartonCount' && !isNaN(numVal)) cartonCount = Math.round(numVal) || 1;
      if (type === 'quantity' && !isNaN(numVal)) quantityPcs = Math.round(numVal);
      if (type === 'totalCbm' && !isNaN(numVal)) totalCbm = numVal;
      if (type === 'cartonCbm' && !isNaN(numVal)) cbmPerCarton = numVal;
      if (type === 'cartonWeightKg' && !isNaN(numVal)) grossWeightKg = numVal;
    });

    if (!quantityPcs && cartonCount && pcsPerCarton) {
      quantityPcs = cartonCount * pcsPerCarton;
    }

    // Two-way CBM resolution
    if (totalCbm > 0 && (!cbmPerCarton || cbmPerCarton === 0) && cartonCount > 0) {
      cbmPerCarton = Number((totalCbm / cartonCount).toFixed(4));
    } else if (cbmPerCarton > 0 && (!totalCbm || totalCbm === 0) && cartonCount > 0) {
      totalCbm = Number((cbmPerCarton * cartonCount).toFixed(4));
    } else if (!cbmPerCarton && !totalCbm) {
      cbmPerCarton = 0.05;
      totalCbm = Number((0.05 * cartonCount).toFixed(4));
    }

    // Exact 0-indexed row match in sheet drawing anchors
    const matchedImg = localImageUrls[`row_${r}`] || '';
    const matchedBlob = imageBlobsMap.get(r) || null;

    rawRows.push(rowObj);
    items.push({
      rowNumber: r + 1,
      itemCode: itemCode || `ITEM-${r + 1}`,
      internalCode: internalCode || '',
      itemName: itemName || `Product ${r + 1}`,
      priceCNY,
      pcsPerCarton,
      cartonCount,
      quantityPcs,
      cbmPerCarton,
      totalCbm,
      grossWeightKg,
      imageUrl: matchedImg,
      imageBlob: matchedBlob,
      isUploaded: false,
    });
  }

  const parseDurationMs = Math.round(performance.now() - globalStartTime);

  if (onLog) {
    onLog({
      id: 'complete',
      step: 'Parse Finalized & Aligned',
      detail: `Successfully parsed and aligned ${items.length} product lines in ${parseDurationMs} ms`,
      durationMs: Math.round(performance.now() - rowStart),
      totalElapsedMs: parseDurationMs,
      status: 'completed',
    });
  }

  return {
    items,
    sheetNames,
    activeSheet,
    rawRows,
    images: localImageUrls,
    detectedHeaderRow: headerRowIndex + 1,
    parseDurationMs,
  };
}
