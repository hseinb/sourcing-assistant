'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingContainer, SourcingPurchaseOrder } from '@/lib/types';
import {
  Container,
  Plus,
  Search,
  ExternalLink,
  Loader2,
  Calendar,
  DollarSign,
  ArrowRight,
  Ship,
  MapPin,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate, getCMATrackingUrl } from '@/lib/utils/formatters';
import { ContainerStatusBadge } from '@/components/ui/Badge';
import { CBMUtilizationBar } from '@/components/containers/CBMUtilizationBar';

export default function ContainersPage() {
  const [containers, setContainers] = useState<SourcingContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete container modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    container: SourcingContainer | null;
  }>({
    isOpen: false,
    container: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sourcing_containers')
        .select('*, purchase_orders:sourcing_purchase_orders(*, supplier:sourcing_suppliers(name, shop_no))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContainers((data as SourcingContainer[]) || []);
    } catch (err) {
      console.error('Error fetching containers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContainer = async () => {
    if (!deleteModal.container) return;
    setDeleting(true);
    try {
      // 1. Unlink any assigned purchase orders
      await supabase
        .from('sourcing_purchase_orders')
        .update({ container_id: null })
        .eq('container_id', deleteModal.container.id);

      // 2. Delete container record
      const { error } = await supabase
        .from('sourcing_containers')
        .delete()
        .eq('id', deleteModal.container.id);

      if (error) throw error;

      setDeleteModal({ isOpen: false, container: null });
      fetchContainers();
    } catch (err) {
      console.error('Error deleting container:', err);
      alert('Failed to delete container plan.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredContainers = containers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (c.container_number && c.container_number.toLowerCase().includes(q)) ||
      (c.bl_number && c.bl_number.toLowerCase().includes(q)) ||
      (c.shipping_line && c.shipping_line.toLowerCase().includes(q)) ||
      (c.loading_warehouse_location && c.loading_warehouse_location.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Container className="w-6 h-6 text-amber-600" />
            <span>Container Prepping & Consolidation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Group multi-supplier purchase orders into 20GP / 40GP / 40HQ containers, track CBM utilization, payment schedules, and CMA CGM shipments.
          </p>
        </div>

        <Link
          href="/containers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Prep New Container</span>
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by container #, B/L #, shipping line, warehouse..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Container Cards Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs">Loading containers consolidation plans...</span>
        </div>
      ) : filteredContainers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Container className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">No containers yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Consolidate ready purchase orders from multiple Chinese suppliers into a single 40HQ ocean container.
          </p>
          <Link
            href="/containers/new"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-colors"
          >
            Prep First Container
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredContainers.map((container) => {
            const pos = container.purchase_orders || [];
            const currentCBM = pos.reduce((sum, po) => sum + Number(po.total_cbm || 0), 0);
            const currentWeight = pos.reduce((sum, po) => sum + Number(po.total_weight_kg || 0), 0);

            // Compute financial totals across assigned POs
            let totalValCny = 0;
            let depositPaidCny = 0;
            let balanceDueCny = 0;

            pos.forEach((po) => {
              totalValCny += Number(po.total_amount_cny || 0);
              depositPaidCny += Number(po.deposit_paid_cny || 0);
              balanceDueCny += Number(po.balance_due_cny || 0);
            });

            const cmaUrl = getCMATrackingUrl(container.container_number || container.bl_number || undefined);

            return (
              <div
                key={container.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-amber-400 transition-all flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Top info */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-mono font-black text-lg text-slate-900">
                          {container.container_number || 'UNASSIGNED CNTR'}
                        </h2>
                        <ContainerStatusBadge status={container.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {container.container_type} ({container.max_cbm} CBM Limit)
                        </span>
                        {container.bl_number && (
                          <span className="font-mono">B/L: {container.bl_number}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {cmaUrl && (
                        <a
                          href={cmaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 shrink-0"
                          title="Track via CMA CGM / Carrier"
                        >
                          <Ship className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Track</span>
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, container })}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete Container"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CBM Progress Bar */}
                  <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                    <CBMUtilizationBar
                      currentCbm={currentCBM}
                      containerType={container.container_type}
                      customMaxCbm={container.max_cbm}
                      totalWeightKg={currentWeight}
                    />
                  </div>

                  {/* Financials Rollup */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px]">Total Value</span>
                      <strong className="text-slate-900 text-sm">{formatCNY(totalValCny)}</strong>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-emerald-700 block text-[10px]">Deposits Paid</span>
                      <strong className="text-emerald-700 text-sm">{formatCNY(depositPaidCny)}</strong>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-rose-700 block text-[10px]">Balance Due</span>
                      <strong className="text-rose-600 text-sm">{formatCNY(balanceDueCny)}</strong>
                    </div>
                  </div>

                  {/* Milestone Dates */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl text-slate-600">
                    <div>
                      <span className="text-slate-400">WH Deadline: </span>
                      <strong className="text-slate-800">{formatDate(container.warehouse_delivery_deadline)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Loading Date: </span>
                      <strong className="text-slate-800">{formatDate(container.container_loading_date)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">ETA: </span>
                      <strong className="text-slate-800">{formatDate(container.eta)}</strong>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Loading WH: <strong className="text-slate-700">{container.loading_warehouse_location || 'Yiwu WH'}</strong>
                  </span>
                  <Link
                    href={`/containers/${container.id}`}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                  >
                    <span>Open Container Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Container Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.container && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Container Plan?</h3>
                <p className="text-xs text-slate-500">This action will unlink all assigned POs back to ready state.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <strong className="block font-bold text-slate-900">
                {deleteModal.container.container_number || 'Unassigned Container'} ({deleteModal.container.container_type})
              </strong>
              {deleteModal.container.bl_number && (
                <span className="text-slate-500 block">B/L: {deleteModal.container.bl_number}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, container: null })}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteContainer}
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
