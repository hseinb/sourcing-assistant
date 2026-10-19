'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  SourcingSupplier,
  SourcingItem,
  SourcingPurchaseOrder,
  SourcingLedgerEntry,
} from '@/lib/types';
import {
  Building2,
  Package,
  ShoppingCart,
  BookOpen,
  MapPin,
  Phone,
  QrCode,
  CreditCard,
  Star,
  Plus,
  ArrowLeft,
  Loader2,
  ExternalLink,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Edit,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  X,
  Camera,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate } from '@/lib/utils/formatters';
import { POStatusBadge, LedgerTypeBadge } from '@/components/ui/Badge';
import { ImageModal } from '@/components/ui/ImageModal';
import { recalculatePOPaidAmounts } from '@/lib/ledger/syncLedger';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<SourcingSupplier | null>(null);
  const [items, setItems] = useState<SourcingItem[]>([]);
  const [orders, setOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [ledger, setLedger] = useState<SourcingLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'orders' | 'ledger' | 'contacts'>('items');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Selected items for PO creation
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Financial totals
  const [financials, setFinancials] = useState({
    totalInvoicedCny: 0,
    totalPaidCny: 0,
    balanceOwedCny: 0,
  });

  // Edit Supplier Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
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
    payment_terms: '',
    bank_details: '',
    notes: '',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Supplier State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // New Ledger Entry Modal state
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({
    po_id: '',
    entry_type: 'Debit - Deposit',
    amount_cny: '',
    payment_method: 'WeChat Pay',
    reference_no: '',
    notes: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [submittingLedger, setSubmittingLedger] = useState(false);

  // Delete PO Modal State in Supplier Page
  const [deletePOModal, setDeletePOModal] = useState<{
    isOpen: boolean;
    po: SourcingPurchaseOrder | null;
  }>({
    isOpen: false,
    po: null,
  });
  const [deletingPO, setDeletingPO] = useState(false);

  // Cascade Delete Supplier Handler
  const handleDeleteSupplier = async () => {
    if (!supplier) return;
    setDeletingSupplier(true);
    try {
      // 1. Fetch PO IDs belonging to this supplier
      const { data: supplierPOs } = await supabase
        .from('sourcing_purchase_orders')
        .select('id')
        .eq('supplier_id', supplier.id);

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
        .eq('supplier_id', supplier.id);

      // 4. Delete Sourced Items
      await supabase
        .from('sourcing_items')
        .delete()
        .eq('supplier_id', supplier.id);

      // 5. Delete Ledger Entries
      await supabase
        .from('sourcing_supplier_ledger')
        .delete()
        .eq('supplier_id', supplier.id);

      // 6. Delete Supplier record
      const { error } = await supabase
        .from('sourcing_suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;
      router.push('/suppliers');
    } catch (err) {
      console.error('Error deleting supplier:', err);
      alert('Failed to delete supplier.');
    } finally {
      setDeletingSupplier(false);
    }
  };

  // Delete Single PO Handler from Supplier Tab
  const handleDeletePO = async () => {
    if (!deletePOModal.po) return;
    setDeletingPO(true);
    try {
      // 1. Delete PO line items
      await supabase
        .from('sourcing_purchase_order_items')
        .delete()
        .eq('po_id', deletePOModal.po.id);

      // 2. Delete PO
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .delete()
        .eq('id', deletePOModal.po.id);

      if (error) throw error;

      setDeletePOModal({ isOpen: false, po: null });
      fetchSupplierData();
    } catch (err) {
      console.error('Error deleting purchase order:', err);
      alert('Failed to delete purchase order.');
    } finally {
      setDeletingPO(false);
    }
  };

  useEffect(() => {
    if (supplierId) fetchSupplierData();
  }, [supplierId]);

  const fetchSupplierData = async () => {
    setLoading(true);
    try {
      // 1. Supplier details
      const { data: supplierData, error: sErr } = await supabase
        .from('sourcing_suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      if (sErr) throw sErr;
      const s = supplierData as SourcingSupplier;
      setSupplier(s);

      setEditForm({
        name: s.name,
        shop_no: s.shop_no || '',
        market_city: s.market_city || 'Yiwu',
        contact_person: s.contact_person || '',
        phone: s.phone || '',
        wechat_id: s.wechat_id || '',
        wechat_qr_url: s.wechat_qr_url || '',
        business_card_url: s.business_card_url || '',
        categories: (s.categories || []).join(', '),
        rating: s.rating || 5,
        payment_terms: s.payment_terms || '',
        bank_details: s.bank_details || '',
        notes: s.notes || '',
      });

      // 2. Sourced items
      const { data: itemsData } = await supabase
        .from('sourcing_items')
        .select('*, erp_item:tbl_items(*)')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      setItems((itemsData as SourcingItem[]) || []);

      // 3. Purchase orders
      const { data: ordersData } = await supabase
        .from('sourcing_purchase_orders')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      setOrders((ordersData as SourcingPurchaseOrder[]) || []);

      // 4. Ledger
      const { data: ledgerData } = await supabase
        .from('sourcing_supplier_ledger')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false });
      const ledgerList = (ledgerData as SourcingLedgerEntry[]) || [];
      setLedger(ledgerList);

      // Calculate totals
      let totalInv = 0;
      let totalPaid = 0;
      ledgerList.forEach((e) => {
        const amt = Number(e.amount_cny || 0);
        if (e.entry_type.startsWith('Credit')) totalInv += amt;
        else if (e.entry_type.startsWith('Debit')) totalPaid += amt;
      });
      setFinancials({
        totalInvoicedCny: totalInv,
        totalPaidCny: totalPaid,
        balanceOwedCny: Math.max(0, totalInv - totalPaid),
      });
    } catch (err) {
      console.error('Error loading supplier profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      const categoryArray = editForm.categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('sourcing_suppliers')
        .update({
          name: editForm.name.trim(),
          shop_no: editForm.shop_no.trim() || null,
          market_city: editForm.market_city,
          contact_person: editForm.contact_person.trim() || null,
          phone: editForm.phone.trim() || null,
          wechat_id: editForm.wechat_id.trim() || null,
          wechat_qr_url: editForm.wechat_qr_url || null,
          business_card_url: editForm.business_card_url || null,
          categories: categoryArray,
          rating: Number(editForm.rating) || 5,
          payment_terms: editForm.payment_terms || null,
          bank_details: editForm.bank_details.trim() || null,
          notes: editForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supplierId);

      if (error) throw error;
      setIsEditModalOpen(false);
      fetchSupplierData();
    } catch (err) {
      console.error('Error updating supplier:', err);
      alert('Failed to update supplier.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter((item) => item !== id));
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i) => i.id));
    }
  };

  const handleCreatePOFromSelected = () => {
    if (selectedItemIds.length === 0) {
      router.push(`/orders/new?supplier_id=${supplierId}`);
      return;
    }
    const itemIdsParam = selectedItemIds.join(',');
    router.push(`/orders/new?supplier_id=${supplierId}&item_ids=${itemIdsParam}`);
  };

  const handleCreateLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(ledgerForm.amount_cny);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSubmittingLedger(true);
    try {
      const selectedPOId = ledgerForm.po_id || null;
      const { error } = await supabase.from('sourcing_supplier_ledger').insert({
        supplier_id: supplierId,
        po_id: selectedPOId,
        entry_type: ledgerForm.entry_type,
        amount_cny: amt,
        payment_method: ledgerForm.payment_method,
        reference_no: ledgerForm.reference_no.trim() || null,
        notes: ledgerForm.notes.trim() || null,
        transaction_date: ledgerForm.transaction_date,
      });

      if (error) throw error;

      // If linked to a PO, recalculate the PO's deposit_paid, balance_due and status
      if (selectedPOId) {
        await recalculatePOPaidAmounts(selectedPOId);
      }

      setIsLedgerModalOpen(false);
      setLedgerForm({
        po_id: '',
        entry_type: 'Debit - Deposit',
        amount_cny: '',
        payment_method: 'WeChat Pay',
        reference_no: '',
        notes: '',
        transaction_date: new Date().toISOString().slice(0, 10),
      });
      fetchSupplierData();
    } catch (err) {
      console.error('Failed to create ledger entry:', err);
      alert('Error recording transaction.');
    } finally {
      setSubmittingLedger(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs">Loading supplier profile...</span>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Supplier Not Found</h2>
        <Link href="/suppliers" className="text-xs font-semibold text-blue-600 hover:underline">
          &larr; Back to suppliers directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Suppliers</span>
      </Link>

      {/* Supplier Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                {supplier.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{supplier.name}</h1>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Edit Supplier Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {supplier.market_city || 'Yiwu'}
                  </span>
                  {supplier.shop_no && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <MapPin className="w-3 h-3 text-amber-600" />
                      {supplier.shop_no}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact details */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
              {supplier.contact_person && (
                <span>Contact: <strong className="text-slate-800">{supplier.contact_person}</strong></span>
              )}
              {supplier.phone && (
                <span>Phone: <strong className="text-slate-800">{supplier.phone}</strong></span>
              )}
              {supplier.wechat_id && (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-medium">
                  WeChat: <strong>{supplier.wechat_id}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCreatePOFromSelected}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>
                {selectedItemIds.length > 0
                  ? `Create PO (${selectedItemIds.length} items)`
                  : 'Create PO'}
              </span>
            </button>
            <button
              onClick={() => setIsLedgerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Rollups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl">
            <span className="text-xs text-slate-500 block font-medium">Total Invoiced (Goods)</span>
            <span className="text-lg font-black text-slate-900">{formatCNY(financials.totalInvoicedCny)}</span>
          </div>
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-xs text-emerald-700 block font-medium">Total Paid / Deposits</span>
            <span className="text-lg font-black text-emerald-700">{formatCNY(financials.totalPaidCny)}</span>
          </div>
          <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100">
            <span className="text-xs text-rose-700 block font-medium">Outstanding Balance Owed</span>
            <span className="text-lg font-black text-rose-600">{formatCNY(financials.balanceOwedCny)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'items'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Sourced Items ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Purchase Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Financial Ledger ({ledger.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'contacts'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>WeChat & Cards</span>
        </button>
      </div>

      {/* Tab 1: Sourced Items */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600"
              >
                {selectedItemIds.length === items.length && items.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({items.length})</span>
              </button>
              {selectedItemIds.length > 0 && (
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {selectedItemIds.length} items selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreatePOFromSelected}
                disabled={selectedItemIds.length === 0}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Create PO from Selected ({selectedItemIds.length})</span>
              </button>

              <Link
                href={`/items?supplier_id=${supplier.id}`}
                className="text-xs font-bold text-purple-600 hover:underline"
              >
                + Add New Item
              </Link>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400">
              No items cataloged for this supplier yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleItemSelection(item.id)}
                          className="pt-1 text-slate-400 hover:text-blue-600 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>

                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                          {item.primary_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.primary_image_url}
                              alt="Item"
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setPreviewImage({ url: item.primary_image_url!, title: item.factory_item_code || 'Item' })}
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm truncate block">
                            {item.factory_item_code || 'No Code'}
                          </span>
                          <p className="text-xs text-slate-700 truncate">{item.factory_item_name_cn || item.item_name_en || 'Unnamed'}</p>
                          {item.internal_item_code && (
                            <span className="text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono font-bold mt-0.5 inline-block">
                              Code: {item.internal_item_code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Packaging specs */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-xl text-[11px] text-slate-600 text-center">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Price</span>
                          <strong className="text-slate-900">{formatCNY(item.price_cny)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Pcs/Ctn</span>
                          <strong className="text-slate-900">{item.pcs_per_carton}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">CBM/Ctn</span>
                          <strong className="text-slate-900">{item.carton_cbm}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => toggleItemSelection(item.id)}
                        className="font-semibold text-blue-600 hover:underline text-[11px]"
                      >
                        {isSelected ? 'Deselect' : 'Select for PO'}
                      </button>
                      <Link
                        href={`/items/${item.id}`}
                        className="font-semibold text-slate-600 hover:text-slate-900"
                      >
                        View Specs &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Purchase Orders */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No purchase orders created for this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Cartons / CBM</th>
                    <th className="py-3 px-4">Total Value</th>
                    <th className="py-3 px-4">Deposit Paid</th>
                    <th className="py-3 px-4">Delivery Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{po.po_number}</td>
                      <td className="py-3 px-4"><POStatusBadge status={po.status} /></td>
                      <td className="py-3 px-4 text-slate-600">{po.total_cartons} ctns • {po.total_cbm.toFixed(2)} CBM</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{formatCNY(po.total_amount_cny)}</td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">{formatCNY(po.deposit_paid_cny)}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(po.warehouse_delivery_date)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/orders/${po.id}`} className="text-blue-600 font-semibold hover:underline">
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeletePOModal({ isOpen: true, po })}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Delete PO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Account Statement (Debit / Credit)</h3>
            <button
              onClick={() => setIsLedgerModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
            >
              + Record Payment / Invoice
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {ledger.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No financial transactions recorded for this supplier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Reference #</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Amount (RMB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">{formatDate(entry.transaction_date)}</td>
                        <td className="py-3 px-4"><LedgerTypeBadge type={entry.entry_type} /></td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{entry.payment_method || '-'}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{entry.reference_no || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{entry.notes || '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {entry.entry_type.startsWith('Credit') ? '+' : '-'}{formatCNY(entry.amount_cny)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Contacts & Cards */}
      {activeTab === 'contacts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>WeChat QR Code</span>
            </h4>
            {supplier.wechat_qr_url ? (
              <div className="p-4 bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={supplier.wechat_qr_url}
                  alt="WeChat QR"
                  className="max-h-64 object-contain rounded-lg cursor-pointer shadow-xs"
                  onClick={() => setPreviewImage({ url: supplier.wechat_qr_url!, title: `${supplier.name} - WeChat QR` })}
                />
                <span className="text-[11px] text-slate-400 mt-2">Click image to zoom</span>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-xl">
                No WeChat QR code uploaded.
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Business Card / Shop Card</span>
            </h4>
            {supplier.business_card_url ? (
              <div className="p-4 bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={supplier.business_card_url}
                  alt="Business Card"
                  className="max-h-64 object-contain rounded-lg cursor-pointer shadow-xs"
                  onClick={() => setPreviewImage({ url: supplier.business_card_url!, title: `${supplier.name} - Business Card` })}
                />
                <span className="text-[11px] text-slate-400 mt-2">Click image to zoom</span>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-xl">
                No Business Card uploaded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Edit Supplier Details</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSupplier} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Market / City</label>
                  <select
                    value={editForm.market_city}
                    onChange={(e) => setEditForm({ ...editForm, market_city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  >
                    <option value="Yiwu">Yiwu (义乌国际商贸城)</option>
                    <option value="Guangzhou">Guangzhou (广州)</option>
                    <option value="Shantou">Shantou (汕头澄海)</option>
                    <option value="Foshan">Foshan (佛山)</option>
                    <option value="Direct Factory">Direct Factory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Shop / Booth No.</label>
                  <input
                    type="text"
                    value={editForm.shop_no}
                    onChange={(e) => setEditForm({ ...editForm, shop_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editForm.contact_person}
                    onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">WeChat ID</label>
                  <input
                    type="text"
                    value={editForm.wechat_id}
                    onChange={(e) => setEditForm({ ...editForm, wechat_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categories (comma separated)</label>
                  <input
                    type="text"
                    value={editForm.categories}
                    onChange={(e) => setEditForm({ ...editForm, categories: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={editForm.payment_terms}
                    onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm"
                >
                  {submittingEdit ? 'Saving...' : 'Update Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment / Ledger Modal */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Record Payment / Invoice</h3>
            <form onSubmit={handleCreateLedgerEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Type</label>
                <select
                  value={ledgerForm.entry_type}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, entry_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="Debit - Deposit">Debit - Deposit (Payment made to supplier)</option>
                  <option value="Debit - Balance Payment">Debit - Balance Payment (Payment made)</option>
                  <option value="Debit - Advance Wire">Debit - Advance Wire</option>
                  <option value="Credit - Invoice">Credit - Invoice (Goods value owed)</option>
                  <option value="Adjustment">Adjustment</option>
                  <option value="Refund">Refund from Supplier</option>
                </select>
              </div>

              {/* Link to Purchase Order Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Link to Purchase Order (Optional / Recommended)
                </label>
                <select
                  value={ledgerForm.po_id}
                  onChange={(e) => {
                    const poId = e.target.value;
                    const matchedPO = orders.find((o) => o.id === poId);
                    let suggestedAmt = ledgerForm.amount_cny;
                    let refNo = ledgerForm.reference_no;
                    let notes = ledgerForm.notes;

                    if (matchedPO) {
                      refNo = refNo || matchedPO.po_number;
                      if (!suggestedAmt) {
                        if (ledgerForm.entry_type.includes('Deposit')) {
                          const dep = (matchedPO.total_amount_cny * (matchedPO.deposit_required_percent || 30)) / 100;
                          suggestedAmt = dep > 0 ? String(dep) : String(matchedPO.total_amount_cny);
                        } else {
                          suggestedAmt = String(matchedPO.balance_due_cny || matchedPO.total_amount_cny);
                        }
                      }
                      if (!notes) {
                        notes = `Payment for PO ${matchedPO.po_number}`;
                      }
                    }

                    setLedgerForm({
                      ...ledgerForm,
                      po_id: poId,
                      amount_cny: suggestedAmt,
                      reference_no: refNo,
                      notes: notes,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">-- No specific PO (General Supplier Payment/Invoice) --</option>
                  {orders.map((po) => {
                    const depositReq = (po.total_amount_cny * (po.deposit_required_percent || 30)) / 100;
                    return (
                      <option key={po.id} value={po.id}>
                        {po.po_number} — Total: {formatCNY(po.total_amount_cny)} (Dep Paid: {formatCNY(po.deposit_paid_cny || 0)} / Bal Due: {formatCNY(po.balance_due_cny || po.total_amount_cny)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (RMB ¥) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={ledgerForm.amount_cny}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, amount_cny: e.target.value })}
                  placeholder="e.g. 15000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={ledgerForm.payment_method}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="WeChat Pay">WeChat Pay (微信支付)</option>
                  <option value="Alipay">Alipay (支付宝)</option>
                  <option value="Bank Transfer (China Domestic)">Bank Transfer (China Domestic 网银)</option>
                  <option value="TT International Wire">TT International Wire</option>
                  <option value="Exchange Agent">Money Exchange Agent</option>
                  <option value="Cash">Cash RMB</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Date</label>
                <input
                  type="date"
                  value={ledgerForm.transaction_date}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference # / WeChat Trans ID</label>
                <input
                  type="text"
                  value={ledgerForm.reference_no}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, reference_no: e.target.value })}
                  placeholder="e.g. WX20260831001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={ledgerForm.notes}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, notes: e.target.value })}
                  placeholder="e.g. 30% deposit for PO"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLedger}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
                >
                  {submittingLedger ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {isDeleteModalOpen && supplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Supplier Profile?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <strong className="block font-bold text-slate-900">{supplier.name}</strong>
              {supplier.shop_no && (
                <span className="text-slate-500 block">Shop: {supplier.shop_no}</span>
              )}
              <span className="text-rose-700 text-[11px] font-semibold block mt-1">
                Note: Deleting this supplier will also permanently remove all {orders.length} linked Purchase Orders, {items.length} catalog items, and ledger records.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingSupplier}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                disabled={deletingSupplier}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingSupplier ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete PO Confirmation Modal in Supplier Tab */}
      {deletePOModal.isOpen && deletePOModal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Purchase Order?</h3>
                <p className="text-xs text-slate-500">This will delete this PO and all its line items.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="font-bold text-slate-900 font-mono">{deletePOModal.po.po_number}</strong>
                <span className="font-bold text-slate-900">{formatCNY(deletePOModal.po.total_amount_cny)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletePOModal({ isOpen: false, po: null })}
                disabled={deletingPO}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePO}
                disabled={deletingPO}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingPO ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
