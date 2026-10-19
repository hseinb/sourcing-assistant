'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { SourcingSupplier } from '@/lib/types';
import {
  Camera,
  X,
  Plus,
  CheckCircle2,
  Loader2,
  Zap,
  Package,
  Building2,
  Layers,
} from 'lucide-react';
import { compressImageFile, saveImageLocally } from '@/lib/utils/imageCompressor';
import { formatCNY } from '@/lib/utils/formatters';

interface RapidMarketCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSaved?: () => void;
}

export function RapidMarketCaptureModal({
  isOpen,
  onClose,
  onItemSaved,
}: RapidMarketCaptureModalProps) {
  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [quickBoothName, setQuickBoothName] = useState('');

  const [form, setForm] = useState({
    factory_item_code: '',
    internal_item_code: '',
    price_cny: '',
    pcs_per_carton: '24',
    carton_cbm: '0.05',
    item_name: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [lastSavedItem, setLastSavedItem] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      const { data } = await supabase.from('sourcing_suppliers').select('*').order('name');
      setSuppliers((data as SourcingSupplier[]) || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress immediately using Deebeh's canvas compressor
      const compressed = await compressImageFile(file, {
        maxWidth: 1400,
        maxHeight: 1400,
        quality: 0.8,
      });
      setImageFile(compressed);
      setImagePreviewUrl(URL.createObjectURL(compressed));
    } catch (err) {
      console.error('Compression error:', err);
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveAndNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.factory_item_code && !form.internal_item_code) {
      alert('Please enter at least a Factory Code or Internal Code');
      return;
    }

    setSaving(true);
    try {
      let finalSupplierId = selectedSupplierId || null;

      // If user typed a quick booth name instead of selecting an existing supplier
      if (!finalSupplierId && quickBoothName.trim()) {
        const { data: newSup } = await supabase
          .from('sourcing_suppliers')
          .insert({
            name: quickBoothName.trim(),
            shop_no: quickBoothName.trim(),
            market_city: 'Yiwu',
            rating: 5,
          })
          .select()
          .single();

        if (newSup) {
          finalSupplierId = newSup.id;
          fetchSuppliers();
        }
      }

      // Save photo locally to C:\Users\hussi\Desktop\China\AppPics as WebP
      let uploadedUrl: string | null = null;
      if (imageFile) {
        uploadedUrl = await saveImageLocally(
          imageFile,
          form.internal_item_code || form.factory_item_code || 'rapid'
        );
      }

      // Insert Sourced Item
      const { error: insertErr } = await supabase.from('sourcing_items').insert({
        supplier_id: finalSupplierId,
        factory_item_code: form.factory_item_code.trim() || null,
        internal_item_code: form.internal_item_code.trim() || null,
        factory_item_name_cn: form.item_name.trim() || null,
        price_cny: parseFloat(form.price_cny) || 0,
        pcs_per_carton: parseInt(form.pcs_per_carton, 10) || 24,
        carton_cbm: parseFloat(form.carton_cbm) || 0.05,
        primary_image_url: uploadedUrl,
        notes: 'Captured via Mobile Walking Mode',
      });

      if (insertErr) throw insertErr;

      setLastSavedItem(form.internal_item_code || form.factory_item_code || 'Product');

      // Reset form fields for immediate next snapshot
      setForm({
        factory_item_code: '',
        internal_item_code: '',
        price_cny: '',
        pcs_per_carton: '24',
        carton_cbm: '0.05',
        item_name: '',
      });
      setImageFile(null);
      setImagePreviewUrl(null);

      if (onItemSaved) onItemSaved();
    } catch (err) {
      console.error('Failed to save rapid item:', err);
      alert('Error saving product.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 space-y-0 my-4">
        {/* Rapid Mode Header */}
        <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-950 uppercase tracking-tight">
                Mobile Rapid Market Capture
              </h3>
              <p className="text-[11px] text-slate-900 font-medium">Walking Mode • Snap & Log in 5s</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-900 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner for Last Saved Item */}
        {lastSavedItem && (
          <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center gap-2 text-emerald-900 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>✓ Saved {lastSavedItem}! Ready for next photo.</span>
          </div>
        )}

        <form onSubmit={handleSaveAndNext} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Camera Trigger / Photo Snapshot Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Product Photo Snapshot
            </label>
            <div className="relative h-36 bg-slate-50 border-2 border-dashed border-amber-300 rounded-2xl flex items-center justify-center overflow-hidden group">
              {imagePreviewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Snapshot"
                    className="w-full h-full object-contain p-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreviewUrl(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-slate-900/80 text-white rounded-full hover:bg-slate-950"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Tap to Snap Product Photo</span>
                  <span className="text-[10px] text-slate-400">Auto-compressed for fast upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 2. Rapid Entry Specs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Factory Code (货号) *
              </label>
              <input
                type="text"
                value={form.factory_item_code}
                onChange={(e) => setForm({ ...form, factory_item_code: e.target.value })}
                placeholder="e.g. HD-8802A"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                Internal Code (BBC-5001)
              </label>
              <input
                type="text"
                value={form.internal_item_code}
                onChange={(e) => setForm({ ...form, internal_item_code: e.target.value })}
                placeholder="e.g. BBC-5001"
                className="w-full px-3 py-2 bg-amber-50/70 border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Unit Price (RMB ¥) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={form.price_cny}
                onChange={(e) => setForm({ ...form, price_cny: e.target.value })}
                placeholder="¥ 18.50"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Carton CBM (m³)
              </label>
              <input
                type="number"
                step="any"
                value={form.carton_cbm}
                onChange={(e) => setForm({ ...form, carton_cbm: e.target.value })}
                placeholder="0.052"
                className="w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-950"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Qty / Carton (装箱数)
              </label>
              <input
                type="number"
                value={form.pcs_per_carton}
                onChange={(e) => setForm({ ...form, pcs_per_carton: e.target.value })}
                placeholder="24"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Item Name / Description
              </label>
              <input
                type="text"
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                placeholder="e.g. Stainless Pliers"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
              />
            </div>
          </div>

          {/* 3. Supplier / Booth Selection */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700">
                Supplier / Market Booth
              </label>
              <span className="text-[10px] text-slate-400">Select or enter booth</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-semibold"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.shop_no ? `(${s.shop_no})` : ''}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={quickBoothName}
                onChange={(e) => {
                  setQuickBoothName(e.target.value);
                  if (e.target.value) setSelectedSupplierId('');
                }}
                placeholder="Or Quick Booth # (e.g. Shop 3421)"
                className="w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Done
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Save & Snap Next Item</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
