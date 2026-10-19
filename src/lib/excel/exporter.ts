import ExcelJS from 'exceljs';
import { SourcingContainer, SourcingPurchaseOrder } from '../types';

/**
 * Fetches an image URL or Blob and converts it to an ArrayBuffer for ExcelJS embedding
 */
async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; extension: 'jpeg' | 'png' } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const isPng = blob.type.includes('png') || url.toLowerCase().endsWith('.png');
    return {
      buffer,
      extension: isPng ? 'png' : 'jpeg',
    };
  } catch (err) {
    console.warn('Could not fetch image for Excel export:', url, err);
    return null;
  }
}

/**
 * Column definition matching the official office template: 客户订单模版.xlsx
 */
const TEMPLATE_COLUMNS = [
  { header: 'SHOP', key: 'shop', width: 14 },
  { header: 'ITEMNO', key: 'itemno', width: 16 },
  { header: 'PICTURE', key: 'picture', width: 15 },
  { header: '中文品名', key: 'name_cn', width: 26 },
  { header: '英文品名', key: 'name_en', width: 26 },
  { header: 'CTN', key: 'ctn', width: 10 },
  { header: 'PCS', key: 'pcs', width: 10 },
  { header: 'T/QTY', key: 't_qty', width: 12 },
  { header: 'PRICE', key: 'price', width: 12 },
  { header: 'AMOUNT', key: 'amount', width: 12 },
  { header: 'T/AMOUNT', key: 't_amount', width: 15 },
  { header: 'CBM', key: 'cbm', width: 10 },
  { header: 'CBMS', key: 'cbms', width: 12 },
  { header: 'KG', key: 'kg', width: 10 },
  { header: 'KGS', key: 'kgs', width: 12 },
];

/**
 * Applies header styling matching the office template
 */
function applyHeaderStyles(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'SimSun', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });
}

/**
 * Applies standard cell borders and alignments to data rows
 */
function styleDataRow(row: ExcelJS.Row) {
  row.height = 65; // Height to fit product picture comfortably
  row.eachCell((cell, colNumber) => {
    cell.font = { name: 'SimSun', size: 9 };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4D4D4' } },
      bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } },
      left: { style: 'thin', color: { argb: 'FFD4D4D4' } },
      right: { style: 'thin', color: { argb: 'FFD4D4D4' } },
    };

    // Align text left for descriptions, center for codes and numeric columns
    if (colNumber === 4 || colNumber === 5) {
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });
}

/**
 * Appends the standard office summary row with dynamic Excel formulas
 */
function appendSummaryRow(sheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
  const summaryRowIndex = endRow + 1;
  const summaryRow = sheet.getRow(summaryRowIndex);
  summaryRow.height = 26;

  // A: TOTAL
  summaryRow.getCell(1).value = 'TOTAL';

  if (endRow >= startRow) {
    // F: CTN
    summaryRow.getCell(6).value = { formula: `SUM(F${startRow}:F${endRow})` };
    // H: T/QTY
    summaryRow.getCell(8).value = { formula: `SUM(H${startRow}:H${endRow})` };
    // K: T/AMOUNT
    summaryRow.getCell(11).value = { formula: `SUM(K${startRow}:K${endRow})` };
    // M: CBMS
    summaryRow.getCell(13).value = { formula: `SUM(M${startRow}:M${endRow})` };
    // O: KGS
    summaryRow.getCell(15).value = { formula: `SUM(O${startRow}:O${endRow})` };
  }

  summaryRow.eachCell((cell) => {
    cell.font = { name: 'SimSun', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAEAEA' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FFD4D4D4' } },
      right: { style: 'thin', color: { argb: 'FFD4D4D4' } },
    };
  });
}

/**
 * Generates and downloads a Purchase Order strictly adhering to 客户订单模版.xlsx
 */
