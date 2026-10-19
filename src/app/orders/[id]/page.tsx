'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { SourcingPurchaseOrder, SourcingPurchaseOrderItem, POStatus, SourcingContainer } from '@/lib/types';
import {
  ShoppingCart,
  Building2,
  Container,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  DollarSign,
  Package,
  Trash2,
  AlertTriangle,
  Edit,
  Save,
  X,
  Plus,
  CreditCard,
  Camera,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate, calculateCartonCBM } from '@/lib/utils/formatters';
import { POStatusBadge } from '@/components/ui/Badge';
import { exportPurchaseOrderExcel } from '@/lib/excel/exporter';
import { ImageModal } from '@/components/ui/ImageModal';
import { syncPOInvoiceEntry, recalculatePOPaidAmounts } from '@/lib/ledger/syncLedger';
import { compressImageFile } from '@/lib/utils/imageCompressor';

const STAGES: POStatus[] = [
  'Draft',
  'PO Issued',
  'Deposit Paid',
  'In Production',
  'Ready at Factory',
  'Delivered to WH',
  'Loaded',
  'Received WH',
];

interface EditableLineItem {
  id: string; // temporary or db id
  db_id?: string;
  sourcing_item_id: string | null;
  item_code_snapshot: string;
  internal_item_code: string;
  item_name_snapshot: string;
  image_url_snapshot: string | null;
  quantity_pcs: number;
  pcs_per_carton: number;
  carton_count: number;
  unit_price_cny: number;
  total_price_cny: number;
  carton_cbm: number;
  total_cbm: number;
  total_weight_kg: number;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<SourcingPurchaseOrder | null>(null);
  const [containers, setContainers] = useState<SourcingContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editHeader, setEditHeader] = useState({
    po_number: '',
    deposit_required_percent: 30,
    payment_terms: '30% Deposit + Balance Before Delivery',
    payment_due_date: '',
    shipping_mark: '',
    warehouse_delivery_date: '',
    order_date: '',
    notes: '',
  });
  const [editLines, setEditLines] = useState<EditableLineItem[]>([]);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPO, setDeletingPO] = useState(false);

  // Record Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    entry_type: 'Debit - Deposit',
    amount_cny: '',
    payment_method: 'WeChat Pay',
    reference_no: '',
    notes: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const { data: poData, error: poErr } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(*), container:sourcing_containers(*)')
        .eq('id', orderId)
        .single();

      if (poErr) throw poErr;

      // Fetch items
      const { data: itemsData } = await supabase
        .from('sourcing_purchase_order_items')
        .select('*, sourcing_item:sourcing_items(*), erp_item:tbl_items(*)')
        .eq('po_id', orderId);

      const fullOrder = {
        ...(poData as SourcingPurchaseOrder),
        items: (itemsData as SourcingPurchaseOrderItem[]) || [],
      };
      setOrder(fullOrder);

      // Auto-sync invoice in ledger in background
      syncPOInvoiceEntry(fullOrder);

      // Fetch containers
      const { data: cData } = await supabase.from('sourcing_containers').select('*').order('created_at', { ascending: false });
      setContainers((cData as SourcingContainer[]) || []);
    } catch (err) {
      console.error('Error loading order:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (!order) return;
    setEditHeader({
      po_number: order.po_number || '',
      deposit_required_percent: order.deposit_required_percent || 0,
      payment_terms: order.payment_terms || '30% Deposit + Balance Before Delivery',
      payment_due_date: order.payment_due_date || '',
      shipping_mark: order.shipping_mark || '',
      warehouse_delivery_date: order.warehouse_delivery_date || '',
      order_date: order.order_date || new Date().toISOString().slice(0, 10),
      notes: order.notes || '',
    });

    setEditLines(
      (order.items || []).map((item) => ({
        id: item.id,
        db_id: item.id,
        sourcing_item_id: item.sourcing_item_id || null,
        item_code_snapshot: item.item_code_snapshot || item.sourcing_item?.factory_item_code || '',
        internal_item_code: item.internal_item_code || item.sourcing_item?.internal_item_code || '',
        item_name_snapshot: item.item_name_snapshot || item.sourcing_item?.factory_item_name_cn || '',
        image_url_snapshot: item.image_url_snapshot || item.sourcing_item?.primary_image_url || null,
        quantity_pcs: Number(item.quantity_pcs) || 0,
        pcs_per_carton: Number(item.pcs_per_carton) || 1,
        carton_count: Number(item.carton_count) || 0,
        unit_price_cny: Number(item.unit_price_cny) || 0,
        total_price_cny: Number(item.total_price_cny) || 0,
        carton_cbm: Number(item.carton_cbm) || 0.05,
        total_cbm: Number(item.total_cbm) || 0,
        total_weight_kg: Number(item.total_weight_kg) || 0,
      }))
    );

    setIsEditing(true);
  };

  const handleAddBlankLine = () => {
    const newLine: EditableLineItem = {
      id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourcing_item_id: null,
      item_code_snapshot: '',
      internal_item_code: '',
      item_name_snapshot: '',
      image_url_snapshot: null,
      quantity_pcs: 100,
      pcs_per_carton: 10,
      carton_count: 10,
      unit_price_cny: 0,
      total_price_cny: 0,
      carton_cbm: 0.05,
      total_cbm: 0.5,
      total_weight_kg: 100,
    };
    setEditLines([...editLines, newLine]);
  };

  const handleRemoveLine = (index: number) => {
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const updateLineCartonCount = (index: number, ctns: number) => {
    const next = [...editLines];
    const item = next[index];
    const c = Math.max(1, ctns);
    const pcsPerCtn = item.pcs_per_carton || 1;
    item.carton_count = c;
    item.quantity_pcs = c * pcsPerCtn;
    item.total_price_cny = item.quantity_pcs * item.unit_price_cny;
    item.total_cbm = Number((c * item.carton_cbm).toFixed(4));
    item.total_weight_kg = Number((c * 10).toFixed(2));
    setEditLines(next);
  };

  const updateLinePcsPerCarton = (index: number, pcsPerCtn: number) => {
    const next = [...editLines];
    const item = next[index];
    const ppc = Math.max(1, pcsPerCtn);
    item.pcs_per_carton = ppc;
    item.quantity_pcs = item.carton_count * ppc;
    item.total_price_cny = item.quantity_pcs * item.unit_price_cny;
    setEditLines(next);
  };

  const updateLineUnitPrice = (index: number, price: number) => {
    const next = [...editLines];
    const item = next[index];
    item.unit_price_cny = Math.max(0, price);
    item.total_price_cny = item.quantity_pcs * item.unit_price_cny;
    setEditLines(next);
  };

  const updateLineCartonCbm = (index: number, cbm: number) => {
    const next = [...editLines];
    const item = next[index];
    item.carton_cbm = Math.max(0.001, cbm);
    item.total_cbm = Number((item.carton_count * item.carton_cbm).toFixed(4));
    setEditLines(next);
  };

  const handleSaveOrderChanges = async () => {
    if (!order) return;
    if (editLines.length === 0) {
      alert('A purchase order must contain at least 1 item.');
      return;
    }

    setSavingEdit(true);
    try {
      // 1. Recalculate totals
      const totalPieces = editLines.reduce((sum, l) => sum + (Number(l.quantity_pcs) || 0), 0);
      const totalCartons = editLines.reduce((sum, l) => sum + (Number(l.carton_count) || 0), 0);
      const totalCbm = Number(editLines.reduce((sum, l) => sum + (Number(l.total_cbm) || 0), 0).toFixed(3));
      const totalWeight = Number(editLines.reduce((sum, l) => sum + (Number(l.total_weight_kg) || 0), 0).toFixed(2));
      const totalAmountCny = Number(editLines.reduce((sum, l) => sum + (Number(l.total_price_cny) || 0), 0).toFixed(2));
      const depositPaid = Number(order.deposit_paid_cny) || 0;
      const balanceDue = Math.max(0, totalAmountCny - depositPaid);

      // 2. Update PO record
      const poUpdates = {
        po_number: editHeader.po_number.trim() || order.po_number,
        deposit_required_percent: Number(editHeader.deposit_required_percent) || 0,
        payment_terms: editHeader.payment_terms.trim() || '30% Deposit + Balance Before Delivery',
        payment_due_date: editHeader.payment_due_date || null,
        shipping_mark: editHeader.shipping_mark.trim() || null,
        warehouse_delivery_date: editHeader.warehouse_delivery_date || null,
        order_date: editHeader.order_date || null,
        notes: editHeader.notes.trim() || null,
        total_pieces: totalPieces,
        total_cartons: totalCartons,
        total_cbm: totalCbm,
        total_weight_kg: totalWeight,
        total_amount_cny: totalAmountCny,
        balance_due_cny: balanceDue,
        updated_at: new Date().toISOString(),
      };

      const { error: poErr } = await supabase
        .from('sourcing_purchase_orders')
        .update(poUpdates)
        .eq('id', order.id);

      if (poErr) throw poErr;

      // 3. Delete existing items and insert updated items
      await supabase
        .from('sourcing_purchase_order_items')
        .delete()
        .eq('po_id', order.id);

      const itemsToInsert = editLines.map((l) => ({
        po_id: order.id,
        sourcing_item_id: l.sourcing_item_id,
        item_code_snapshot: l.item_code_snapshot.trim() || null,
        internal_item_code: l.internal_item_code.trim() || null,
        item_name_snapshot: l.item_name_snapshot.trim() || null,
        image_url_snapshot: l.image_url_snapshot || null,
        quantity_pcs: l.quantity_pcs,
        pcs_per_carton: l.pcs_per_carton,
        carton_count: l.carton_count,
        unit_price_cny: l.unit_price_cny,
        total_price_cny: l.total_price_cny,
        carton_cbm: l.carton_cbm,
        total_cbm: l.total_cbm,
        total_weight_kg: l.total_weight_kg,
      }));

      const { error: insErr } = await supabase
        .from('sourcing_purchase_order_items')
        .insert(itemsToInsert);

      if (insErr) throw insErr;

      // 4. Synchronize invoice in supplier ledger
      await syncPOInvoiceEntry({
        id: order.id,
        supplier_id: order.supplier_id,
        po_number: poUpdates.po_number,
        total_amount_cny: totalAmountCny,
        order_date: poUpdates.order_date,
      });

      setIsEditing(false);
      fetchOrder();
    } catch (err) {
      console.error('Error saving PO changes:', err);
      alert('Failed to save purchase order changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusChange = async (newStatus: POStatus) => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;
      setOrder({ ...order, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update PO status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignContainer = async (containerId: string) => {
    if (!order) return;
    try {
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .update({ container_id: containerId || null, updated_at: new Date().toISOString() })
        .eq('id', order.id);

      if (error) throw error;
      fetchOrder();
    } catch (err) {
      console.error('Failed to assign container:', err);
      alert('Error updating container assignment.');
    }
  };

  const handleDeletePO = async () => {
    if (!order) return;
    setDeletingPO(true);
    try {
      // 1. Delete line items
      await supabase
        .from('sourcing_purchase_order_items')
        .delete()
        .eq('po_id', order.id);

      // 2. Delete PO
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;
      router.push('/orders');
    } catch (err) {
      console.error('Error deleting purchase order:', err);
      alert('Failed to delete purchase order.');
    } finally {
      setDeletingPO(false);
    }
  };

  const openPaymentModal = () => {
    if (!order) return;
    const requiredDeposit = (order.total_amount_cny * (order.deposit_required_percent || 30)) / 100;
    const depositRemaining = Math.max(0, requiredDeposit - (order.deposit_paid_cny || 0));
    const defaultAmt = depositRemaining > 0 ? depositRemaining : (order.balance_due_cny || 0);

    setPaymentForm({
      entry_type: depositRemaining > 0 ? 'Debit - Deposit' : 'Debit - Balance Payment',
      amount_cny: defaultAmt > 0 ? String(defaultAmt) : '',
      payment_method: 'WeChat Pay',
      reference_no: order.po_number,
      notes: `Deposit payment for ${order.po_number}`,
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const amt = parseFloat(paymentForm.amount_cny);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const { error } = await supabase.from('sourcing_supplier_ledger').insert({
        supplier_id: order.supplier_id,
        po_id: order.id,
        entry_type: paymentForm.entry_type,
        amount_cny: amt,
        payment_method: paymentForm.payment_method,
        reference_no: paymentForm.reference_no.trim() || order.po_number,
        notes: paymentForm.notes.trim() || null,
        transaction_date: paymentForm.transaction_date,
      });

      if (error) throw error;

      // Recalculate PO payments & advance status
      await recalculatePOPaidAmounts(order.id);

      setIsPaymentModalOpen(false);
      fetchOrder();
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs">Loading purchase order...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Order Not Found</h2>
        <Link href="/orders" className="text-xs font-semibold text-blue-600 hover:underline">
          &larr; Back to purchase orders
        </Link>
      </div>
    );
  }

  const currentStageIndex = STAGES.indexOf(order.status);

  // Rollups in Edit Mode
  const editTotalPieces = editLines.reduce((s, l) => s + (Number(l.quantity_pcs) || 0), 0);
  const editTotalCartons = editLines.reduce((s, l) => s + (Number(l.carton_count) || 0), 0);
  const editTotalCbm = editLines.reduce((s, l) => s + (Number(l.total_cbm) || 0), 0);
  const editTotalAmount = editLines.reduce((s, l) => s + (Number(l.total_price_cny) || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Purchase Orders</span>
      </Link>

      {/* PO Top Card & Stepper */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {order.po_number}
              </h1>
              <POStatusBadge status={order.status} />
              {isEditing && (
                <span className="px-2.5 py-0.5 bg-amber-500 text-white font-bold text-[11px] rounded-full animate-pulse">
                  Editing Mode
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
              {order.supplier && (
                <Link
                  href={`/suppliers/${order.supplier.id}`}
                  className="font-bold text-slate-800 hover:text-blue-600 flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.supplier.name}</span>
                  {order.supplier.shop_no && (
                    <span className="text-slate-400 font-normal">({order.supplier.shop_no})</span>
                  )}
                </Link>
              )}
              <span>•</span>
              <span>Order Date: <strong>{formatDate(order.order_date)}</strong></span>
              <span>•</span>
              <span>Mark: <strong>{order.shipping_mark || '-'}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveOrderChanges}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={openPaymentModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Record Deposit / Payment</span>
                </button>

                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Order</span>
                </button>

                <button
                  onClick={() => exportPurchaseOrderExcel(order)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PO</span>
                </button>

                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                  title="Delete Purchase Order"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 8-Stage Visual Pipeline Stepper */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Production & Delivery Pipeline
          </span>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGES.map((stage, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <button
                  key={stage}
                  onClick={() => handleStatusChange(stage)}
                  disabled={updatingStatus || isEditing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {isPast ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                  <span>{stage}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-center text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border">
            <span className="text-slate-400 block text-[10px]">Total Order Value</span>
            <strong className="text-sm text-slate-900 font-bold">
              {formatCNY(isEditing ? editTotalAmount : order.total_amount_cny)}
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border">
            <span className="text-slate-400 block text-[10px]">Cartons & Volume</span>
            <strong className="text-sm text-slate-900 font-bold">
              {isEditing ? editTotalCartons : order.total_cartons} ctns • {(isEditing ? editTotalCbm : order.total_cbm).toFixed(2)} CBM
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border">
            <span className="text-slate-400 block text-[10px]">Deposit Paid</span>
            <strong className="text-sm text-emerald-600 font-bold">{formatCNY(order.deposit_paid_cny)}</strong>
            <span className="text-[10px] text-slate-400 block">
              Req ({order.deposit_required_percent || 0}%): {formatCNY((order.total_amount_cny * (order.deposit_required_percent || 0)) / 100)}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border">
            <span className="text-slate-400 block text-[10px]">Balance Due</span>
            <strong className="text-sm text-rose-600 font-bold">{formatCNY(order.balance_due_cny)}</strong>
          </div>
        </div>

        {/* Payment Terms & Schedule Summary in View Mode */}
        {!isEditing && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                Payment Terms:
              </span>
              <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg shadow-2xs">
                {order.payment_terms || '30% Deposit + Balance Before Delivery'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-600">
              {order.payment_due_date && (
                <div>
                  <span className="text-slate-400 text-[10px] block">Payment Due Date:</span>
                  <strong className="text-amber-900 font-mono font-bold text-xs">
                    {formatDate(order.payment_due_date)}
                  </strong>
                </div>
              )}
              {order.warehouse_delivery_date && (
                <div>
                  <span className="text-slate-400 text-[10px] block">WH Delivery Deadline:</span>
                  <strong className="text-slate-800 font-bold text-xs">
                    {formatDate(order.warehouse_delivery_date)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header Edit Inputs (Visible during edit mode) */}
        {isEditing && (
          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3">
            <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wider">
              Edit Order Metadata & Payment Terms
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">PO Number</label>
                <input
                  type="text"
                  value={editHeader.po_number}
                  onChange={(e) => setEditHeader({ ...editHeader, po_number: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-indigo-950 mb-1">Payment Terms (付款条件)</label>
                <select
                  value={editHeader.payment_terms}
                  onChange={(e) => {
                    const terms = e.target.value;
                    let dep = editHeader.deposit_required_percent;
                    if (terms === 'Cash on Delivery (COD)' || terms.includes('Days After Receiving')) {
                      dep = 0;
                    } else if (terms === '100% Advance Payment') {
                      dep = 100;
                    } else if (terms === '30% Deposit + Balance Before Delivery') {
                      dep = 30;
                    }
                    setEditHeader({
                      ...editHeader,
                      payment_terms: terms,
                      deposit_required_percent: dep,
                    });
                  }}
                  className="w-full px-3 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950"
                >
                  <option value="Cash on Delivery (COD)">📦 Cash on Delivery (COD) / 货到付款</option>
                  <option value="30 Days After Receiving">⏳ 30 Days After Receiving / 货到30天 (Net 30)</option>
                  <option value="60 Days After Receiving">⏳ 60 Days After Receiving / 货到60天 (Net 60)</option>
                  <option value="90 Days After Receiving">⏳ 90 Days After Receiving / 货到90天 (Net 90)</option>
                  <option value="30% Deposit + Balance Before Delivery">💰 30% Deposit + Balance Before Delivery / 30%定金+发货前尾款</option>
                  <option value="100% Advance Payment">⚡ 100% Advance Payment / 全款预付</option>
                  <option value="Custom">✏️ Custom Payment Terms / 自定义条款</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Deposit Required %</label>
                <input
                  type="number"
                  value={editHeader.deposit_required_percent}
                  onChange={(e) => setEditHeader({ ...editHeader, deposit_required_percent: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Projected Due Date</label>
                <input
                  type="date"
                  value={editHeader.payment_due_date}
                  onChange={(e) => setEditHeader({ ...editHeader, payment_due_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-amber-950"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">WH Delivery Date</label>
                <input
                  type="date"
                  value={editHeader.warehouse_delivery_date}
                  onChange={(e) => setEditHeader({ ...editHeader, warehouse_delivery_date: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping Mark</label>
                <input
                  type="text"
                  value={editHeader.shipping_mark}
                  onChange={(e) => setEditHeader({ ...editHeader, shipping_mark: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Container Consolidation Assignment */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
            <Container className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Container Consolidation Plan</h4>
            {order.container ? (
              <p className="text-xs text-amber-800 font-semibold">
                Assigned to: {order.container.container_number} ({order.container.container_type})
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Not assigned to a shipping container yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={order.container_id || ''}
            onChange={(e) => handleAssignContainer(e.target.value)}
            disabled={isEditing}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
          >
            <option value="">-- No Container Assigned --</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.container_number || 'Unnamed'} ({c.container_type} - {c.shipping_line})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Line Items Table with Photo Thumbnails & Internal SKU */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            Order Items ({isEditing ? editLines.length : order.items?.length || 0})
          </h3>

          {isEditing && (
            <button
              onClick={handleAddBlankLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Item</span>
            </button>
          )}
        </div>

        {isEditing ? (
          /* Editable Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-3">Factory Code</th>
                  <th className="py-2.5 px-3">Internal Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-2 text-center">Cartons</th>
                  <th className="py-2.5 px-2 text-center">Pcs/Ctn</th>
                  <th className="py-2.5 px-2 text-center">Total Pcs</th>
                  <th className="py-2.5 px-2 text-right">Price (¥)</th>
                  <th className="py-2.5 px-2 text-right">CBM/Ctn</th>
                  <th className="py-2.5 px-2 text-right">Total (¥)</th>
                  <th className="py-2.5 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editLines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/60">
                    <td className="py-2 px-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={line.item_code_snapshot}
                        onChange={(e) => {
                          const next = [...editLines];
                          next[idx].item_code_snapshot = e.target.value;
                          setEditLines(next);
                        }}
                        placeholder="Factory Code"
                        className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={line.internal_item_code}
                        onChange={(e) => {
                          const next = [...editLines];
                          next[idx].internal_item_code = e.target.value;
                          setEditLines(next);
                        }}
                        placeholder="Internal SKU"
                        className="w-24 px-2 py-1 bg-amber-50/60 border border-amber-200 rounded-lg text-xs font-mono font-bold text-amber-900"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={line.item_name_snapshot}
                        onChange={(e) => {
                          const next = [...editLines];
                          next[idx].item_name_snapshot = e.target.value;
                          setEditLines(next);
                        }}
                        placeholder="Description"
                        className="w-36 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={line.carton_count}
                        onChange={(e) => updateLineCartonCount(idx, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={line.pcs_per_carton}
                        onChange={(e) => updateLinePcsPerCarton(idx, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-center font-semibold"
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800">
                      {line.quantity_pcs}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.unit_price_cny}
                        onChange={(e) => updateLineUnitPrice(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right font-bold"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.carton_cbm}
                        onChange={(e) => updateLineCartonCbm(idx, parseFloat(e.target.value) || 0.01)}
                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">
                      {formatCNY(line.total_price_cny)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Read-only Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3 text-center">Photo</th>
                  <th className="py-3 px-4">Factory Code</th>
                  <th className="py-3 px-4">Internal Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Pcs/Ctn</th>
                  <th className="py-3 px-4 text-center">Ordered Pcs</th>
                  <th className="py-3 px-4 text-center">Cartons</th>
                  <th className="py-3 px-4 text-right">Price (RMB)</th>
                  <th className="py-3 px-4 text-right">Total CBM</th>
                  <th className="py-3 px-4 text-right">Total (RMB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(order.items || []).map((item, idx) => {
                  const img = item.image_url_snapshot || item.sourcing_item?.primary_image_url;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 text-center">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt="Thumbnail"
                            className="w-10 h-10 object-contain rounded-lg border p-0.5 mx-auto cursor-pointer hover:scale-110 transition-transform bg-slate-50"
                            onClick={() => setPreviewImage({ url: img, title: item.item_code_snapshot || 'Item' })}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center mx-auto text-slate-300">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {item.item_code_snapshot || item.sourcing_item?.factory_item_code || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-900 bg-amber-50/40">
                        {item.internal_item_code || item.sourcing_item?.internal_item_code || '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {item.item_name_snapshot || item.sourcing_item?.factory_item_name_cn || item.sourcing_item?.item_name_en || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{item.pcs_per_carton}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">{item.quantity_pcs}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{item.carton_count}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatCNY(item.unit_price_cny)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">{item.total_cbm.toFixed(3)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCNY(item.total_price_cny)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Deposit / Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Record Payment for PO</h3>
                <p className="text-xs text-slate-500">
                  Logs transaction to {order.supplier?.name || 'supplier'} ledger and updates PO balance.
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Type</label>
                <select
                  value={paymentForm.entry_type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, entry_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="Debit - Deposit">Debit - Deposit (Initial Factory Deposit)</option>
                  <option value="Debit - Balance Payment">Debit - Balance Payment (Remaining Balance)</option>
                  <option value="Debit - Advance Wire">Debit - Advance Wire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (RMB ¥) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={paymentForm.amount_cny}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_cny: e.target.value })}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="WeChat Pay">WeChat Pay (微信支付)</option>
                    <option value="Alipay">Alipay (支付宝)</option>
                    <option value="Bank Transfer (China Domestic)">Bank Transfer (网银)</option>
                    <option value="TT International Wire">TT Wire</option>
                    <option value="Cash">Cash RMB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={paymentForm.transaction_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Trans ID</label>
                <input
                  type="text"
                  value={paymentForm.reference_no}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{submittingPayment ? 'Recording...' : 'Record Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete PO Confirmation Modal */}
      {isDeleteModalOpen && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Purchase Order?</h3>
                <p className="text-xs text-slate-500">
                  This will permanently delete this PO and all {order.items?.length || 0} line items.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <strong className="font-bold text-slate-900 font-mono">{order.po_number}</strong>
                <span className="font-bold text-slate-900">{formatCNY(order.total_amount_cny)}</span>
              </div>
              {order.supplier && (
                <span className="text-slate-500 block">Supplier: {order.supplier.name}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
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
