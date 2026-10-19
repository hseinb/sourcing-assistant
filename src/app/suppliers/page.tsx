'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingSupplier } from '@/lib/types';

export type ChinaMarketCity =
  | 'Yiwu'
  | 'Guangzhou'
  | 'Shantou'
  | 'Foshan'
  | 'Shenzhen'
  | 'Ningbo'
  | 'Other';
import {
  Building2,
  Plus,
  Search,
  Phone,
  QrCode,
  CreditCard,
  Star,
  MapPin,
  Loader2,
  X,
  ExternalLink,
  Upload,
  Scan,
  Edit,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { ImageModal } from '@/components/ui/ImageModal';
import { saveImageLocally } from '@/lib/utils/imageCompressor';

const CITIES: ChinaMarketCity[] = [
  'Yiwu',
  'Guangzhou',
  'Shantou',
  'Foshan',
  'Shenzhen',
  'Ningbo',
  'Other',
];

export default function SuppliersDirectoryPage() {
  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  // Delete Supplier Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    supplier: SourcingSupplier | null;
  }>({
    isOpen: false,
    supplier: null,
  });
  const [deleting, setDeleting] = useState(false);

  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    shop_no: '',
    market_city: 'Yiwu' as ChinaMarketCity,
    contact_person: '',
    phone: '',
    wechat_id: '',
    wechat_qr_url: '',
    business_card_url: '',
    categories: '',
    rating: 5,
    payment_terms: '30% Deposit, 70% Balance before loading',
    bank_details: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [scanningCard, setScanningCard] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sourcing_suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers((data as SourcingSupplier[]) || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'qr' | 'card') => {
    const isQr = type === 'qr';
    if (isQr) setUploadingQr(true);
    else setUploadingCard(true);

    try {
      const safeCode = form.shop_no || form.name || 'supplier';
      const localUrl = await saveImageLocally(file, `${safeCode}_${type}`);

      if (localUrl) {
        if (isQr) {
          setForm((prev) => ({ ...prev, wechat_qr_url: localUrl }));
        } else {
          setForm((prev) => ({ ...prev, business_card_url: localUrl }));
        }
      }
    } catch (err) {
      console.error('Failed to save file locally:', err);
      alert('Failed to save photo to local AppPics.');
    } finally {
      if (isQr) setUploadingQr(false);
      else setUploadingCard(false);
    }
  };

  // Quick Add via Business Card Scan
  const handleScanCard = async (file: File) => {
    setScanningCard(true);
    try {
      const localUrl = await saveImageLocally(file, 'scanned_card');

      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setIsEditMode(false);
      setEditingSupplierId(null);
      setForm({
        name: `Supplier (${fileName})`,
        shop_no: 'Booth TBD',
        market_city: 'Yiwu',
        contact_person: '',
        phone: '',
        wechat_id: '',
        wechat_qr_url: '',
        business_card_url: localUrl || '',
        categories: 'Wholesale, General',
        rating: 5,
        payment_terms: '30% Deposit, 70% Balance before loading',
        bank_details: '',
        notes: 'Quickly logged via business card photo scan.',
      });
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error scanning card:', err);
      alert('Failed to scan business card.');
    } finally {
      setScanningCard(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingSupplierId(null);
    setForm({
      name: '',
      shop_no: '',
      market_city: 'Yiwu',
      contact_person: '',
      phone: '',
      wechat_id: '',
      wechat_qr_url: '',
      business_card_url: '',
      categories: '',
      rating: 5,
      payment_terms: '30% Deposit, 70% Balance before loading',
      bank_details: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: SourcingSupplier) => {
    setIsEditMode(true);
    setEditingSupplierId(supplier.id);
    setForm({
      name: supplier.name,
      shop_no: supplier.shop_no || '',
      market_city: (supplier.market_city as ChinaMarketCity) || 'Yiwu',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      wechat_id: supplier.wechat_id || '',
      wechat_qr_url: supplier.wechat_qr_url || '',
      business_card_url: supplier.business_card_url || '',
      categories: supplier.categories ? supplier.categories.join(', ') : '',
      rating: supplier.rating || 5,
      payment_terms: supplier.payment_terms || '30% Deposit, 70% Balance before loading',
      bank_details: supplier.bank_details || '',
      notes: supplier.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      const categoryArray = form.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        shop_no: form.shop_no.trim() || null,
        market_city: form.market_city || 'Yiwu',
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        wechat_id: form.wechat_id.trim() || null,
        wechat_qr_url: form.wechat_qr_url || null,
        business_card_url: form.business_card_url || null,
        categories: categoryArray,
        rating: Number(form.rating) || 5,
        payment_terms: form.payment_terms || null,
        bank_details: form.bank_details.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEditMode && editingSupplierId) {
        const { error } = await supabase
          .from('sourcing_suppliers')
          .update(payload)
          .eq('id', editingSupplierId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sourcing_suppliers')
          .insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert('Failed to save supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Supplier Handler with full cascade
  const handleExecuteDeleteSupplier = async () => {
    if (!deleteModal.supplier) return;
    setDeleting(true);
    try {
      const supplierId = deleteModal.supplier.id;

      // 1. Fetch PO IDs belonging to this supplier
      const { data: supplierPOs } = await supabase
        .from('sourcing_purchase_orders')
        .select('id')
        .eq('supplier_id', supplierId);

      const poIds = (supplierPOs || []).map((p) => p.id);

      // 2. Delete PO line items
      if (poIds.length > 0) {
        await supabase
          .from('sourcing_purchase_order_items')
          .delete()
          .in('po_id', poIds);
      }

      // 3. Delete Purchase Orders
      await supabase
        .from('sourcing_purchase_orders')
        .delete()
        .eq('supplier_id', supplierId);

      // 4. Delete Sourced Items
      await supabase
        .from('sourcing_items')
        .delete()
        .eq('supplier_id', supplierId);

      // 5. Delete Ledger Entries
      await supabase
        .from('sourcing_supplier_ledger')
        .delete()
        .eq('supplier_id', supplierId);

      // 6. Delete Supplier record
      const { error } = await supabase
        .from('sourcing_suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;

      setDeleteModal({ isOpen: false, supplier: null });
      fetchSuppliers();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      alert('Failed to delete supplier.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesCity = selectedCity === 'All' || s.market_city === selectedCity;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(q) ||
      (s.shop_no && s.shop_no.toLowerCase().includes(q)) ||
      (s.wechat_id && s.wechat_id.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.categories && s.categories.some((c) => c.toLowerCase().includes(q)));

    return matchesCity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span>Suppliers & Wholesale Shops</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Directory of Chinese wholesale market booths (Yiwu, Guangzhou, Shantou) and direct factories.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Quick Add by Scanning Business Card */}
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer">
            <Scan className="w-3.5 h-3.5 text-amber-600" />
            <span>{scanningCard ? 'Saving Card...' : 'Scan Business Card'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanCard(file);
              }}
            />
          </label>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier name, shop # (e.g. F3-16901), WeChat, city..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* City Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCity('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCity === 'All'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Cities ({suppliers.length})
          </button>
          {CITIES.map((city) => {
            const count = suppliers.filter((s) => s.market_city === city).length;
            if (count === 0 && city !== 'Yiwu' && city !== 'Guangzhou') return null;
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCity === city
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {city} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">Loading wholesale suppliers...</span>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">No suppliers found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Add a new Chinese wholesale market vendor, factory, or scan a business card to get started.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Add First Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 line-clamp-1">{supplier.name}</h3>
                    {supplier.shop_no ? (
                      <div className="flex items-center gap-1 text-xs text-amber-800 font-semibold mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{supplier.shop_no}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mt-0.5">{supplier.market_city || 'China'}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(supplier)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      title="Edit Supplier"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, supplier })}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                      title="Delete Supplier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 shrink-0 border border-slate-200">
                      {supplier.market_city || 'Yiwu'}
                    </span>
                  </div>
                </div>

                {/* Contact Badges */}
                <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-1">
                  {supplier.wechat_id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 font-medium">
                      <span className="font-bold text-emerald-800">WeChat:</span> {supplier.wechat_id}
                    </span>
                  )}
                  {supplier.phone && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md border border-slate-200 font-medium">
                      <Phone className="w-3 h-3 text-slate-400" /> {supplier.phone}
                    </span>
                  )}
                </div>

                {/* Categories */}
                {supplier.categories && supplier.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {supplier.categories.map((cat, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* QR & Card Thumbnails */}
                <div className="flex items-center gap-3 pt-2">
                  {supplier.wechat_qr_url && (
                    <button
                      onClick={() =>
                        setPreviewImage({ url: supplier.wechat_qr_url!, title: `${supplier.name} - WeChat QR` })
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>WeChat QR</span>
                    </button>
                  )}
                  {supplier.business_card_url && (
                    <button
                      onClick={() =>
                        setPreviewImage({
                          url: supplier.business_card_url!,
                          title: `${supplier.name} - Business Card`,
                        })
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Business Card</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500 text-xs">
                  {Array.from({ length: supplier.rating || 5 }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <Link
                  href={`/suppliers/${supplier.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Open Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.supplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Supplier?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <strong className="block font-bold text-slate-900">{deleteModal.supplier.name}</strong>
              {deleteModal.supplier.shop_no && (
                <span className="text-slate-500 block">Shop: {deleteModal.supplier.shop_no}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, supplier: null })}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteSupplier}
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

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 my-8">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {isEditMode ? 'Edit Chinese Supplier Profile' : 'Add Chinese Wholesale Supplier'}
                </h3>
                <p className="text-xs text-slate-500">
                  Save booth number, WeChat contact, payment terms, and local photos.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier / Factory Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yiwu Hufa Stainless Steel Co., Ltd."
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Shop Number (e.g. F3-16901) */}
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Shop / Booth No. (e.g. F3-16901)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. F3-16901 / District 2"
                    value={form.shop_no}
                    onChange={(e) => setForm({ ...form, shop_no: e.target.value })}
                    className="w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-950"
                  />
                </div>

                {/* Market City */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Market City</label>
                  <select
                    value={form.market_city}
                    onChange={(e) =>
                      setForm({ ...form, market_city: e.target.value as ChinaMarketCity })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Manager Wang (王经理)"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="e.g. +86 138 0000 0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                {/* WeChat ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WeChat ID</label>
                  <input
                    type="text"
                    placeholder="e.g. hufachina"
                    value={form.wechat_id}
                    onChange={(e) => setForm({ ...form, wechat_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-800"
                  />
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vendor Rating (1-5)</label>
                  <select
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value={5}>5 Stars (Excellent)</option>
                    <option value={4}>4 Stars (Good)</option>
                    <option value={3}>3 Stars (Average)</option>
                    <option value={2}>2 Stars (Caution)</option>
                    <option value={1}>1 Star (Poor)</option>
                  </select>
                </div>

                {/* Categories */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Categories (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chafing Dish, Buffetware, Stainless Steel"
                    value={form.categories}
                    onChange={(e) => setForm({ ...form, categories: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* File Uploads (WeChat QR & Business Card) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WeChat QR Code (Local WebP)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl cursor-pointer text-xs font-bold border border-emerald-200">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{uploadingQr ? 'Saving...' : 'Upload QR'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'qr');
                        }}
                      />
                    </label>
                    {form.wechat_qr_url && (
                      <span className="text-[11px] text-emerald-600 font-bold">✓ Attached</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business Card Photo (Local WebP)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-xl cursor-pointer text-xs font-bold border border-blue-200">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{uploadingCard ? 'Saving...' : 'Upload Card'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'card');
                        }}
                      />
                    </label>
                    {form.business_card_url && (
                      <span className="text-[11px] text-blue-600 font-bold">✓ Attached</span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Address</label>
                  <textarea
                    rows={2}
                    placeholder="Showroom location, factory address, bank info..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : isEditMode ? 'Update Supplier' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
