'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingPurchaseOrder, POStatus } from '@/lib/types';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Loader2,
  Calendar,
  Package,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate } from '@/lib/utils/formatters';
import { POStatusBadge } from '@/components/ui/Badge';

const STATUS_TABS: (POStatus | 'ALL')[] = [
  'ALL',
  'Draft',
  'PO Issued',
  'Deposit Paid',
  'In Production',
  'Ready at Factory',
  'Delivered to WH',
  'Loaded',
  'Received WH',
];

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<POStatus | 'ALL'>('ALL');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    po: SourcingPurchaseOrder | null;
  }>({
    isOpen: false,
    po: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(name, shop_no), container:sourcing_containers(container_number)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as SourcingPurchaseOrder[]) || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePO = async () => {
    if (!deleteModal.po) return;
    setDeleting(true);
    try {
      // 1. Delete PO line items
      await supabase
        .from('sourcing_purchase_order_items')
        .delete()
        .eq('po_id', deleteModal.po.id);

      // 2. Delete PO
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .delete()
        .eq('id', deleteModal.po.id);

      if (error) throw error;

      setDeleteModal({ isOpen: false, po: null });
      fetchOrders();
    } catch (err) {
      console.error('Error deleting purchase order:', err);
      alert('Failed to delete purchase order.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredOrders = orders.filter((po) => {
    const matchesStatus = selectedStatus === 'ALL' || po.status === selectedStatus;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      po.po_number.toLowerCase().includes(q) ||
      (po.supplier?.name && po.supplier.name.toLowerCase().includes(q)) ||
      (po.shipping_mark && po.shipping_mark.toLowerCase().includes(q)) ||
      (po.container?.container_number && po.container.container_number.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <span>Purchase Orders</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track purchase orders placed with Chinese suppliers, production milestones, and warehouse deliveries.
          </p>
        </div>

        <Link
          href="/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </Link>
      </div>

      {/* Filter and Status Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PO #, Supplier name, mark, container..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <span className="text-xs text-slate-400 font-semibold self-end md:self-auto">
            Showing {filteredOrders.length} of {orders.length} orders
          </span>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((status) => {
            const count =
              status === 'ALL'
                ? orders.length
                : orders.filter((o) => o.status === status).length;
            if (count === 0 && status !== 'ALL' && status !== 'Draft' && status !== 'PO Issued') {
              return null;
            }

            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading purchase orders...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No purchase orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier & Shop #</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment Terms</th>
                  <th className="py-3 px-4">Total Cartons & CBM</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Deposit Paid</th>
                  <th className="py-3 px-4">WH Delivery</th>
                  <th className="py-3 px-4">Container</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{po.po_number}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{po.supplier?.name || '-'}</div>
                      <div className="text-[11px] text-slate-400">{po.supplier?.shop_no}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <POStatusBadge status={po.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md text-[10px] font-bold whitespace-nowrap block max-w-[150px] truncate" title={po.payment_terms || '30% Deposit'}>
                        {po.payment_terms || '30% Deposit'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-semibold text-slate-800">{po.total_cartons} ctns</span> • {po.total_cbm.toFixed(2)} CBM
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCNY(po.total_amount_cny)}</td>
                    <td className="py-3.5 px-4 text-emerald-600 font-semibold">{formatCNY(po.deposit_paid_cny)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{formatDate(po.warehouse_delivery_date)}</td>
                    <td className="py-3.5 px-4">
                      {po.container?.container_number ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-mono text-[11px] rounded border border-amber-200">
                          {po.container.container_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/orders/${po.id}`}
                          className="font-bold text-blue-600 hover:text-blue-800"
                        >
                          Open &rarr;
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ isOpen: true, po })}
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

      {/* Delete PO Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.po && (
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
                <strong className="font-bold text-slate-900 font-mono">{deleteModal.po.po_number}</strong>
                <span className="font-bold text-slate-900">{formatCNY(deleteModal.po.total_amount_cny)}</span>
              </div>
              {deleteModal.po.supplier && (
                <span className="text-slate-500 block">Supplier: {deleteModal.po.supplier.name}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, po: null })}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePO}
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
    </div>
  );
}