export async function exportPurchaseOrderExcel(po: SourcingPurchaseOrder): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sourcing Assistant';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }],
  });

  sheet.columns = TEMPLATE_COLUMNS;
  applyHeaderStyles(sheet);

  const shopNo = po.supplier?.shop_no || po.supplier?.name || 'F3-16901';
  let currentRow = 2;

  for (const item of po.items || []) {
    const internalCode =
      item.internal_item_code ||
      item.sourcing_item?.internal_item_code ||
      item.item_code_snapshot ||
      item.sourcing_item?.factory_item_code ||
      '';

    const nameCn =
      item.item_name_snapshot ||
      item.sourcing_item?.factory_item_name_cn ||
      '';

    const nameEn =
      item.sourcing_item?.item_name_en ||
      '';

    const ctns = Number(item.carton_count || 1);
    const pcsPerCtn = Number(item.pcs_per_carton || 1);
    const price = Number(item.unit_price_cny || 0);
    const cbmPerCtn = Number(item.carton_cbm || item.sourcing_item?.carton_cbm || 0.05);
    const wtPerCtn = Number(item.sourcing_item?.carton_gross_weight_kg || 10);

    const row = sheet.getRow(currentRow);
    row.getCell(1).value = shopNo;
    row.getCell(2).value = internalCode;
    row.getCell(3).value = ''; // Picture placeholder
    row.getCell(4).value = nameCn;
    row.getCell(5).value = nameEn;
    row.getCell(6).value = ctns;
    row.getCell(7).value = pcsPerCtn;
    row.getCell(8).value = { formula: `F${currentRow}*G${currentRow}`, result: ctns * pcsPerCtn };
    row.getCell(9).value = price;
    row.getCell(10).value = price;
    row.getCell(11).value = { formula: `H${currentRow}*I${currentRow}`, result: ctns * pcsPerCtn * price };
    row.getCell(12).value = cbmPerCtn;
    row.getCell(13).value = { formula: `F${currentRow}*L${currentRow}`, result: Number((ctns * cbmPerCtn).toFixed(4)) };
    row.getCell(14).value = wtPerCtn;
    row.getCell(15).value = { formula: `F${currentRow}*N${currentRow}`, result: Number((ctns * wtPerCtn).toFixed(2)) };

    styleDataRow(row);

    // Embed picture if available
    const imageUrl = item.image_url_snapshot || item.sourcing_item?.primary_image_url;
    if (imageUrl) {
      const imgData = await fetchImageBuffer(imageUrl);
      if (imgData) {
        const imageId = workbook.addImage({
          buffer: imgData.buffer,
          extension: imgData.extension,
        });

        sheet.addImage(imageId, {
          tl: { col: 2.1, row: currentRow - 1 + 0.1 },
          ext: { width: 75, height: 75 },
          editAs: 'oneCell',
        });
      }
    }

    currentRow++;
  }

  const lastItemRow = currentRow - 1;
  appendSummaryRow(sheet, 2, lastItemRow);

  // Trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PO_${po.po_number || 'Order'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a Master Consolidated Container Packing List strictly adhering to 客户订单模版.xlsx
 */
export async function exportContainerPackingList(
  container: SourcingContainer,
  purchaseOrders: SourcingPurchaseOrder[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sourcing Assistant';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }],
  });

  sheet.columns = TEMPLATE_COLUMNS;
  applyHeaderStyles(sheet);

  let currentRow = 2;

  for (const po of purchaseOrders) {
    const shopNo = po.supplier?.shop_no || po.supplier?.name || 'F3-16901';

    for (const item of po.items || []) {
      const internalCode =
        item.internal_item_code ||
        item.sourcing_item?.internal_item_code ||
        item.item_code_snapshot ||
        item.sourcing_item?.factory_item_code ||
        '';

      const nameCn =
        item.item_name_snapshot ||
        item.sourcing_item?.factory_item_name_cn ||
        '';

      const nameEn =
        item.sourcing_item?.item_name_en ||
        '';

      const ctns = Number(item.carton_count || 1);
      const pcsPerCtn = Number(item.pcs_per_carton || 1);
      const price = Number(item.unit_price_cny || 0);
      const cbmPerCtn = Number(item.carton_cbm || item.sourcing_item?.carton_cbm || 0.05);
      const wtPerCtn = Number(item.sourcing_item?.carton_gross_weight_kg || 10);

      const row = sheet.getRow(currentRow);
      row.getCell(1).value = shopNo;
      row.getCell(2).value = internalCode;
      row.getCell(3).value = '';
      row.getCell(4).value = nameCn;
      row.getCell(5).value = nameEn;
      row.getCell(6).value = ctns;
      row.getCell(7).value = pcsPerCtn;
      row.getCell(8).value = { formula: `F${currentRow}*G${currentRow}`, result: ctns * pcsPerCtn };
      row.getCell(9).value = price;
      row.getCell(10).value = price;
      row.getCell(11).value = { formula: `H${currentRow}*I${currentRow}`, result: ctns * pcsPerCtn * price };
      row.getCell(12).value = cbmPerCtn;
      row.getCell(13).value = { formula: `F${currentRow}*L${currentRow}`, result: Number((ctns * cbmPerCtn).toFixed(4)) };
      row.getCell(14).value = wtPerCtn;
      row.getCell(15).value = { formula: `F${currentRow}*N${currentRow}`, result: Number((ctns * wtPerCtn).toFixed(2)) };

      styleDataRow(row);

      // Embed picture if available
      const imageUrl = item.image_url_snapshot || item.sourcing_item?.primary_image_url;
      if (imageUrl) {
        const imgData = await fetchImageBuffer(imageUrl);
        if (imgData) {
          const imageId = workbook.addImage({
            buffer: imgData.buffer,
            extension: imgData.extension,
          });

          sheet.addImage(imageId, {
            tl: { col: 2.1, row: currentRow - 1 + 0.1 },
            ext: { width: 75, height: 75 },
            editAs: 'oneCell',
          });
        }
      }

      currentRow++;
    }
  }

  const lastItemRow = currentRow - 1;
  appendSummaryRow(sheet, 2, lastItemRow);

  // Trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PackingList_${container.container_number || 'Container'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ContainerSupplierSummaryRow {
  supplierId: string;
  supplierName: string;
  shopNo: string;
  marketCity: string;
  contactPerson: string;
  phone: string;
  wechatId: string;
  poNumbers: string;
  totalAmountCny: number;
  depositPaidCny: number;
  balanceDueCny: number;
  paymentTerms: string;
  paymentDueDate: string;
  totalCartons: number;
  totalCbm: number;
}

