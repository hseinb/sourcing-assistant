'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { SourcingContainer, SourcingPurchaseOrder, ContainerStatus } from '@/lib/types';
import {
  Container,
  Ship,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Download,
  ExternalLink,
  Calendar,
  DollarSign,
  Building2,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate, getContainerTrackingInfo } from '@/lib/utils/formatters';
import { ContainerStatusBadge, POStatusBadge } from '@/components/ui/Badge';
import { CBMUtilizationBar } from '@/components/containers/CBMUtilizationBar';
import { ContainerStuffingDiagram } from '@/components/containers/ContainerStuffingDiagram';
import { exportContainerPackingList, exportContainerSupplierSummaryExcel, aggregateContainerSuppliers } from '@/lib/excel/exporter';

const CONTAINER_STAGES: ContainerStatus[] = [
  'Planning',
  'Consolidating at WH',
  'Loading',
  'On Board',
  'In Transit',
  'Arrived Port',
  'Customs Cleared',
  'Received WH',
];

export default function ContainerWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const containerId = params.id as string;

  const [container, setContainer] = useState<SourcingContainer | null>(null);
  const [linkedOrders, setLinkedOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);

  // Delete container state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingContainer, setDeletingContainer] = useState(false);

  const handleDeleteContainer = async () => {
    if (!container) return;
    setDeletingContainer(true);
    try {
      // Unlink assigned purchase orders
      await supabase
        .from('sourcing_purchase_orders')
        .update({ container_id: null })
        .eq('container_id', container.id);

      // Delete container record
      const { error } = await supabase
        .from('sourcing_containers')
        .delete()
        .eq('id', container.id);

      if (error) throw error;
      router.push('/containers');
    } catch (err) {
      console.error('Error deleting container:', err);
      alert('Failed to delete container plan.');
    } finally {
      setDeletingContainer(false);
    }
  };

  useEffect(() => {
    if (containerId) fetchContainerData();
  }, [containerId]);

  const fetchContainerData = async () => {
    setLoading(true);
    try {
      // 1. Container info
      const { data: cData, error: cErr } = await supabase
        .from('sourcing_containers')
        .select('*')
        .eq('id', containerId)
        .single();
      if (cErr) throw cErr;
      setContainer(cData as SourcingContainer);

      // 2. Linked POs with their items and suppliers
      const { data: linkedData } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(*), items:sourcing_purchase_order_items(*, sourcing_item:sourcing_items(*))')
        .eq('container_id', containerId)
        .order('created_at', { ascending: false });
      setLinkedOrders((linkedData as SourcingPurchaseOrder[]) || []);

      // 3. Available unassigned POs
      const { data: availData } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(*)')
        .is('container_id', null)
        .not('status', 'in', '("Received WH","Cancelled")')
        .order('created_at', { ascending: false });
      setAvailableOrders((availData as SourcingPurchaseOrder[]) || []);
    } catch (err) {
      console.error('Error fetching container workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ContainerStatus) => {
    if (!container) return;
    try {
      const { error } = await supabase
        .from('sourcing_containers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', container.id);
      if (error) throw error;
      setContainer({ ...container, status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating container status.');
    }
  };

  const handleAttachPO = async (poId: string) => {
    setAttaching(true);
    try {
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .update({ container_id: containerId, updated_at: new Date().toISOString() })
        .eq('id', poId);
      if (error) throw error;
      setIsAttachModalOpen(false);
      fetchContainerData();
    } catch (err) {
      console.error('Error attaching PO:', err);
      alert('Failed to attach PO.');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachPO = async (poId: string) => {
    if (!confirm('Remove this PO from this container consolidation plan?')) return;
    try {
      const { error } = await supabase
        .from('sourcing_purchase_orders')
        .update({ container_id: null, updated_at: new Date().toISOString() })
        .eq('id', poId);
      if (error) throw error;
      fetchContainerData();
    } catch (err) {
      console.error('Error detaching PO:', err);
      alert('Failed to remove PO.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="text-xs">Loading container workspace...</span>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Container Not Found</h2>
        <Link href="/containers" className="text-xs font-semibold text-amber-700 hover:underline">
          &larr; Back to Containers
        </Link>
      </div>
    );
  }

  // Rollups
  const totalCbm = linkedOrders.reduce((sum, po) => sum + Number(po.total_cbm || 0), 0);
  const totalCartons = linkedOrders.reduce((sum, po) => sum + Number(po.total_cartons || 0), 0);
  const totalWeight = linkedOrders.reduce((sum, po) => sum + Number(po.total_weight_kg || 0), 0);
  const totalValueCny = linkedOrders.reduce((sum, po) => sum + Number(po.total_amount_cny || 0), 0);
  const totalDepositsPaidCny = linkedOrders.reduce((sum, po) => sum + Number(po.deposit_paid_cny || 0), 0);
  const totalBalanceDueCny = Math.max(0, totalValueCny - totalDepositsPaidCny);

  const currentStageIndex = CONTAINER_STAGES.indexOf(container.status);
  const trackingInfo = getContainerTrackingInfo(container.container_number, container.shipping_line);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link
        href="/containers"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Containers</span>
      </Link>

      {/* Container Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {container.container_number || 'PLANNING / TBD'}
              </h1>
              <ContainerStatusBadge status={container.status} />
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                {container.container_type} ({container.max_cbm} CBM)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
              <span className="font-bold text-slate-800">{container.shipping_line}</span>
              {container.bl_number && <span>• B/L: <strong className="font-mono">{container.bl_number}</strong></span>}
              {container.seal_number && <span>• Seal: <strong className="font-mono">{container.seal_number}</strong></span>}
              <span>• Loading WH: <strong className="text-slate-800">{container.loading_warehouse_location || 'Yiwu WH'}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {container.container_number && (
              <a
                href={trackingInfo.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Ship className="w-3.5 h-3.5" />
                <span>Track {trackingInfo.carrier}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <button
              onClick={() => exportContainerSupplierSummaryExcel(container, linkedOrders)}
              disabled={linkedOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Supplier Summary</span>
            </button>

            <button
              onClick={() => exportContainerPackingList(container, linkedOrders)}
              disabled={linkedOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Full Packing List</span>
            </button>

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all"
              title="Delete Container Plan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Container Shipment Lifecycle
          </span>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {CONTAINER_STAGES.map((stage, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <button
                  key={stage}
                  onClick={() => handleStatusChange(stage)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-500/30'
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

        {/* Milestone Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px]">Supplier WH Deadline</span>
            <strong className="text-slate-900">{formatDate(container.warehouse_delivery_deadline)}</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px]">Loading / Stuffing Date</span>
            <strong className="text-slate-900">{formatDate(container.container_loading_date)}</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px]">Departure (ETD)</span>
            <strong className="text-slate-900">{formatDate(container.etd)}</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block text-[10px]">Arrival (ETA)</span>
            <strong className="text-slate-900">{formatDate(container.eta)}</strong>
          </div>
        </div>
      </div>

      {/* Interactive 2D Container Volume & Stuffing Map */}
      <ContainerStuffingDiagram
        containerType={container.container_type}
        maxCbm={container.max_cbm}
        linkedOrders={linkedOrders}
        containerNumber={container.container_number}
      />

      {/* Financial & Payment Terms Rollup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <span>Container Financial & Payment Summary</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 p-4 rounded-xl">
            <span className="text-xs text-slate-500 block font-medium">Total Container Value (Goods)</span>
            <span className="text-xl font-black text-slate-900">{formatCNY(totalValueCny)}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Across {linkedOrders.length} supplier orders</span>
          </div>

          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
            <span className="text-xs text-emerald-700 block font-medium">Total Deposits Paid to Date</span>
            <span className="text-xl font-black text-emerald-700">{formatCNY(totalDepositsPaidCny)}</span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">
              {totalValueCny > 0 ? `${((totalDepositsPaidCny / totalValueCny) * 100).toFixed(1)}% paid` : '0%'}
            </span>
          </div>

          <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-100">
            <span className="text-xs text-rose-700 block font-medium">Remaining Balances Needed for Release</span>
            <span className="text-xl font-black text-rose-600">{formatCNY(totalBalanceDueCny)}</span>
            <span className="text-[11px] text-rose-600 block mt-0.5">Due before container release / loading</span>
          </div>
        </div>
      </div>

      {/* Executive Supplier Financial Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Supplier Financial & Commercial Terms Breakdown</span>
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated by supplier with store numbers, contacts, paid amounts, balance due, and payment terms
            </p>
          </div>

          <button
            onClick={() => exportContainerSupplierSummaryExcel(container, linkedOrders)}
            disabled={linkedOrders.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-2xs transition-all self-start sm:self-auto disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Summary (.xlsx)</span>
          </button>
        </div>

        {linkedOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No supplier data available. Attach purchase orders to this container.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Store / Shop #</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Market City</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Phone / WeChat</th>
                  <th className="py-3 px-3">PO Number(s)</th>
                  <th className="py-3 px-3">Order Total</th>
                  <th className="py-3 px-3">Paid to Date</th>
                  <th className="py-3 px-3">Balance Due</th>
                  <th className="py-3 px-3">Payment Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {aggregateContainerSuppliers(linkedOrders).map((s) => (
                  <tr key={s.supplierId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{s.shopNo}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{s.supplierName}</td>
                    <td className="py-3 px-3 text-slate-600">{s.marketCity}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{s.contactPerson}</td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-mono text-[11px]">{s.phone}</div>
                      {s.wechatId !== '-' && (
                        <div className="text-[10px] text-emerald-700 font-mono">WX: {s.wechatId}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 text-[11px] font-semibold">{s.poNumbers}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{formatCNY(s.totalAmountCny)}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{formatCNY(s.depositPaidCny)}</td>
                    <td className="py-3 px-3 font-bold text-rose-600">{formatCNY(s.balanceDueCny)}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md text-[11px] font-bold block max-w-[200px] truncate" title={s.paymentTerms}>
                        {s.paymentTerms}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Purchase Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Consolidated Purchase Orders ({linkedOrders.length})
            </h3>
            <p className="text-xs text-slate-500">All supplier orders stuffed inside this container</p>
          </div>

          <button
            onClick={() => setIsAttachModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Attach PO to Container</span>
          </button>
        </div>

        {linkedOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No purchase orders attached to this container yet. Click "Attach PO to Container" to consolidate orders.
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
                  <th className="py-3 px-4">Cartons & CBM</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Deposit Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">WH Delivery</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedOrders.map((po) => {
                  const val = Number(po.total_amount_cny || 0);
                  const dep = Number(po.deposit_paid_cny || 0);
                  const bal = Math.max(0, val - dep);

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{po.po_number}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{po.supplier?.name || '-'}</div>
                        <div className="text-[11px] text-slate-400">{po.supplier?.shop_no}</div>
                      </td>
                      <td className="py-3.5 px-4"><POStatusBadge status={po.status} /></td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md text-[10px] font-bold whitespace-nowrap">
                          {po.payment_terms || '30% Deposit'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {po.total_cartons} ctns • <span className="font-mono font-bold text-amber-800">{po.total_cbm.toFixed(2)} CBM</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{formatCNY(val)}</td>
                      <td className="py-3.5 px-4 text-emerald-600 font-semibold">{formatCNY(dep)}</td>
                      <td className="py-3.5 px-4 text-rose-600 font-semibold">{formatCNY(bal)}</td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(po.warehouse_delivery_date)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/orders/${po.id}`} className="text-blue-600 font-bold hover:underline">
                            View PO
                          </Link>
                          <button
                            onClick={() => handleDetachPO(po.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove from container"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attach PO Modal */}
      {isAttachModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Attach Unassigned Purchase Order</h3>
                <p className="text-xs text-slate-500">Select open POs to consolidate into this container</p>
              </div>
              <button
                onClick={() => setIsAttachModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            {availableOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No unassigned open POs available. Create new POs first.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {availableOrders.map((po) => (
                  <div
                    key={po.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-xs">{po.po_number}</strong>
                        <POStatusBadge status={po.status} />
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {po.supplier?.name} ({po.supplier?.shop_no})
                      </p>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {po.total_cartons} ctns • {po.total_cbm.toFixed(2)} CBM • {formatCNY(po.total_amount_cny)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAttachPO(po.id)}
                      disabled={attaching}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Attach
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Delete Container Confirmation Modal */}
      {isDeleteModalOpen && container && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Container Plan?</h3>
                <p className="text-xs text-slate-500">
                  This action will unlink all {linkedOrders.length} assigned POs back to ready state.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs text-slate-700 space-y-1">
              <strong className="block font-bold text-slate-900 font-mono">
                {container.container_number || 'Unassigned Container'} ({container.container_type})
              </strong>
              {container.bl_number && (
                <span className="text-slate-500 block">B/L: {container.bl_number}</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingContainer}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteContainer}
                disabled={deletingContainer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingContainer ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
