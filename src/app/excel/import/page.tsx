'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingSupplier } from '@/lib/types';
import {
  FileSpreadsheet,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Package,
  ShoppingCart,
  Loader2,
  Trash2,
  Eye,
  SlidersHorizontal,
  Edit3,
  Plus,
  Cpu,
  Zap,
  Terminal,
  Clock,
  CloudUpload,
  Info,
  X,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RefreshCw,
  UploadCloud,
  Layers,
} from 'lucide-react';
import {
  parseExcelWithImages,
  uploadApprovedItemImages,
  ParsedItemRow,
  TelemetryLogEntry,
} from '@/lib/excel/extractor';
import { formatCNY, formatNumber } from '@/lib/utils/formatters';
import { ImageModal } from '@/components/ui/ImageModal';
import { detectGPUInfoAsync, getGPUInfo, GPUInfo } from '@/lib/utils/gpuAccelerator';
import { syncPOInvoiceEntry } from '@/lib/ledger/syncLedger';

export default function ExcelImportPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);
  const [totalParseDurationMs, setTotalParseDurationMs] = useState<number | null>(null);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(true);

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [extractedImages, setExtractedImages] = useState<Record<string, string>>({});
  const [parsedItems, setParsedItems] = useState<ParsedItemRow[]>([]);
  const [initialParsedItems, setInitialParsedItems] = useState<ParsedItemRow[]>([]);
  const [replacingRowIndex, setReplacingRowIndex] = useState<number | null>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);

  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [showGPUModal, setShowGPUModal] = useState(false);

  // On-demand upload progress state
  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    title: string;
    completed: number;
    total: number;
  }>({
    isOpen: false,
    title: '',
    completed: 0,
    total: 0,
  });

  const [savingItems, setSavingItems] = useState(false);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    fetchSuppliers();
    detectGPUInfoAsync().then(setGpuInfo);
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data } = await supabase.from('sourcing_suppliers').select('*').order('name');
      setSuppliers((data as SourcingSupplier[]) || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setTelemetryLogs([]);
    setTotalParseDurationMs(null);
    setSaveSuccessMessage(null);
    setSavedCount(null);

    const logsAccumulator: TelemetryLogEntry[] = [];
    const handleProgressLog = (entry: TelemetryLogEntry) => {
      logsAccumulator.push(entry);
      setTelemetryLogs([...logsAccumulator]);
    };

    try {
      // 100% In-Memory Parse with active sheet selection
      const result = await parseExcelWithImages(selectedFile, handleProgressLog);
      setAvailableSheets(result.sheetNames || []);
      setActiveSheet(result.activeSheet || '');
      setParsedItems(result.items);
      setInitialParsedItems(result.items.map((i) => ({ ...i })));
      setRawRows(result.rawRows || []);
      setExtractedImages(result.images || {});
      setTotalParseDurationMs(result.parseDurationMs);

      if (result.rawRows && result.rawRows.length > 0) {
        const cols = Object.keys(result.rawRows[0]);
        setDetectedColumns(cols);

        // Pre-fill smart mapping
        const autoMap: Record<string, string> = {};
        cols.forEach((col) => {
          const lower = col.toLowerCase();
          if (lower.includes('货号') || lower.includes('code') || lower.includes('item no') || lower.includes('art') || lower.includes('型号')) {
            autoMap['item_code'] = col;
          } else if (lower.includes('内部') || lower.includes('sku') || lower.includes('internal')) {
            autoMap['internal_code'] = col;
          } else if (lower.includes('中文描述') || lower.includes('品名') || lower.includes('name') || lower.includes('desc') || lower.includes('名称')) {
            autoMap['item_name'] = col;
          } else if (lower.includes('单价') || lower.includes('price') || lower.includes('元') || lower.includes('rmb') || lower.includes('unit price')) {
            autoMap['price_cny'] = col;
          } else if (lower.includes('装箱量') || lower.includes('装箱数') || lower.includes('pcs/ctn') || lower.includes('qty/ctn') || lower.includes('箱装')) {
            autoMap['pcs_per_carton'] = col;
          } else if (lower.includes('箱数') || lower.includes('ctns') || lower.includes('cartons') || lower.includes('件数')) {
            autoMap['carton_count'] = col;
          } else if (lower.includes('数量') || lower.includes('quantity') || lower.includes('total pcs')) {
            autoMap['quantity_pcs'] = col;
          } else if (lower.includes('总体积') || lower.includes('total cbm') || lower.includes('总cbm') || lower.includes('总方数')) {
            autoMap['total_cbm'] = col;
          } else if (lower.includes('体积') || lower.includes('cbm') || lower.includes('m3') || lower.includes('立方') || lower.includes('cbm/ctn')) {
            autoMap['cbm'] = col;
          } else if (lower.includes('毛重') || lower.includes('weight') || lower.includes('gw') || lower.includes('kg')) {
            autoMap['weight'] = col;
          }
        });
        setMapping(autoMap);
      }
    } catch (err) {
      console.error('Error parsing excel:', err);
      alert('Failed to parse Excel spreadsheet. Please check format.');
    } finally {
      setParsing(false);
    }
  };

  const handleSheetChange = async (newSheet: string) => {
    if (!file || newSheet === activeSheet) return;
    setActiveSheet(newSheet);
    setParsing(true);
    setTelemetryLogs([]);
    setTotalParseDurationMs(null);

    const logsAccumulator: TelemetryLogEntry[] = [];
    const handleProgressLog = (entry: TelemetryLogEntry) => {
      logsAccumulator.push(entry);
      setTelemetryLogs([...logsAccumulator]);
    };

    try {
      const result = await parseExcelWithImages(file, handleProgressLog, newSheet);
      setParsedItems(result.items);
      setInitialParsedItems(result.items.map((i) => ({ ...i })));
      setRawRows(result.rawRows || []);
      setExtractedImages(result.images || {});
      setTotalParseDurationMs(result.parseDurationMs);

      if (result.rawRows && result.rawRows.length > 0) {
        const cols = Object.keys(result.rawRows[0]);
        setDetectedColumns(cols);
      }
    } catch (err) {
      console.error('Error switching sheet:', err);
    } finally {
      setParsing(false);
    }
  };

  const reapplyMapping = (newMap: Record<string, string>) => {
    setMapping(newMap);
    if (!rawRows || rawRows.length === 0) return;

    const remapped = rawRows.map((row, idx) => {
      const codeCol = newMap['item_code'];
      const internalCol = newMap['internal_code'];
      const nameCol = newMap['item_name'];
      const priceCol = newMap['price_cny'];
      const pcsCol = newMap['pcs_per_carton'];
      const ctnCol = newMap['carton_count'];
      const qtyCol = newMap['quantity_pcs'];
      const cbmCol = newMap['cbm'];
      const totalCbmCol = newMap['total_cbm'];
      const wtCol = newMap['weight'];

      const pcsPerCtn = pcsCol && row[pcsCol] ? parseInt(String(row[pcsCol]).replace(/[^\d]/g, ''), 10) || 24 : 24;
      const ctnCount = ctnCol && row[ctnCol] ? parseInt(String(row[ctnCol]).replace(/[^\d]/g, ''), 10) || 10 : 10;
      const price = priceCol && row[priceCol] ? parseFloat(String(row[priceCol]).replace(/[^\d.]/g, '')) || 0 : 0;
      const qty = qtyCol && row[qtyCol] ? parseInt(String(row[qtyCol]).replace(/[^\d]/g, ''), 10) || (ctnCount * pcsPerCtn) : (ctnCount * pcsPerCtn);
      let cbm = cbmCol && row[cbmCol] ? parseFloat(String(row[cbmCol]).replace(/[^\d.]/g, '')) || 0 : 0;
      let totalCbmVal = totalCbmCol && row[totalCbmCol] ? parseFloat(String(row[totalCbmCol]).replace(/[^\d.]/g, '')) || 0 : 0;
      const wt = wtCol && row[wtCol] ? parseFloat(String(row[wtCol]).replace(/[^\d.]/g, '')) || 10 : 10;

      // Two-way CBM formula
      if (totalCbmVal > 0 && (!cbm || cbm === 0) && ctnCount > 0) {
        cbm = Number((totalCbmVal / ctnCount).toFixed(4));
      } else if (cbm > 0 && (!totalCbmVal || totalCbmVal === 0) && ctnCount > 0) {
        totalCbmVal = Number((cbm * ctnCount).toFixed(4));
      } else if (!cbm && !totalCbmVal) {
        cbm = 0.05;
        totalCbmVal = Number((0.05 * ctnCount).toFixed(4));
      }

      // Preserve image blob and preview URL
      const currentItem = parsedItems[idx];
      const existingImg = currentItem?.imageUrl || extractedImages[`row_${idx + 1}`] || '';
      const existingBlob = currentItem?.imageBlob || null;

      return {
        rowNumber: idx + 1,
        itemCode: codeCol && row[codeCol] ? String(row[codeCol]).trim() : currentItem?.itemCode || `ITEM-${idx + 1}`,
        internalCode: internalCol && row[internalCol] ? String(row[internalCol]).trim() : currentItem?.internalCode || '',
        itemName: nameCol && row[nameCol] ? String(row[nameCol]).trim() : currentItem?.itemName || '',
        priceCNY: price,
        pcsPerCarton: pcsPerCtn,
        cartonCount: ctnCount,
        quantityPcs: qty,
        cbmPerCarton: cbm,
        totalCbm: totalCbmVal,
        grossWeightKg: wt,
        imageUrl: existingImg,
        imageBlob: existingBlob,
        isUploaded: currentItem?.isUploaded || false,
      };
    });

    setParsedItems(remapped);
  };

  const handleUpdateRow = (index: number, field: keyof ParsedItemRow, value: any) => {
    const updated = [...parsedItems];
    let sanitizedVal = value;

    if (field === 'cartonCount' || field === 'pcsPerCarton' || field === 'quantityPcs') {
      sanitizedVal = parseInt(String(value).replace(/[^\d]/g, ''), 10) || 0;
    } else if (field === 'priceCNY' || field === 'cbmPerCarton' || field === 'totalCbm' || field === 'grossWeightKg') {
      sanitizedVal = parseFloat(String(value).replace(/[^\d.]/g, '')) || 0;
    }

    const current = { ...updated[index], [field]: sanitizedVal };

    // Synchronize CBM & quantity calculations
    if (field === 'cbmPerCarton') {
      const cbm = Number(sanitizedVal) || 0;
      current.totalCbm = Number((cbm * (Number(current.cartonCount) || 1)).toFixed(4));
    } else if (field === 'totalCbm') {
      const totCbm = Number(sanitizedVal) || 0;
      current.cbmPerCarton = Number((totCbm / (Number(current.cartonCount) || 1)).toFixed(4));
    } else if (field === 'cartonCount') {
      const ctns = Number(sanitizedVal) || 1;
      current.cartonCount = ctns;
      current.quantityPcs = ctns * (Number(current.pcsPerCarton) || 24);
      current.totalCbm = Number(((Number(current.cbmPerCarton) || 0.05) * ctns).toFixed(4));
    } else if (field === 'pcsPerCarton') {
      const pcs = Number(sanitizedVal) || 1;
      current.pcsPerCarton = pcs;
      current.quantityPcs = (Number(current.cartonCount) || 1) * pcs;
    }

    updated[index] = current;
    setParsedItems(updated);
  };

  const handleDeleteRow = (index: number) => {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  };

  /**
   * Delete image at index and shift all subsequent images upward by 1 row ("Push up a notch")
   */
  const handleDeleteAndShiftUp = (index: number) => {
    setParsedItems((prev) => {
      const updated = [...prev];
      for (let i = index; i < updated.length - 1; i++) {
        updated[i] = {
          ...updated[i],
          imageUrl: updated[i + 1].imageUrl || '',
          imageBlob: updated[i + 1].imageBlob || null,
          isUploaded: updated[i + 1].isUploaded || false,
        };
      }
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          imageUrl: '',
          imageBlob: null,
          isUploaded: false,
        };
      }
      return updated;
    });
  };

  /**
   * Shift image at index and all subsequent images downward by 1 row, leaving index empty
   */
  const handleShiftDown = (index: number) => {
    setParsedItems((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i > index; i--) {
        updated[i] = {
          ...updated[i],
          imageUrl: updated[i - 1].imageUrl || '',
          imageBlob: updated[i - 1].imageBlob || null,
          isUploaded: updated[i - 1].isUploaded || false,
        };
      }
      updated[index] = {
        ...updated[index],
        imageUrl: '',
        imageBlob: null,
        isUploaded: false,
      };
      return updated;
    });
  };

  /**
   * Global Column-Wide Nudge: Shift all images across the entire spreadsheet up or down by 1 row
   */
  const handleGlobalShift = (direction: 'up' | 'down') => {
    setParsedItems((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      if (direction === 'up') {
        for (let i = 0; i < updated.length - 1; i++) {
          updated[i] = {
            ...updated[i],
            imageUrl: updated[i + 1].imageUrl || '',
            imageBlob: updated[i + 1].imageBlob || null,
            isUploaded: updated[i + 1].isUploaded || false,
          };
        }
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          imageUrl: '',
          imageBlob: null,
          isUploaded: false,
        };
      } else {
        for (let i = updated.length - 1; i > 0; i--) {
          updated[i] = {
            ...updated[i],
            imageUrl: updated[i - 1].imageUrl || '',
            imageBlob: updated[i - 1].imageBlob || null,
            isUploaded: updated[i - 1].isUploaded || false,
          };
        }
        updated[0] = {
          ...updated[0],
          imageUrl: '',
          imageBlob: null,
          isUploaded: false,
        };
      }
      return updated;
    });
  };

  /**
   * Trigger local file picker to replace a specific row's image
   */
  const triggerRowImageUpload = (index: number) => {
    setReplacingRowIndex(index);
    if (rowFileInputRef.current) {
      rowFileInputRef.current.value = '';
      rowFileInputRef.current.click();
    }
  };

  /**
   * Handle selected replacement file from browser
   */
  const handleRowFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || replacingRowIndex === null) return;

    const localUrl = URL.createObjectURL(selectedFile);
    const targetIdx = replacingRowIndex;

    setParsedItems((prev) => {
      const updated = [...prev];
      if (updated[targetIdx]) {
        updated[targetIdx] = {
          ...updated[targetIdx],
          imageUrl: localUrl,
          imageBlob: selectedFile,
          isUploaded: false,
        };
      }
      return updated;
    });
    setReplacingRowIndex(null);
  };

  /**
   * Clear single row's image without affecting neighboring rows
   */
  const handleClearRowImage = (index: number) => {
    setParsedItems((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          imageUrl: '',
          imageBlob: null,
          isUploaded: false,
        };
      }
      return updated;
    });
  };

  /**
   * Revert all images to the initial parsed extraction
   */
  const handleResetImages = () => {
    if (!initialParsedItems || initialParsedItems.length === 0) return;
    setParsedItems((prev) => {
      return prev.map((item, idx) => {
        const orig = initialParsedItems[idx];
        return {
          ...item,
          imageUrl: orig ? orig.imageUrl : '',
          imageBlob: orig ? orig.imageBlob : null,
          isUploaded: false,
        };
      });
    });
  };

  /**
   * ON-DEMAND COMMIT 1: Save Approved Items to Sourced Catalog
   * Uploads ONLY the remaining/approved item photos to cloud storage
   */
  const handleSaveToSourcedItems = async () => {
    if (parsedItems.length === 0) return;
    setSavingItems(true);
    setSaveSuccessMessage(null);

    const photosToUpload = parsedItems.filter((i) => i.imageBlob && !i.isUploaded).length;
    if (photosToUpload > 0) {
      setUploadModal({
        isOpen: true,
        title: 'Saving Approved Product Photos Locally (WebP)',
        completed: 0,
        total: photosToUpload,
      });
    }

    try {
      // 1. Save only approved images locally as WebP
      const uploadedItems = await uploadApprovedItemImages(parsedItems, (completed, total) => {
        setUploadModal((prev) => ({ ...prev, completed, total }));
      });
      setParsedItems(uploadedItems);

      // 2. Insert records into Supabase
      const itemsToInsert = uploadedItems.map((item) => ({
        supplier_id: selectedSupplierId || null,
        factory_item_code: item.itemCode,
        internal_item_code: item.internalCode || null,
        factory_item_name_cn: item.itemName,
        price_cny: item.priceCNY || 0,
        pcs_per_carton: item.pcsPerCarton || 24,
        carton_cbm: item.cbmPerCarton || 0.05,
        carton_gross_weight_kg: item.grossWeightKg || 10,
        primary_image_url: item.isUploaded ? item.imageUrl : null,
        notes: `Imported from Excel: ${file?.name || 'Supplier Sheet'}`,
      }));

      const { error } = await supabase.from('sourcing_items').insert(itemsToInsert);
      if (error) throw error;

      setSavedCount(itemsToInsert.length);
      setSaveSuccessMessage(
        `✓ Successfully saved ${itemsToInsert.length} approved items with local WebP images!`
      );
    } catch (err) {
      console.error('Error saving items:', err);
      alert('Failed to save items to catalog.');
    } finally {
      setSavingItems(false);
      setUploadModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  /**
   * ON-DEMAND COMMIT 2: Generate Purchase Order Directly
   * Saves ONLY the approved/retained photos locally, then creates PO
   */
  const handleGeneratePurchaseOrder = async () => {
    if (!selectedSupplierId) {
      alert('Please select a Chinese Supplier before generating a PO');
      return;
    }
    if (parsedItems.length === 0) return;

    setGeneratingPO(true);
    const photosToUpload = parsedItems.filter((i) => i.imageBlob && !i.isUploaded).length;
    if (photosToUpload > 0) {
      setUploadModal({
        isOpen: true,
        title: 'Saving PO Line Photos Locally (WebP)',
        completed: 0,
        total: photosToUpload,
      });
    }

    try {
      // 1. Upload only approved images in parallel batches
      const uploadedItems = await uploadApprovedItemImages(parsedItems, (completed, total) => {
        setUploadModal((prev) => ({ ...prev, completed, total }));
      });
      setParsedItems(uploadedItems);

      const totalAmountCny = Number(
        uploadedItems
          .reduce(
            (sum, item) => sum + (Number(item.quantityPcs) || 0) * (Number(item.priceCNY) || 0),
            0
          )
          .toFixed(2)
      );
      const totalPieces = uploadedItems.reduce((sum, item) => sum + (Number(item.quantityPcs) || 0), 0);
      const totalCartons = uploadedItems.reduce((sum, item) => sum + (Number(item.cartonCount) || 0), 0);
      const totalCbm = Number(
        uploadedItems
          .reduce(
            (sum, item) =>
              sum +
              (Number(item.totalCbm) || (Number(item.cartonCount) || 0) * (Number(item.cbmPerCarton) || 0.05)),
            0
          )
          .toFixed(3)
      );
      const totalWeight = Number(
        uploadedItems
          .reduce(
            (sum, item) => sum + (Number(item.cartonCount) || 0) * (Number(item.grossWeightKg) || 10),
            0
          )
          .toFixed(2)
      );

      const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
      const supplierPaymentTerms = supplierObj?.payment_terms || '30% Deposit + Balance Before Delivery';
      const depositReq = (supplierPaymentTerms.includes('COD') || supplierPaymentTerms.includes('Days After Receiving')) ? 0 : 30;

      // 2. Create PO
      const { data: poData, error: poErr } = await supabase
        .from('sourcing_purchase_orders')
        .insert({
          po_number: `PO-EXCEL-${Date.now().toString().slice(-6)}`,
          supplier_id: selectedSupplierId,
          status: 'Draft',
          currency: 'CNY',
          total_amount_cny: totalAmountCny,
          deposit_required_percent: depositReq,
          deposit_paid_cny: 0,
          balance_due_cny: totalAmountCny,
          payment_terms: supplierPaymentTerms,
          total_pieces: totalPieces,
          total_cartons: totalCartons,
          total_cbm: totalCbm,
          total_weight_kg: totalWeight,
          shipping_mark: 'ABC / YIWU / 2026',
          order_date: new Date().toISOString().slice(0, 10),
          notes: `Generated directly from parsed Excel: ${file?.name}`,
        })
        .select()
        .single();

      if (poErr) throw poErr;

      // 3. Insert PO line items with uploaded photos & internal codes
      const poLineItems = uploadedItems.map((item) => {
        const ctns = Number(item.cartonCount) || 1;
        const pcsPerCtn = Number(item.pcsPerCarton) || 1;
        const qty = Number(item.quantityPcs) || ctns * pcsPerCtn;
        const price = Number(item.priceCNY) || 0;
        const cbmPerCtn = Number(item.cbmPerCarton) || 0.05;
        const totalCbmVal = Number((item.totalCbm || ctns * cbmPerCtn).toFixed(4));
        const wtPerCtn = Number(item.grossWeightKg) || 10;
        const totalWt = Number((ctns * wtPerCtn).toFixed(2));

        return {
          po_id: poData.id,
          item_code_snapshot: item.itemCode,
          internal_item_code: item.internalCode || null,
          item_name_snapshot: item.itemName,
          image_url_snapshot: item.isUploaded ? item.imageUrl : null,
          quantity_pcs: qty,
          pcs_per_carton: pcsPerCtn,
          carton_count: ctns,
          unit_price_cny: price,
          total_price_cny: Number((qty * price).toFixed(2)),
          carton_cbm: cbmPerCtn,
          total_cbm: totalCbmVal,
          total_weight_kg: totalWt,
        };
      });

      const { error: lineErr } = await supabase
        .from('sourcing_purchase_order_items')
        .insert(poLineItems);

      if (lineErr) {
        // Rollback orphan PO record if line items fail
        await supabase.from('sourcing_purchase_orders').delete().eq('id', poData.id);
        throw lineErr;
      }

      // 4. Auto-sync Credit - Invoice in Supplier Ledger
      await syncPOInvoiceEntry(poData);

      router.push(`/orders/${poData.id}`);
    } catch (err) {
      console.error('Error generating PO:', err);
      alert('Failed to create purchase order.');
    } finally {
      setGeneratingPO(false);
      setUploadModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with GPU Acceleration Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <span>Excel Invoice & Packing List Importer</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Zero-latency in-memory parsing with OpenXML drawing photo extraction and on-demand cloud sync.
          </p>
        </div>

        {/* GPU Hardware Acceleration Status Indicator */}
        {gpuInfo && gpuInfo.isSupported && (
          <button
            type="button"
            onClick={() => setShowGPUModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl text-xs font-mono border border-slate-800 shadow-xs self-start sm:self-auto text-left transition-colors cursor-pointer"
            title="Click to view GPU hardware diagnostics and configuration"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold text-white flex items-center gap-1">
                <span>{gpuInfo.isNvidia ? '⚡ NVIDIA GPU Accelerated' : '⚡ Hardware Accelerated GPU'}</span>
                <Info className="w-3 h-3 text-slate-400 inline" />
              </span>
              <span className="text-[10px] text-slate-400 truncate block max-w-[220px]">
                {gpuInfo.renderer.replace(/ANGLE \(| Direct3D.*|\)/g, '') || gpuInfo.webglVersion}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Upload & Supplier Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              1. Select Chinese Supplier (Optional for catalog, Required for PO)
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="">-- Choose Supplier (or leave unassigned) --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.shop_no ? `(${s.shop_no})` : ''} - {s.market_city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              2. Upload Supplier Spreadsheet (.xlsx)
            </label>
            <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border-2 border-dashed border-emerald-300 hover:bg-emerald-100/70 text-emerald-900 rounded-xl cursor-pointer text-xs font-bold transition-all">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>{file ? file.name : 'Choose or Drag Excel File'}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>

        {/* Multi-Sheet Selector Tabs */}
        {availableSheets.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Select Active Sheet:</span>
            </span>
            {availableSheets.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSheetChange(s)}
                disabled={parsing}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSheet === s
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Live Real-Time Telemetry & Step Timing Log Console */}
        {telemetryLogs.length > 0 && (
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-inner space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white tracking-wide uppercase text-[11px]">
                  Excel Parser Telemetry & Performance Timing
                </span>
              </div>
              <div className="flex items-center gap-3">
                {totalParseDurationMs !== null && (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
                    ⚡ Total In-Memory Parse: {totalParseDurationMs} ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  {showTelemetryDrawer ? 'Collapse Log' : 'Expand Log'}
                </button>
              </div>
            </div>

            {showTelemetryDrawer && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 text-[11px] leading-relaxed py-0.5 hover:bg-slate-900/60 px-1 rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      <strong className="text-slate-200 shrink-0">{log.step}:</strong>
                      <span className="text-slate-400 truncate">{log.detail}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px]">
                      {log.durationMs > 0 && (
                        <span className="text-amber-400 font-bold font-mono">
                          Δt: {log.durationMs}ms
                        </span>
                      )}
                      <span className="text-slate-600 font-mono">
                        +{log.totalElapsedMs}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success banner if items were saved to catalog */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong className="text-sm font-bold block">{saveSuccessMessage}</strong>
              <span className="text-xs text-emerald-700">
                You can now click <strong>Generate PO Directly</strong> below or continue reviewing the table.
              </span>
            </div>
          </div>
          <Link
            href="/items"
            className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950 shrink-0"
          >
            View Sourced Catalog &rarr;
          </Link>
        </div>
      )}

      {/* Parsed Results View */}
      {parsedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          {/* Action Bar & Mapping Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Parsed Spreadsheet Items ({parsedItems.length})</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                  {Object.keys(extractedImages).length} Images Ready in Memory
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Edit column mappings, tweak values inline, or remove unwanted rows. Photos are uploaded only when committed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMappingEditor(!showMappingEditor)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showMappingEditor ? 'Hide Mapping' : 'Customize Column Mapping'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToSourcedItems}
                disabled={savingItems}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Package className="w-3.5 h-3.5" />
                <span>{savingItems ? 'Saving to Catalog...' : 'Save to Sourced Items'}</span>
              </button>

              <button
                type="button"
                onClick={handleGeneratePurchaseOrder}
                disabled={generatingPO}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{generatingPO ? 'Generating PO...' : 'Generate PO Directly'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Column Mapping Editor */}
          {showMappingEditor && detectedColumns.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Column Field Mapping</span>
                </span>
                <span className="text-[11px] text-slate-400">Match detected Excel columns to our app fields</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Factory Item Code</label>
                  <select
                    value={mapping['item_code'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, item_code: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-amber-900 text-[11px] mb-1">Internal Code (BBC-5001)</label>
                  <select
                    value={mapping['internal_code'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, internal_code: e.target.value })}
                    className="w-full px-2 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950"
                  >
                    <option value="">-- None / Custom --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Chinese Name / Desc</label>
                  <select
                    value={mapping['item_name'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, item_name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Unit Price RMB</label>
                  <select
                    value={mapping['price_cny'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, price_cny: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Pcs Per Carton</label>
                  <select
                    value={mapping['pcs_per_carton'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, pcs_per_carton: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Cartons Count</label>
                  <select
                    value={mapping['carton_count'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, carton_count: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Total Quantity Pcs</label>
                  <select
                    value={mapping['quantity_pcs'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, quantity_pcs: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Carton CBM Option */}
                <div>
                  <label className="block font-bold text-purple-900 text-[11px] mb-1">Carton CBM (单箱体积)</label>
                  <select
                    value={mapping['cbm'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, cbm: e.target.value })}
                    className="w-full px-2 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Total CBM Option */}
                <div>
                  <label className="block font-bold text-indigo-900 text-[11px] mb-1">Total CBM (总体积/总方)</label>
                  <select
                    value={mapping['total_cbm'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, total_cbm: e.target.value })}
                    className="w-full px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 text-[11px] mb-1">Gross Weight (kg)</label>
                  <select
                    value={mapping['weight'] || ''}
                    onChange={(e) => reapplyMapping({ ...mapping, weight: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border rounded-lg text-xs"
                  >
                    <option value="">-- Auto/None --</option>
                    {detectedColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Editable Items Table with Dual CBM & Photo Previews */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                <tr>
                  <th className="py-2.5 px-2 text-center">Row</th>
                  <th className="py-2.5 px-3 text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 font-bold text-slate-700">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Photo</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({parsedItems.filter((i) => Boolean(i.imageUrl)).length})
                        </span>
                      </div>
                      {/* Global Column Shift Controls */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleGlobalShift('up')}
                          title="Shift ALL Photos Up 1 Row across entire spreadsheet"
                          className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGlobalShift('down')}
                          title="Shift ALL Photos Down 1 Row across entire spreadsheet"
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <div className="w-[1px] h-3 bg-slate-200 my-auto" />
                        <button
                          type="button"
                          onClick={handleResetImages}
                          title="Reset all photos to initial parsed state"
                          className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Factory Code</th>
                  <th className="py-2.5 px-3">Internal Code</th>
                  <th className="py-2.5 px-3">Name / Description</th>
                  <th className="py-2.5 px-3">Price (RMB)</th>
                  <th className="py-2.5 px-2 text-center">Pcs/Ctn</th>
                  <th className="py-2.5 px-2 text-center">Cartons</th>
                  <th className="py-2.5 px-2 text-center">Total Pcs</th>
                  <th className="py-2.5 px-2">CBM/Ctn</th>
                  <th className="py-2.5 px-2">Total CBM</th>
                  <th className="py-2.5 px-3 text-right">Row Total</th>
                  <th className="py-2.5 px-2 text-right">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                      {item.rowNumber}
                    </td>

                    {/* Extracted Photo Thumbnail with Interactive Shift & Replace Toolbar */}
                    <td className="py-2 px-2 text-center align-middle">
                      <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                        {item.imageUrl ? (
                          <div className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.itemCode || 'Product photo'}
                              className="w-20 h-20 object-contain rounded-xl border border-slate-200 p-1 mx-auto cursor-pointer bg-white shadow-xs group-hover:border-emerald-400 group-hover:shadow-md transition-all"
                              onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.itemCode || `Row ${item.rowNumber}` })}
                              title="Click to view enlarged full photo"
                            />
                            {/* Overlay Zoom Icon on hover */}
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.itemCode || `Row ${item.rowNumber}` })}
                              className="absolute top-1 right-1 p-1 bg-slate-900/70 hover:bg-slate-900 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Zoom image"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerRowImageUpload(idx)}
                            className="w-20 h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 flex flex-col items-center justify-center mx-auto text-slate-400 hover:text-emerald-700 cursor-pointer transition-all p-1 group"
                            title="Click to upload custom photo for this row"
                          >
                            <UploadCloud className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                            <span className="text-[10px] font-bold mt-1 text-slate-400 group-hover:text-emerald-700">Add Photo</span>
                          </div>
                        )}

                        {/* Row-Level Alignment & Shift Mini-Toolbar */}
                        <div className="flex items-center justify-center gap-1 bg-slate-100/90 border border-slate-200/80 rounded-lg p-0.5">
                          {item.imageUrl ? (
                            <>
                              {/* Delete & Shift Up (Push Up a Notch) */}
                              <button
                                type="button"
                                onClick={() => handleDeleteAndShiftUp(idx)}
                                className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded transition-colors flex items-center cursor-pointer"
                                title="Delete this photo & shift all photos below UP by 1 row (Push up a notch)"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>

                              {/* Shift Down */}
                              <button
                                type="button"
                                onClick={() => handleShiftDown(idx)}
                                className="p-1 text-blue-600 hover:text-white hover:bg-blue-600 rounded transition-colors cursor-pointer"
                                title="Shift this photo & all below DOWN by 1 row (Insert blank gap)"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>

                              {/* Replace Photo */}
                              <button
                                type="button"
                                onClick={() => triggerRowImageUpload(idx)}
                                className="p-1 text-emerald-700 hover:text-white hover:bg-emerald-600 rounded transition-colors cursor-pointer"
                                title="Replace with custom local photo"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>

                              {/* Clear Photo */}
                              <button
                                type="button"
                                onClick={() => handleClearRowImage(idx)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors cursor-pointer"
                                title="Clear this photo only (without shifting other rows)"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Replace/Add when empty */}
                              <button
                                type="button"
                                onClick={() => triggerRowImageUpload(idx)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                title="Upload photo for this row"
                              >
                                <UploadCloud className="w-3 h-3" />
                                <span>Upload</span>
                              </button>
                              {/* Shift Down into this empty slot */}
                              <button
                                type="button"
                                onClick={() => handleShiftDown(idx)}
                                className="p-1 text-blue-600 hover:text-white hover:bg-blue-600 rounded transition-colors cursor-pointer"
                                title="Shift photos below down by 1 row"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Factory Code */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.itemCode}
                        onChange={(e) => handleUpdateRow(idx, 'itemCode', e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border rounded text-xs font-mono font-bold"
                      />
                    </td>

                    {/* Internal Code */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.internalCode || ''}
                        placeholder="e.g. BBC-5001"
                        onChange={(e) => handleUpdateRow(idx, 'internalCode', e.target.value)}
                        className="w-28 px-2 py-1 bg-amber-50/60 border border-amber-200 rounded text-xs font-mono font-bold text-amber-900"
                      />
                    </td>

                    {/* Item Name */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleUpdateRow(idx, 'itemName', e.target.value)}
                        className="w-32 px-2 py-1 bg-slate-50 border rounded text-xs"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="any"
                        value={item.priceCNY}
                        onChange={(e) => handleUpdateRow(idx, 'priceCNY', parseFloat(e.target.value) || 0)}
                        className="w-18 px-2 py-1 bg-slate-50 border rounded text-xs font-bold"
                      />
                    </td>

                    {/* Pcs/Ctn */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        value={item.pcsPerCarton}
                        onChange={(e) => handleUpdateRow(idx, 'pcsPerCarton', parseInt(e.target.value, 10) || 1)}
                        className="w-14 px-1 py-1 bg-slate-50 border rounded text-xs text-center"
                      />
                    </td>

                    {/* Cartons */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        value={item.cartonCount}
                        onChange={(e) => handleUpdateRow(idx, 'cartonCount', e.target.value)}
                        className="w-14 px-1 py-1 bg-slate-50 border rounded text-xs text-center font-bold"
                      />
                    </td>

                    {/* Quantity Pcs */}
                    <td className="py-2 px-2 text-center font-bold text-slate-900">
                      {item.quantityPcs}
                    </td>

                    {/* Carton CBM */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="any"
                        value={item.cbmPerCarton}
                        onChange={(e) => handleUpdateRow(idx, 'cbmPerCarton', parseFloat(e.target.value) || 0.05)}
                        className="w-16 px-1.5 py-1 bg-purple-50/60 border border-purple-200 rounded text-xs font-mono text-purple-950 font-semibold"
                        title="Per Carton CBM"
                      />
                    </td>

                    {/* Total CBM */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="any"
                        value={item.totalCbm}
                        onChange={(e) => handleUpdateRow(idx, 'totalCbm', e.target.value)}
                        className="w-16 px-1.5 py-1 bg-indigo-50/60 border border-indigo-200 rounded text-xs font-mono text-indigo-950 font-bold"
                        title="Total CBM for all cartons in row"
                      />
                    </td>

                    {/* Total RMB */}
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCNY((item.quantityPcs || 0) * (item.priceCNY || 0))}
                    </td>

                    {/* Delete Row */}
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* On-Demand Cloud Upload Progress Modal */}
      {uploadModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs animate-bounce">
              <CloudUpload className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900">{uploadModal.title}</h3>
              <p className="text-xs text-slate-500">
                Streaming approved photos to Tokyo storage bucket (6 parallel streams)...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-500">Uploaded Photos</span>
                <span className="font-bold text-emerald-700">
                  {uploadModal.completed} / {uploadModal.total} (
                  {uploadModal.total > 0
                    ? Math.round((uploadModal.completed / uploadModal.total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      uploadModal.total > 0
                        ? (uploadModal.completed / uploadModal.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPU Diagnostics & Configuration Modal */}
      {showGPUModal && gpuInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-lg w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">GPU Hardware Diagnostics</h3>
                  <p className="text-[11px] text-slate-500">Hardware Acceleration for Excel & Media Extraction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGPUModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detected Hardware Info Box */}
            <div className="p-4 bg-slate-50 border rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Renderer:</span>
                <span className="font-bold text-slate-900">{gpuInfo.renderer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GPU Vendor:</span>
                <span className="font-bold text-slate-900">{gpuInfo.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Driver / Pipeline:</span>
                <span className="font-bold text-emerald-700">{gpuInfo.driverType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Acceleration Status:</span>
                <span className="font-bold text-emerald-600">
                  {gpuInfo.isNvidia ? '✓ NVIDIA Discrete GPU Active' : '✓ Hardware Acceleration Enabled (iGPU)'}
                </span>
              </div>
            </div>

            {/* Why Intel Iris appears & how to force NVIDIA guide */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-950">
              <strong className="block font-bold text-amber-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-700" />
                <span>Why did it detect Intel Iris instead of NVIDIA?</span>
              </strong>
              <p className="text-[11px] leading-relaxed text-amber-900">
                On Windows laptops with dual GPUs (Intel Iris + NVIDIA GeForce), Windows and web browsers (Chrome/Edge) default to the low-power <strong>Intel Iris Xe</strong> to save battery.
              </p>
              <div className="text-[11px] space-y-1 pt-1 border-t border-amber-200/80">
                <strong className="block font-bold text-amber-900">How to force Chrome/Edge to use NVIDIA:</strong>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-700 font-sans">
                  <li>Open <strong>Windows Settings</strong> &rarr; <strong>System</strong> &rarr; <strong>Display</strong> &rarr; <strong>Graphics</strong>.</li>
                  <li>Find <strong>Google Chrome</strong> (or Microsoft Edge) in the app list &rarr; click <strong>Options</strong>.</li>
                  <li>Select <strong>"High performance (NVIDIA GPU)"</strong> &rarr; restart browser.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGPUModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Row-Specific Image Replacement */}
      <input
        type="file"
        ref={rowFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleRowFileSelected}
      />

      {/* Image Modal */}
      <ImageModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
      />
    </div>
  );
}