/**
 * Aggregates container purchase orders by supplier for executive financial overview
 */
export function aggregateContainerSuppliers(
  purchaseOrders: SourcingPurchaseOrder[]
): ContainerSupplierSummaryRow[] {
  const map = new Map<string, ContainerSupplierSummaryRow>();

  for (const po of purchaseOrders) {
    const s = po.supplier;
    const supplierId = po.supplier_id || s?.id || 'unassigned';
    const supplierName = s?.name || 'Unassigned Supplier';
    const shopNo = s?.shop_no || '-';
    const marketCity = s?.market_city || '-';
    const contactPerson = s?.contact_person || '-';
    const phone = s?.phone || '-';
    const wechatId = s?.wechat_id || '-';

    const existing = map.get(supplierId) || {
      supplierId,
      supplierName,
      shopNo,
      marketCity,
      contactPerson,
      phone,
      wechatId,
      poNumbers: '',
      totalAmountCny: 0,
      depositPaidCny: 0,
      balanceDueCny: 0,
      paymentTerms: '',
      paymentDueDate: '',
      totalCartons: 0,
      totalCbm: 0,
    };

    // Append PO numbers
    const poList = existing.poNumbers ? existing.poNumbers.split(', ') : [];
    if (po.po_number && !poList.includes(po.po_number)) {
      poList.push(po.po_number);
    }
    existing.poNumbers = poList.join(', ');

    // Accumulate financials
    existing.totalAmountCny += Number(po.total_amount_cny || 0);
    existing.depositPaidCny += Number(po.deposit_paid_cny || 0);
    existing.balanceDueCny += Number(po.balance_due_cny || (po.total_amount_cny - (po.deposit_paid_cny || 0)));
    existing.totalCartons += Number(po.total_cartons || 0);
    existing.totalCbm += Number(po.total_cbm || 0);

    // Terms & Due dates
    const termsList = existing.paymentTerms ? existing.paymentTerms.split(' | ') : [];
    const term = po.payment_terms || '30% Deposit + Balance Before Delivery';
    if (!termsList.includes(term)) termsList.push(term);
    existing.paymentTerms = termsList.join(' | ');

    if (po.payment_due_date && !existing.paymentDueDate) {
      existing.paymentDueDate = po.payment_due_date;
    }

    map.set(supplierId, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

/**
 * Generates and downloads an Executive Container Supplier Financial & Logistics Summary Sheet
 */
export async function exportContainerSupplierSummaryExcel(
  container: SourcingContainer,
  purchaseOrders: SourcingPurchaseOrder[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sourcing Assistant';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Supplier Financial Summary', {
    views: [{ showGridLines: true }],
  });

  const columns = [
    { header: 'STORE / SHOP NO. (档口号)', key: 'shop_no', width: 16 },
    { header: 'SUPPLIER / FACTORY (供应商)', key: 'supplier_name', width: 28 },
    { header: 'MARKET CITY (市场)', key: 'market_city', width: 15 },
    { header: 'CONTACT (联系人)', key: 'contact_person', width: 14 },
    { header: 'PHONE / TEL (电话)', key: 'phone', width: 18 },
    { header: 'WECHAT ID (微信)', key: 'wechat_id', width: 16 },
    { header: 'PO NUMBER(S) (订单号)', key: 'po_numbers', width: 22 },
    { header: 'TOTAL ORDER (¥)', key: 'total_amount', width: 18 },
    { header: 'PAID / DEPOSIT (¥)', key: 'paid_amount', width: 18 },
    { header: 'BALANCE DUE (¥)', key: 'balance_due', width: 18 },
    { header: 'PAYMENT TERMS (付款条件)', key: 'payment_terms', width: 32 },
    { header: 'DUE DATE (到期日)', key: 'due_date', width: 14 },
    { header: 'TOTAL CTNS (箱数)', key: 'total_ctns', width: 14 },
    { header: 'TOTAL CBM (方数)', key: 'total_cbm', width: 14 },
  ];

  sheet.columns = columns;

  // Style Header Row
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'SimSun', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }, // Slate-200
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const suppliers = aggregateContainerSuppliers(purchaseOrders);
  let currentRow = 2;

  for (const s of suppliers) {
    const row = sheet.getRow(currentRow);
    row.height = 24;

    row.getCell(1).value = s.shopNo;
    row.getCell(2).value = s.supplierName;
    row.getCell(3).value = s.marketCity;
    row.getCell(4).value = s.contactPerson;
    row.getCell(5).value = s.phone;
    row.getCell(6).value = s.wechatId;
    row.getCell(7).value = s.poNumbers;
    row.getCell(8).value = s.totalAmountCny;
    row.getCell(9).value = s.depositPaidCny;
    row.getCell(10).value = s.balanceDueCny;
    row.getCell(11).value = s.paymentTerms;
    row.getCell(12).value = s.paymentDueDate || '-';
    row.getCell(13).value = s.totalCartons;
    row.getCell(14).value = Number(s.totalCbm.toFixed(4));

    // Cell Formatting
    row.getCell(8).numFmt = '¥#,##0.00';
    row.getCell(9).numFmt = '¥#,##0.00';
    row.getCell(10).numFmt = '¥#,##0.00';
    row.getCell(13).numFmt = '#,##0';
    row.getCell(14).numFmt = '0.000';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'SimSun', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment
      if (colNumber === 2 || colNumber === 11) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colNumber >= 8 && colNumber <= 10) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber >= 13) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    currentRow++;
  }

  // Summary Row
  const lastSupplierRow = currentRow - 1;
  const summaryRow = sheet.getRow(currentRow);
  summaryRow.height = 28;

  summaryRow.getCell(1).value = 'TOTAL';
  summaryRow.getCell(2).value = `${suppliers.length} Suppliers (${purchaseOrders.length} POs)`;

  if (lastSupplierRow >= 2) {
    summaryRow.getCell(8).value = { formula: `SUM(H2:H${lastSupplierRow})` };
    summaryRow.getCell(9).value = { formula: `SUM(I2:I${lastSupplierRow})` };
    summaryRow.getCell(10).value = { formula: `SUM(J2:J${lastSupplierRow})` };
    summaryRow.getCell(13).value = { formula: `SUM(M2:M${lastSupplierRow})` };
    summaryRow.getCell(14).value = { formula: `SUM(N2:N${lastSupplierRow})` };
  } else {
    summaryRow.getCell(8).value = 0;
    summaryRow.getCell(9).value = 0;
    summaryRow.getCell(10).value = 0;
    summaryRow.getCell(13).value = 0;
    summaryRow.getCell(14).value = 0;
  }

  summaryRow.getCell(8).numFmt = '¥#,##0.00';
  summaryRow.getCell(9).numFmt = '¥#,##0.00';
  summaryRow.getCell(10).numFmt = '¥#,##0.00';
  summaryRow.getCell(13).numFmt = '#,##0';
  summaryRow.getCell(14).numFmt = '0.000';

  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'SimSun', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' }, // Light amber-100 highlight
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'double', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    if (colNumber >= 8 && colNumber <= 10) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colNumber >= 13) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Download File
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const containerName = container.container_number || container.shipping_line || 'Container';
  a.download = `Supplier_Financial_Summary_${containerName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
