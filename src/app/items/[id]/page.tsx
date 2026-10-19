'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { SourcingItem, ERPItem } from '@/lib/types';
import {
  Package,
  Building2,
  Layers,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Edit,
  Save,
  Trash2,
  Camera,
  Boxes,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, calculateCartonCBM } from '@/lib/utils/formatters';
import { ERPItemPickerModal } from '@/components/ui/ERPItemPickerModal';
import { ImageModal } from '@/components/ui/ImageModal';

export default function SourcedItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<SourcingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isERPPickerOpen, setIsERPPickerOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [form, setForm] = useState({
    factory_item_code: '',
    internal_item_code: '',
    factory_item_name_cn: '',
    item_name_en: '',
    description: '',
    price_cny: 0,
    price_usd: 0,
    pcs_per_carton: 24,
    carton_length_cm: 0,
    carton_width_cm: 0,
    carton_height_cm: 0,
    carton_cbm: 0.05,
    carton_gross_weight_kg: 10,
    material: '',
    notes: '',
    erp_item_id: null as number | null,
  });

  useEffect(() => {
    if (itemId) fetchItem();
  }, [itemId]);

  const fetchItem = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sourcing_items')
        .select('*, supplier:sourcing_suppliers(*), erp_item:tbl_items(*)')
        .eq('id', itemId)
        .single();

      if (error) throw error;
      const i = data as SourcingItem;
      setItem(i);
      setForm({
        factory_item_code: i.factory_item_code || '',
        internal_item_code: i.internal_item_code || '',
        factory_item_name_cn: i.factory_item_name_cn || '',
        item_name_en: i.item_name_en || '',
        description: i.description || '',
        price_cny: i.price_cny || 0,
        price_usd: i.price_usd || 0,
        pcs_per_carton: i.pcs_per_carton || 24,
        carton_length_cm: i.carton_length_cm || 0,
        carton_width_cm: i.carton_width_cm || 0,
        carton_height_cm: i.carton_height_cm || 0,
        carton_cbm: i.carton_cbm || 0.05,
        carton_gross_weight_kg: i.carton_gross_weight_kg || 10,
        material: i.material || '',
        notes: i.notes || '',
        erp_item_id: i.erp_item_id,
      });
    } catch (err) {
      console.error('Error fetching item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDimChange = (l: number, w: number, h: number) => {
    if (l > 0 && w > 0 && h > 0) {
      const cbm = calculateCartonCBM(l, w, h);
      setForm((prev) => ({
        ...prev,
        carton_length_cm: l,
        carton_width_cm: w,
        carton_height_cm: h,
        carton_cbm: cbm,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        carton_length_cm: l,
        carton_width_cm: w,
        carton_height_cm: h,
      }));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('sourcing_items')
        .update({
          factory_item_code: form.factory_item_code.trim() || null,
          internal_item_code: form.internal_item_code.trim() || null,
          factory_item_name_cn: form.factory_item_name_cn.trim() || null,
          item_name_en: form.item_name_en.trim() || null,
          description: form.description.trim() || null,
          price_cny: form.price_cny,
          pcs_per_carton: form.pcs_per_carton,
          carton_length_cm: form.carton_length_cm,
          carton_width_cm: form.carton_width_cm,
          carton_height_cm: form.carton_height_cm,
          carton_cbm: form.carton_cbm,
          carton_gross_weight_kg: form.carton_gross_weight_kg,
          material: form.material.trim() || null,
          notes: form.notes.trim() || null,
          erp_item_id: form.erp_item_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;
      setIsEditing(false);
      fetchItem();
    } catch (err) {
      console.error('Failed to update item:', err);
      alert('Error updating item.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="text-xs">Loading item specs...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Item Not Found</h2>
        <Link href="/items" className="text-xs font-semibold text-purple-600 hover:underline">
          &larr; Back to items catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        href="/items"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Sourced Items</span>
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-purple-500/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-mono font-black text-slate-900 tracking-tight">
                  {item.factory_item_code || 'Unnamed'}
                </h1>
                {item.internal_item_code && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    Internal: {item.internal_item_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.factory_item_name_cn} {item.item_name_en ? `• ${item.item_name_en}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all self-start sm:self-auto"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancel Editing' : 'Edit Specs'}</span>
          </button>
        </div>

        {/* View / Edit Mode */}
        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Factory Item Code</label>
                <input
                  type="text"
                  value={form.factory_item_code}
                  onChange={(e) => setForm({ ...form, factory_item_code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal SKU Code (e.g. BBC-5001)
                </label>
                <input
                  type="text"
                  value={form.internal_item_code}
                  onChange={(e) => setForm({ ...form, internal_item_code: e.target.value })}
                  placeholder="e.g. BBC-5001"
                  className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-mono font-bold text-amber-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chinese Name</label>
                <input
                  type="text"
                  value={form.factory_item_name_cn}
                  onChange={(e) => setForm({ ...form, factory_item_name_cn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">English Name</label>
                <input
                  type="text"
                  value={form.item_name_en}
                  onChange={(e) => setForm({ ...form, item_name_en: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price (RMB ¥)</label>
                <input
                  type="number"
                  step="any"
                  value={form.price_cny}
                  onChange={(e) => setForm({ ...form, price_cny: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pcs / Carton</label>
                <input
                  type="number"
                  value={form.pcs_per_carton}
                  onChange={(e) => setForm({ ...form, pcs_per_carton: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold"
                />
              </div>

              {/* Dimensions */}
              <div className="sm:col-span-2 p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="block text-xs font-bold text-purple-900 mb-2">Carton Dimensions (cm)</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">L (cm)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.carton_length_cm}
                      onChange={(e) =>
                        handleDimChange(
                          parseFloat(e.target.value) || 0,
                          form.carton_width_cm,
                          form.carton_height_cm
                        )
                      }
                      className="w-full px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">W (cm)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.carton_width_cm}
                      onChange={(e) =>
                        handleDimChange(
                          form.carton_length_cm,
                          parseFloat(e.target.value) || 0,
                          form.carton_height_cm
                        )
                      }
                      className="w-full px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">H (cm)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.carton_height_cm}
                      onChange={(e) =>
                        handleDimChange(
                          form.carton_length_cm,
                          form.carton_width_cm,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-2 py-1 bg-white border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-purple-700 font-bold">CBM / Ctn</label>
                    <input
                      type="number"
                      step="any"
                      value={form.carton_cbm}
                      onChange={(e) => setForm({ ...form, carton_cbm: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-purple-100 border border-purple-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-sm"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Product Photo */}
            <div className="space-y-3">
              <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-4">
                {item.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.primary_image_url}
                    alt="Product"
                    className="max-h-full max-w-full object-contain cursor-pointer"
                    onClick={() =>
                      setPreviewImage({
                        url: item.primary_image_url!,
                        title: item.factory_item_code || 'Product Photo',
                      })
                    }
                  />
                ) : (
                  <Package className="w-16 h-16 text-slate-300" />
                )}
              </div>
            </div>

            {/* Specs Summary */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Price RMB</span>
                  <strong className="text-base text-slate-900">{formatCNY(item.price_cny)}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Pcs / Carton</span>
                  <strong className="text-base text-slate-900">{item.pcs_per_carton}</strong>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                  <span className="text-purple-700 block text-[10px] font-semibold">CBM / Carton</span>
                  <strong className="text-base text-purple-950 font-mono">{item.carton_cbm}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Gross Weight</span>
                  <strong className="text-base text-slate-900">{item.carton_gross_weight_kg || '-'} kg</strong>
                </div>
              </div>

              {item.supplier && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Supplied By</span>
                    <strong className="text-slate-900 text-sm">{item.supplier.name}</strong>
                    <span className="text-slate-500 block">{item.supplier.shop_no || item.supplier.market_city}</span>
                  </div>
                  <Link
                    href={`/suppliers/${item.supplier.id}`}
                    className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>Supplier Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {item.erp_item && (
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-1">
                  <span className="text-blue-800 font-bold block flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Linked Warehouse ERP SKU</span>
                  </span>
                  <p className="text-blue-900 font-mono font-bold">{item.erp_item.code} — {item.erp_item.item_name}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
