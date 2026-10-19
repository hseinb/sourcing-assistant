'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { SourcingSupplier, SourcingItem } from '@/lib/types';
import {
  ShoppingCart,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Package,
  Building2,
  Save,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, calculateCartonCBM } from '@/lib/utils/formatters';
import { ImageModal } from '@/components/ui/ImageModal';
import { compressImageFile } from '@/lib/utils/imageCompressor';
import { syncPOInvoiceEntry } from '@/lib/ledger/syncLedger';

interface POLineItem {
  id: string;
  sourcing_item_id: string | null;
  internal_item_code: string;
  item_code: string;
  item_name: string;
  image_url: string;
  pcs_per_carton: number;
  quantity_pcs: number;
  carton_count: number;
  unit_price_cny: number;
  unit_price_usd: number;
  total_price_cny: number;
  carton_cbm: number;
  total_cbm: number;
  total_weight_kg: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams.get('supplier_id') || '';
  const itemIdsParam = searchParams.get('item_ids') || '';

  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [supplierItems, setSupplierItems] = useState<SourcingItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId);

  const [poNumber, setPoNumber] = useState(`PO-${Date.now().toString().slice(-6)}`);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [shippingMark, setShippingMark] = useState('ABC / YIWU / 2026');
  const [paymentTerms, setPaymentTerms] = useState<string>('30% Deposit + Balance Before Delivery');
  const [paymentDueDate, setPaymentDueDate] = useState<string>('');
  const [depositPercent, setDepositPercent] = useState('30');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<POLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Helper to compute projected due date
  const computeDueDate = (terms: string, baseDateStr: string) => {
    if (!baseDateStr) return '';
    try {
      const d = new Date(baseDateStr);
      if (isNaN(d.getTime())) return '';
      if (terms.includes('30 Days') || terms.includes('30天')) {
        d.setDate(d.getDate() + 30);
      } else if (terms.includes('60 Days') || terms.includes('60天')) {
        d.setDate(d.getDate() + 60);
      } else if (terms.includes('90 Days') || terms.includes('90天')) {
        d.setDate(d.getDate() + 90);
      } else if (terms.includes('Cash on Delivery') || terms.includes('COD') || terms.includes('货到付款')) {
        // Due on delivery date
      } else {
        return '';
      }
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const handlePaymentTermsChange = (newTerms: string) => {
    setPaymentTerms(newTerms);
    if (newTerms === 'Cash on Delivery (COD)' || newTerms.includes('Days After Receiving')) {
      setDepositPercent('0');
    } else if (newTerms === '100% Advance Payment') {
      setDepositPercent('100');
    } else if (newTerms === '30% Deposit + Balance Before Delivery') {
      setDepositPercent('30');
    }
    const computed = computeDueDate(newTerms, deliveryDate || orderDate);
    if (computed) setPaymentDueDate(computed);
  };

  const handleDeliveryDateChange = (newDate: string) => {
    setDeliveryDate(newDate);
    const computed = computeDueDate(paymentTerms, newDate || orderDate);
    if (computed) setPaymentDueDate(computed);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      fetchItemsForSupplier(selectedSupplierId);
      const matched = suppliers.find((s) => s.id === selectedSupplierId);
      if (matched?.payment_terms) {
        handlePaymentTermsChange(matched.payment_terms);
      }
    } else {
      setSupplierItems([]);
    }
  }, [selectedSupplierId, suppliers]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: sData } = await supabase.from('sourcing_suppliers').select('*').order('name');
      setSuppliers((sData as SourcingSupplier[]) || []);

      if (initialSupplierId) {
        const { data: iData } = await supabase
          .from('sourcing_items')
          .select('*')
          .eq('supplier_id', initialSupplierId);
        const fetchedItems = (iData as SourcingItem[]) || [];
        setSupplierItems(fetchedItems);

        // Pre-populate items if item_ids passed
        if (itemIdsParam) {
          const targetIds = itemIdsParam.split(',').filter(Boolean);
          const initialLines: POLineItem[] = [];

          targetIds.forEach((id) => {
            const found = fetchedItems.find((i) => i.id === id);
            if (found) {
              const pcsPerCtn = found.pcs_per_carton || 24;
              const unitPrice = found.price_cny || 0;
              const cbmPerCtn = found.carton_cbm || 0.05;
              const wtPerCtn = found.carton_gross_weight_kg || 10;
              const defaultQty = pcsPerCtn * 10;
              const cartonCount = 10;

              initialLines.push({
                id: Math.random().toString(36).substring(2, 9),
                sourcing_item_id: found.id,
                internal_item_code: found.internal_item_code || '',
                item_code: found.factory_item_code || '',
                item_name: found.factory_item_name_cn || found.item_name_en || '',
                image_url: found.primary_image_url || '',
                pcs_per_carton: pcsPerCtn,
                quantity_pcs: defaultQty,
                carton_count: cartonCount,
                unit_price_cny: unitPrice,
                unit_price_usd: found.price_usd || 0,
                total_price_cny: defaultQty * unitPrice,
                carton_cbm: cbmPerCtn,
                total_cbm: Number((cartonCount * cbmPerCtn).toFixed(4)),
                total_weight_kg: Number((cartonCount * wtPerCtn).toFixed(2)),
              });
            }
          });

          if (initialLines.length > 0) setLines(initialLines);
        }
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsForSupplier = async (supId: string) => {
    try {
      const { data: iData } = await supabase
        .from('sourcing_items')
        .select('*')
        .eq('supplier_id', supId);
      setSupplierItems((iData as SourcingItem[]) || []);
    } catch (err) {
      console.error('Error fetching supplier items:', err);
    }
  };

  const addLineItem = (sourcingItem?: SourcingItem) => {
    const pcsPerCtn = sourcingItem?.pcs_per_carton || 24;
    const unitPrice = sourcingItem?.price_cny || 0;
    const cbmPerCtn = sourcingItem?.carton_cbm || 0.05;
    const wtPerCtn = sourcingItem?.carton_gross_weight_kg || 10;
    const defaultQty = pcsPerCtn * 10;
    const cartonCount = 10;

    const newLine: POLineItem = {
      id: Math.random().toString(36).substring(2, 9),
      sourcing_item_id: sourcingItem?.id || null,
      internal_item_code: sourcingItem?.internal_item_code || '',
      item_code: sourcingItem?.factory_item_code || '',
      item_name: sourcingItem?.factory_item_name_cn || sourcingItem?.item_name_en || '',
      image_url: sourcingItem?.primary_image_url || '',
      pcs_per_carton: pcsPerCtn,
      quantity_pcs: defaultQty,
      carton_count: cartonCount,
      unit_price_cny: unitPrice,
      unit_price_usd: sourcingItem?.price_usd || 0,
      total_price_cny: defaultQty * unitPrice,
      carton_cbm: cbmPerCtn,
      total_cbm: Number((cartonCount * cbmPerCtn).toFixed(4)),
      total_weight_kg: Number((cartonCount * wtPerCtn).toFixed(2)),
    };

    setLines([...lines, newLine]);
  };

  const handleLineImageUpload = async (index: number, file: File) => {
    try {
      const compressed = await compressImageFile(file, { maxWidth: 1400, quality: 0.82 });
      const ext = 'jpg';
      const path = `items/po_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('sourcing-item-images')
        .upload(path, compressed);

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage
        .from('sourcing-item-images')
        .getPublicUrl(path);

      const nextLines = [...lines];
      nextLines[index].image_url = data.publicUrl;
      setLines(nextLines);
    } catch (err) {
      console.error('Image upload error:', err);
      alert('Failed to upload image for item.');
    }
  };

  const updateLineQtyByPieces = (index: number, pcs: number) => {
    const nextLines = [...lines];
    const line = nextLines[index];
    const pcsPerCtn = line.pcs_per_carton || 1;
    const ctns = Math.max(1, Math.ceil(pcs / pcsPerCtn));

    line.quantity_pcs = pcs;
    line.carton_count = ctns;
    line.total_price_cny = pcs * line.unit_price_cny;
    line.total_cbm = Number((ctns * line.carton_cbm).toFixed(4));
    setLines(nextLines);
  };

  const updateLineQtyByCartons = (index: number, ctns: number) => {
    const nextLines = [...lines];
    const line = nextLines[index];
    const pcsPerCtn = line.pcs_per_carton || 1;
    const pcs = ctns * pcsPerCtn;

    line.carton_count = ctns;
    line.quantity_pcs = pcs;
    line.total_price_cny = pcs * line.unit_price_cny;
    line.total_cbm = Number((ctns * line.carton_cbm).toFixed(4));
    setLines(nextLines);
  };

  const updateLinePrice = (index: number, price: number) => {
    const nextLines = [...lines];
    const line = nextLines[index];
    line.unit_price_cny = price;
    line.total_price_cny = line.quantity_pcs * price;
    setLines(nextLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  // Rollups
  const totalPieces = lines.reduce((sum, l) => sum + (Number(l.quantity_pcs) || 0), 0);
  const totalCartons = lines.reduce((sum, l) => sum + (Number(l.carton_count) || 0), 0);
  const totalCbm = Number(lines.reduce((sum, l) => sum + (Number(l.total_cbm) || 0), 0).toFixed(3));
  const totalWeight = Number(lines.reduce((sum, l) => sum + (Number(l.total_weight_kg) || 0), 0).toFixed(2));
  const totalAmountCny = Number(lines.reduce((sum, l) => sum + (Number(l.total_price_cny) || 0), 0).toFixed(2));
  const depositAmt = (totalAmountCny * (parseFloat(depositPercent) || 30)) / 100;

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (lines.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Purchase Order
      const { data: poData, error: poErr } = await supabase
        .from('sourcing_purchase_orders')
        .insert({
          po_number: poNumber.trim(),
          supplier_id: selectedSupplierId,
          status: 'Draft',
          currency: 'CNY',
          total_amount_cny: totalAmountCny,
          deposit_required_percent: parseFloat(depositPercent) || 0,
          deposit_paid_cny: 0,
          balance_due_cny: totalAmountCny,
          payment_terms: paymentTerms.trim() || '30% Deposit + Balance Before Delivery',
          payment_due_date: paymentDueDate || null,
          total_pieces: totalPieces,
          total_cartons: totalCartons,
          total_cbm: totalCbm,
          total_weight_kg: totalWeight,
          shipping_mark: shippingMark.trim() || null,
          warehouse_delivery_date: deliveryDate || null,
          order_date: orderDate,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (poErr) throw poErr;

      // 2. Insert PO line items with internal_item_code & thumbnail
      const poItems = lines.map((l) => ({
        po_id: poData.id,
        sourcing_item_id: l.sourcing_item_id,
        internal_item_code: l.internal_item_code.trim() || null,
        item_code_snapshot: l.item_code,
        item_name_snapshot: l.item_name,
        image_url_snapshot: l.image_url || null,
        quantity_pcs: l.quantity_pcs,
        pcs_per_carton: l.pcs_per_carton,
        carton_count: l.carton_count,
        unit_price_cny: l.unit_price_cny,
        unit_price_usd: l.unit_price_usd,
        total_price_cny: l.total_price_cny,
        carton_cbm: l.carton_cbm,
        total_cbm: l.total_cbm,
        total_weight_kg: l.total_weight_kg,
      }));

      const { error: itemsErr } = await supabase
        .from('sourcing_purchase_order_items')
        .insert(poItems);

      if (itemsErr) throw itemsErr;

      // 3. Auto-sync Credit - Invoice in Supplier Ledger
      await syncPOInvoiceEntry(poData);

      router.push(`/orders/${poData.id}`);
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      alert('Error creating PO.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs">Preparing PO generator...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Purchase Orders</span>
      </Link>

      <form onSubmit={handleSavePO} className="space-y-6">
        {/* Header Block */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-blue-600">New Purchase Order</span>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">Generate Order & Packing Specs</h1>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Creating PO...' : 'Create Purchase Order'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chinese Supplier *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="">-- Select Supplier / Booth --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.shop_no ? `(${s.shop_no})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO Number *</label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            {/* Payment Terms Selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center justify-between">
                <span>Payment Terms (付款条件) *</span>
                {paymentTerms.includes('COD') || paymentTerms.includes('Days') ? (
                  <span className="text-[11px] font-normal text-emerald-700 font-sans">
                    ✓ 0% upfront deposit required (Pay upon/after delivery)
                  </span>
                ) : null}
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => handlePaymentTermsChange(e.target.value)}
                className="w-full px-3 py-2 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950"
              >
                <option value="Cash on Delivery (COD)">📦 Cash on Delivery (COD) / 货到付款 (100% on arrival)</option>
                <option value="30 Days After Receiving">⏳ 30 Days After Receiving / 货到30天 (Net 30 Days Credit)</option>
                <option value="60 Days After Receiving">⏳ 60 Days After Receiving / 货到60天 (Net 60 Days Credit)</option>
                <option value="90 Days After Receiving">⏳ 90 Days After Receiving / 货到90天 (Net 90 Days Credit)</option>
                <option value="30% Deposit + Balance Before Delivery">💰 30% Deposit + Balance Before Delivery / 30%定金+发货前尾款</option>
                <option value="100% Advance Payment">⚡ 100% Advance Payment / 全款预付</option>
                <option value="Custom">✏️ Custom Payment Terms / 自定义条款</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Required (%)</label>
              <input
                type="number"
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                placeholder="e.g. 30"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WH Delivery Deadline (China)</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => handleDeliveryDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Projected Payment Due Date</label>
              <input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs font-bold text-amber-950 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shipping Mark</label>
              <input
                type="text"
                value={shippingMark}
                onChange={(e) => setShippingMark(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Order Line Items ({lines.length})</h3>
              <p className="text-xs text-slate-500">Includes live photo thumbnails & custom internal final codes (e.g. BBC-5001)</p>
            </div>

            {/* Quick item add dropdown */}
            <div className="flex items-center gap-2">
              {supplierItems.length > 0 && (
                <select
                  onChange={(e) => {
                    const found = supplierItems.find((i) => i.id === e.target.value);
                    if (found) addLineItem(found);
                    e.target.value = '';
                  }}
                  className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-800"
                >
                  <option value="">+ Add Catalog Item ({supplierItems.length})</option>
                  {supplierItems.map((si) => (
                    <option key={si.id} value={si.id}>
                      {si.factory_item_code} - {si.factory_item_name_cn || si.item_name_en} ({formatCNY(si.price_cny)})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => addLineItem()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                + Custom Line Item
              </button>
            </div>
          </div>

          {lines.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-2xl">
              No items added to this PO yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Photo</th>
                    <th className="py-2.5 px-3">Factory Code</th>
                    <th className="py-2.5 px-3">Internal Code (BBC-5001)</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Pcs/Ctn</th>
                    <th className="py-2.5 px-3">Order Qty (Pcs)</th>
                    <th className="py-2.5 px-3">Cartons</th>
                    <th className="py-2.5 px-3">Price (RMB)</th>
                    <th className="py-2.5 px-3">CBM</th>
                    <th className="py-2.5 px-3">Total (RMB)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id}>
                      {/* Photo Thumbnail */}
                      <td className="py-2 px-3 text-center">
                        {line.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.image_url}
                            alt="Item"
                            className="w-10 h-10 object-contain rounded-lg border p-0.5 mx-auto cursor-pointer hover:scale-110 transition-transform bg-slate-50"
                            onClick={() => setPreviewImage({ url: line.image_url, title: line.item_code || 'Item Photo' })}
                          />
                        ) : (
                          <label className="w-10 h-10 rounded-lg border border-dashed border-slate-300 flex items-center justify-center mx-auto cursor-pointer hover:bg-slate-100 text-slate-400">
                            <Camera className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleLineImageUpload(idx, e.target.files[0])}
                            />
                          </label>
                        )}
                      </td>

                      {/* Factory Code */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={line.item_code}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx].item_code = e.target.value;
                            setLines(next);
                          }}
                          placeholder="Factory Code"
                          className="w-24 px-2 py-1 bg-slate-50 border rounded text-xs font-mono font-bold"
                        />
                      </td>

                      {/* Final Internal Code (e.g. BBC-5001) */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={line.internal_item_code}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx].internal_item_code = e.target.value;
                            setLines(next);
                          }}
                          placeholder="e.g. BBC-5001"
                          className="w-28 px-2 py-1 bg-amber-50/60 border border-amber-200 rounded text-xs font-mono font-bold text-amber-900"
                        />
                      </td>

                      {/* Description */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={line.item_name}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx].item_name = e.target.value;
                            setLines(next);
                          }}
                          placeholder="Item Description"
                          className="w-36 px-2 py-1 bg-slate-50 border rounded text-xs"
                        />
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-center">{line.pcs_per_carton}</td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={line.quantity_pcs}
                          onChange={(e) => updateLineQtyByPieces(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-20 px-2 py-1 bg-slate-50 border rounded text-xs font-bold"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={line.carton_count}
                          onChange={(e) => updateLineQtyByCartons(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-16 px-2 py-1 bg-slate-50 border rounded text-xs font-bold"
                        />
                      </td>

                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="any"
                          value={line.unit_price_cny}
                          onChange={(e) => updateLinePrice(idx, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-slate-50 border rounded text-xs font-bold"
                        />
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-700">{line.total_cbm.toFixed(3)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{formatCNY(line.total_price_cny)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grand Totals Summary Box */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Total Pieces</span>
              <strong className="text-base text-white">{totalPieces} pcs</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Total Cartons</span>
              <strong className="text-base text-white">{totalCartons} ctns</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Total CBM</span>
              <strong className="text-base text-amber-400 font-mono">{totalCbm} CBM</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Grand Total (RMB)</span>
              <strong className="text-base text-emerald-400">{formatCNY(totalAmountCny)}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Deposit ({depositPercent}%)</span>
              <strong className="text-base text-purple-300">{formatCNY(depositAmt)}</strong>
            </div>
          </div>
        </div>
      </form>

      {/* Image Zoom Modal */}
      <ImageModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
      />
    </div>
  );
}
