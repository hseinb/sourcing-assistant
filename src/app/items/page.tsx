'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingItem, SourcingSupplier, ERPItem } from '@/lib/types';
import {
  Package,
  Plus,
  Search,
  Building2,
  Boxes,
  Loader2,
  X,
  ExternalLink,
  Camera,
  Layers,
  Sparkles,
  DollarSign,
  Trash2,
  Edit,
  CheckSquare,
  Square,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, calculateCartonCBM } from '@/lib/utils/formatters';
import { ERPItemPickerModal } from '@/components/ui/ERPItemPickerModal';
import { ImageModal } from '@/components/ui/ImageModal';
import { RapidMarketCaptureModal } from '@/components/items/RapidMarketCaptureModal';
import { saveImageLocally } from '@/lib/utils/imageCompressor';

export default function SourcedItemsCatalogPage() {
  const [items, setItems] = useState<SourcingItem[]>([]);
  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('All');

  // Multi-Selection State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemIds: string[];
    itemNames: string[];
    isBulk: boolean;
  }>({
    isOpen: false,
    itemIds: [],
    itemNames: [],
    isBulk: false,
  });
  const [deleting, setDeleting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isERPPickerOpen, setIsERPPickerOpen] = useState(false);
  const [isRapidModalOpen, setIsRapidModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Form State
  const [form, setForm] = useState({
    supplier_id: '',
    erp_item_id: null as number | null,
    internal_item_code: '',
    factory_item_code: '',
    factory_item_name_cn: '',
    item_name_en: '',
    description: '',
    primary_image_url: '',
    price_cny: '',
    price_usd: '',
    pcs_per_carton: '24',
    carton_length_cm: '',
    carton_width_cm: '',
    carton_height_cm: '',
    carton_cbm: '0.05',
    carton_gross_weight_kg: '10',
    moq: '100',
    material: '',
    notes: '',
  });
  const [linkedERPItem, setLinkedERPItem] = useState<ERPItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Sourced Items
      const { data: iData, error: iErr } = await supabase
        .from('sourcing_items')
        .select('*, supplier:sourcing_suppliers(*), erp_item:tbl_items(*)')
        .order('created_at', { ascending: false });
      if (iErr) throw iErr;
      setItems((iData as SourcingItem[]) || []);

      // 2. Fetch Suppliers
      const { data: sData } = await supabase.from('sourcing_suppliers').select('*').order('name');
      setSuppliers((sData as SourcingSupplier[]) || []);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate CBM on dimension change
  const handleDimChange = (l: string, w: string, h: string) => {
    const length = parseFloat(l) || 0;
    const width = parseFloat(w) || 0;
    const height = parseFloat(h) || 0;

    if (length > 0 && width > 0 && height > 0) {
      const calculatedCBM = calculateCartonCBM(length, width, height);
      setForm((prev) => ({
        ...prev,
        carton_length_cm: l,
        carton_width_cm: w,
        carton_height_cm: h,
        carton_cbm: String(calculatedCBM),
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

  // Save image directly to local folder (C:\Users\hussi\Desktop\China\AppPics) as WebP
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const code = form.internal_item_code || form.factory_item_code || 'item';
      const localUrl = await saveImageLocally(file, code);
      if (localUrl) {
        setForm((prev) => ({ ...prev, primary_image_url: localUrl }));
      }
    } catch (err) {
      console.error('Failed to save image locally:', err);
      alert('Failed to save item photo to local AppPics.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingItemId(null);
    setLinkedERPItem(null);
    setForm({
      supplier_id: '',
      erp_item_id: null,
      internal_item_code: '',
      factory_item_code: '',
      factory_item_name_cn: '',
      item_name_en: '',
      description: '',
      primary_image_url: '',
      price_cny: '',
      price_usd: '',
      pcs_per_carton: '24',
      carton_length_cm: '',
      carton_width_cm: '',
      carton_height_cm: '',
      carton_cbm: '0.05',
      carton_gross_weight_kg: '10',
      moq: '100',
      material: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: SourcingItem) => {
    setIsEditMode(true);
    setEditingItemId(item.id);
    setLinkedERPItem(item.erp_item || null);
    setForm({
      supplier_id: item.supplier_id || '',
      erp_item_id: item.erp_item_id,
      internal_item_code: item.internal_item_code || '',
      factory_item_code: item.factory_item_code || '',
      factory_item_name_cn: item.factory_item_name_cn || '',
      item_name_en: item.item_name_en || '',
      description: item.description || '',
      primary_image_url: item.primary_image_url || '',
      price_cny: item.price_cny ? String(item.price_cny) : '',
      price_usd: item.price_usd ? String(item.price_usd) : '',
      pcs_per_carton: item.pcs_per_carton ? String(item.pcs_per_carton) : '24',
      carton_length_cm: item.carton_length_cm ? String(item.carton_length_cm) : '',
      carton_width_cm: item.carton_width_cm ? String(item.carton_width_cm) : '',
      carton_height_cm: item.carton_height_cm ? String(item.carton_height_cm) : '',
      carton_cbm: item.carton_cbm ? String(item.carton_cbm) : '0.05',
      carton_gross_weight_kg: item.carton_gross_weight_kg ? String(item.carton_gross_weight_kg) : '10',
      moq: item.moq ? String(item.moq) : '100',
      material: item.material || '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSelectERPItem = (erp: ERPItem) => {
    setLinkedERPItem(erp);
    setForm((prev) => ({
      ...prev,
      erp_item_id: erp.item_id,
      internal_item_code: prev.internal_item_code || erp.code || '',
      item_name_en: prev.item_name_en || erp.item_name || '',
      material: prev.material || erp.material || '',
      description: prev.description || erp.description || '',
    }));
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        supplier_id: form.supplier_id || null,
        erp_item_id: form.erp_item_id || null,
        internal_item_code: form.internal_item_code || null,
        factory_item_code: form.factory_item_code || null,
        factory_item_name_cn: form.factory_item_name_cn || null,
        item_name_en: form.item_name_en || null,
        description: form.description || null,
        primary_image_url: form.primary_image_url || null,
        price_cny: parseFloat(form.price_cny) || 0,
        price_usd: parseFloat(form.price_usd) || null,
        pcs_per_carton: parseInt(form.pcs_per_carton, 10) || 1,
        carton_length_cm: parseFloat(form.carton_length_cm) || null,
        carton_width_cm: parseFloat(form.carton_width_cm) || null,
        carton_height_cm: parseFloat(form.carton_height_cm) || null,
        carton_cbm: parseFloat(form.carton_cbm) || 0.05,
        carton_gross_weight_kg: parseFloat(form.carton_gross_weight_kg) || 10,
        moq: parseInt(form.moq, 10) || 1,
        material: form.material || null,
        notes: form.notes || null,
      };

      if (isEditMode && editingItemId) {
        const { error } = await supabase
          .from('sourcing_items')
          .update(payload)
          .eq('id', editingItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sourcing_items').insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving item:', err);
      alert('Failed to save item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Multi-select handlers
  const handleToggleSelect = (id: string) => {
    const updated = new Set(selectedItemIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedItemIds(updated);
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Single Item Delete Confirmation Prompt
  const handlePromptDeleteSingle = (item: SourcingItem) => {
    setDeleteModal({
      isOpen: true,
      itemIds: [item.id],
      itemNames: [item.factory_item_code || item.internal_item_code || 'Product'],
      isBulk: false,
    });
  };

  // Bulk Delete Confirmation Prompt
  const handlePromptDeleteBulk = () => {
    if (selectedItemIds.size === 0) return;
    const names = items
      .filter((i) => selectedItemIds.has(i.id))
      .map((i) => i.factory_item_code || i.internal_item_code || 'Item');
    setDeleteModal({
      isOpen: true,
      itemIds: Array.from(selectedItemIds),
      itemNames: names,
      isBulk: true,
    });
  };

  // Execute Confirmed Deletion
  const handleExecuteDelete = async () => {
    if (deleteModal.itemIds.length === 0) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sourcing_items')
        .delete()
        .in('id', deleteModal.itemIds);

      if (error) throw error;

      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        deleteModal.itemIds.forEach((id) => next.delete(id));
        return next;
      });

      setDeleteModal({ isOpen: false, itemIds: [], itemNames: [], isBulk: false });
      fetchData();
    } catch (err) {
      console.error('Error deleting items:', err);
      alert('Failed to delete item(s).');
    } finally {
      setDeleting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSupplier =
      selectedSupplierFilter === 'All' || item.supplier_id === selectedSupplierFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (item.factory_item_code && item.factory_item_code.toLowerCase().includes(q)) ||
      (item.internal_item_code && item.internal_item_code.toLowerCase().includes(q)) ||
      (item.factory_item_name_cn && item.factory_item_name_cn.toLowerCase().includes(q)) ||
      (item.item_name_en && item.item_name_en.toLowerCase().includes(q)) ||
      (item.supplier?.name && item.supplier.name.toLowerCase().includes(q)) ||
      (item.erp_item?.code && item.erp_item.code.toLowerCase().includes(q));

    return matchesSupplier && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-600" />
            <span>Sourced Items & Packaging Specs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Master catalog of products sourced in China, packaging carton CBM, prices in RMB, and local WebP images.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRapidModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-xs hover:brightness-105 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Walking Mode</span>
          </button>

          <Link
            href="/excel/import"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold transition-all"
          >
            <span>Import from Excel</span>
          </Link>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sourced Item</span>
          </button>
        </div>
      </div>

      {/* Filter, Search, and Select All Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:max-w-md">
          {/* Select All Toggle Button */}
          {filteredItems.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              title="Select / Deselect All Items"
            >
              {selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">Select All</span>
            </button>
          )}

          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by factory code, internal code (BBC-5001), Chinese name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Supplier Filter */}
        <div className="w-full md:w-auto">
          <select
            value={selectedSupplierFilter}
            onChange={(e) => setSelectedSupplierFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
          >
            <option value="All">All Suppliers ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.shop_no ? `(${s.shop_no})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-bold text-slate-200">
            {selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'items'} selected
          </span>

          <div className="h-4 w-px bg-slate-700" />

          <button
            type="button"
            onClick={handlePromptDeleteBulk}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected ({selectedItemIds.size})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedItemIds(new Set())}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Items Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-xs">Loading items catalog...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">No items found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Catalog a new product from Chinese factories or import a supplier spreadsheet with photos.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isSelected = selectedItemIds.has(item.id);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative ${
                  isSelected ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div>
                  {/* Photo Header */}
                  <div className="relative h-44 bg-slate-100 border-b border-slate-100 flex items-center justify-center overflow-hidden group">
                    {/* Checkbox Selector */}
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(item.id)}
                      className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-white/90 shadow-sm border hover:bg-white text-purple-600 transition-colors"
                      title="Select Item"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {item.primary_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.primary_image_url}
                        alt="Product"
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform cursor-pointer"
                        onClick={() =>
                          setPreviewImage({
                            url: item.primary_image_url!,
                            title: `${item.factory_item_code || 'Item'} - ${item.factory_item_name_cn || ''}`,
                          })
                        }
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300 gap-1">
                        <Package className="w-10 h-10" />
                        <span className="text-[10px] text-slate-400">No Photo</span>
                      </div>
                    )}

                    {/* Linked ERP Badge */}
                    {item.erp_item_id && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600/90 text-white backdrop-blur-xs rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5" />
                        <span>ERP Linked</span>
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-mono font-black text-sm text-slate-900">
                          {item.factory_item_code || 'NO-CODE'}
                        </h3>
                        <p className="text-xs text-slate-700 font-medium line-clamp-1">
                          {item.factory_item_name_cn || item.item_name_en || 'Unnamed Product'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1 text-slate-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                          title="Edit Item"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePromptDeleteSingle(item)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Internal SKU */}
                    {item.internal_item_code && (
                      <span className="inline-block text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                        Internal: {item.internal_item_code}
                      </span>
                    )}

                    {/* Price & CBM Grid */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2.5 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Price</span>
                        <strong className="text-slate-900">{formatCNY(item.price_cny)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Pcs/Ctn</span>
                        <strong className="text-slate-900">{item.pcs_per_carton}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">CBM/Ctn</span>
                        <strong className="text-slate-900 font-mono">{item.carton_cbm}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action footer */}
                <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 font-mono">
                    GW: {item.carton_gross_weight_kg || '-'} kg
                  </span>
                  <Link
                    href={`/items/${item.id}`}
                    className="font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <span>Specs</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {deleteModal.isBulk
                    ? `Delete ${deleteModal.itemIds.length} Sourced Items?`
                    : 'Delete Sourced Item?'}
                </h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 max-h-36 overflow-y-auto space-y-1">
              <span className="font-bold text-slate-900 block mb-1">Items to be removed:</span>
              {deleteModal.itemNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                  <span>•</span>
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, itemIds: [], itemNames: [], isBulk: false })}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Sourced Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {isEditMode ? 'Edit Sourced Item' : 'Catalog Sourced Item & Carton Specs'}
                </h3>
                <p className="text-xs text-slate-500">
                  New item from Chinese market / factory with CBM volume calculator and local WebP photo storage.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Chinese Supplier */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chinese Supplier</label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
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

                {/* Optional Warehouse ERP Link */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link to Warehouse ERP (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsERPPickerOpen(true)}
                    className="w-full px-3 py-2 bg-blue-50/60 border border-blue-200 hover:bg-blue-100/60 rounded-xl text-xs font-bold text-blue-800 flex items-center justify-between"
                  >
                    <span className="truncate">
                      {linkedERPItem ? `Linked: ${linkedERPItem.code}` : 'Select Warehouse ERP Item...'}
                    </span>
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Codes Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Factory Item Code (Vendor Model) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HFHX-CL020"
                    value={form.factory_item_code}
                    onChange={(e) => setForm({ ...form, factory_item_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Our Internal Item Code (e.g. BBC-5001)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BBC-5001"
                    value={form.internal_item_code}
                    onChange={(e) => setForm({ ...form, internal_item_code: e.target.value })}
                    className="w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-950"
                  />
                </div>
              </div>

              {/* Product Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chinese Name (中文名)</label>
                  <input
                    type="text"
                    placeholder="e.g. 长方形大透视金色餐炉"
                    value={form.factory_item_name_cn}
                    onChange={(e) => setForm({ ...form, factory_item_name_cn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">English Name / Spec</label>
                  <input
                    type="text"
                    placeholder="e.g. Rectangular Chafing Dish Gold 9L"
                    value={form.item_name_en}
                    onChange={(e) => setForm({ ...form, item_name_en: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* Pricing & Packaging */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (RMB ¥) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="261.00"
                    value={form.price_cny}
                    onChange={(e) => setForm({ ...form, price_cny: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (USD $)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="36.50"
                    value={form.price_usd}
                    onChange={(e) => setForm({ ...form, price_usd: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pcs Per Carton *</label>
                  <input
                    type="number"
                    required
                    placeholder="24"
                    value={form.pcs_per_carton}
                    onChange={(e) => setForm({ ...form, pcs_per_carton: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">MOQ</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={form.moq}
                    onChange={(e) => setForm({ ...form, moq: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Carton Dimensions & Calculated CBM */}
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-purple-600" />
                    <span>Carton Volume & Dimensions</span>
                  </span>
                  <span className="text-[11px] text-purple-700 font-mono">
                    Auto-calculates Carton CBM = (L×W×H)/1,000,000
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 mb-1">Length (cm)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="60"
                      value={form.carton_length_cm}
                      onChange={(e) =>
                        handleDimChange(e.target.value, form.carton_width_cm, form.carton_height_cm)
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 mb-1">Width (cm)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="40"
                      value={form.carton_width_cm}
                      onChange={(e) =>
                        handleDimChange(form.carton_length_cm, e.target.value, form.carton_height_cm)
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="35"
                      value={form.carton_height_cm}
                      onChange={(e) =>
                        handleDimChange(form.carton_length_cm, form.carton_width_cm, e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 mb-1">Carton CBM (m³)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={form.carton_cbm}
                      onChange={(e) => setForm({ ...form, carton_cbm: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-mono font-bold text-purple-950"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Product Image (Saved to C:\Users\hussi\Desktop\China\AppPics)
                </label>
                <div className="flex items-center gap-3">
                  {form.primary_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.primary_image_url}
                      alt="Preview"
                      className="w-16 h-16 object-contain rounded-xl border p-1 bg-white"
                    />
                  ) : null}

                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-colors">
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span>{uploadingImage ? 'Saving WebP...' : 'Choose or Take Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEditMode ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rapid Market Capture Modal */}
      <RapidMarketCaptureModal
        isOpen={isRapidModalOpen}
        onClose={() => setIsRapidModalOpen(false)}
        onItemSaved={() => fetchData()}
      />

      {/* ERP Item Picker */}
      <ERPItemPickerModal
        isOpen={isERPPickerOpen}
        onClose={() => setIsERPPickerOpen(false)}
        onSelect={handleSelectERPItem}
      />

      {/* Image Preview Modal */}
      <ImageModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
      />
    </div>
  );
}
