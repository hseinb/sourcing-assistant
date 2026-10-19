'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  Building2,
  Package,
  ShoppingCart,
  Container,
  BookOpen,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate, getCMATrackingUrl } from '@/lib/utils/formatters';
import { POStatusBadge, ContainerStatusBadge } from '@/components/ui/Badge';
import { CBMUtilizationBar } from '@/components/containers/CBMUtilizationBar';
import { SourcingContainer, SourcingPurchaseOrder, SourcingSupplier } from '@/lib/types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    supplierCount: 0,
    itemCount: 0,
    unlinkedItemCount: 0,
    activePoCount: 0,
    totalOwedCny: 0,
    totalPaidCny: 0,
  });
  const [activeContainers, setActiveContainers] = useState<SourcingContainer[]>([]);
  const [recentOrders, setRecentOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<SourcingSupplier[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Supplier count
      const { count: supplierCount } = await supabase
        .from('sourcing_suppliers')
        .select('*', { count: 'exact', head: true });

      // 2. Sourced Items count
      const { count: itemCount } = await supabase
        .from('sourcing_items')
        .select('*', { count: 'exact', head: true });

      const { count: unlinkedItemCount } = await supabase
        .from('sourcing_items')
        .select('*', { count: 'exact', head: true })
        .is('erp_item_id', null);

      // 3. Active POs
      const { data: pos } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(name, shop_no)')
        .not('status', 'in', '("Received WH","Cancelled")')
        .order('created_at', { ascending: false })
        .limit(6);

      // 4. Containers in planning / loading / transit
      const { data: containers } = await supabase
        .from('sourcing_containers')
        .select('*')
        .not('status', 'in', '("Received WH")')
        .order('created_at', { ascending: false })
        .limit(3);

      // 5. Financial Ledger rollups
      const { data: ledgerEntries } = await supabase
        .from('sourcing_supplier_ledger')
        .select('entry_type, amount_cny');

      let totalInvoicedCny = 0;
      let totalPaidCny = 0;
      (ledgerEntries || []).forEach((e) => {
        const amt = Number(e.amount_cny || 0);
        if (e.entry_type.startsWith('Credit')) {
          totalInvoicedCny += amt;
        } else if (e.entry_type.startsWith('Debit')) {
          totalPaidCny += amt;
        }
      });

      // 6. Top active suppliers
      const { data: suppliers } = await supabase
        .from('sourcing_suppliers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      setStats({
        supplierCount: supplierCount || 0,
        itemCount: itemCount || 0,
        unlinkedItemCount: unlinkedItemCount || 0,
        activePoCount: (pos || []).length,
        totalOwedCny: Math.max(0, totalInvoicedCny - totalPaidCny),
        totalPaidCny,
      });

      setRecentOrders((pos as SourcingPurchaseOrder[]) || []);
      setActiveContainers((containers as SourcingContainer[]) || []);
      setTopSuppliers((suppliers as SourcingSupplier[]) || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading Sourcing Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-700">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-amber-400">
            China Sourcing & Order Command Center
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Welcome back
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Tracking Chinese wholesale suppliers, container packing lists, and multi-currency balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/excel/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel / Images</span>
          </Link>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </Link>
          <Link
            href="/containers/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-all"
          >
            <Container className="w-4 h-4" />
            <span>Prep Container</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Suppliers */}
        <Link
          href="/suppliers"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suppliers & Shops</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{stats.supplierCount}</div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Yiwu, Guangzhou & Factories</span>
            <ArrowRight className="w-3 h-3 text-blue-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </Link>

        {/* Sourced Items */}
        <Link
          href="/items"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-200 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sourced Items</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{stats.itemCount}</div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {stats.unlinkedItemCount > 0 ? (
              <span className="text-amber-600 font-medium">{stats.unlinkedItemCount} unlinked to ERP</span>
            ) : (
              <span className="text-emerald-600 font-medium">All linked to ERP</span>
            )}
            <ArrowRight className="w-3 h-3 text-purple-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </Link>

        {/* Active Orders */}
        <Link
          href="/orders"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active POs in China</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{stats.activePoCount}</div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>In production / warehouse</span>
            <ArrowRight className="w-3 h-3 text-amber-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </Link>

        {/* Supplier Outstanding Balance */}
        <Link
          href="/ledger"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-rose-200 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">{formatCNY(stats.totalOwedCny)}</div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Total Paid: {formatCNY(stats.totalPaidCny)}</span>
            <ArrowRight className="w-3 h-3 text-rose-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </Link>
      </div>

      {/* Active Containers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Container className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-900">Active Container Prepping & Shipping</h2>
          </div>
          <Link
            href="/containers"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View All Containers <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {activeContainers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Container className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">No Active Containers Prepping</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Group purchase orders across different Chinese suppliers into a consolidated 20GP, 40GP, or 40HQ container packing list.
            </p>
            <Link
              href="/containers/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Container Plan</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeContainers.map((container) => (
              <div
                key={container.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900">
                          {container.container_number || 'Unnamed Container Plan'}
                        </h3>
                        <ContainerStatusBadge status={container.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {container.shipping_line} • {container.loading_warehouse_location || 'Yiwu WH'}
                      </p>
                    </div>

                    {container.container_number && (
                      <a
                        href={getCMATrackingUrl(container.container_number)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-amber-400 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shrink-0"
                      >
                        <span>Track CMA</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Dates & Milestones */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[11px]">WH Deadline:</span>
                      <strong className="text-slate-800 font-semibold">{formatDate(container.warehouse_delivery_deadline)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Loading Date:</span>
                      <strong className="text-slate-800 font-semibold">{formatDate(container.container_loading_date)}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Type: <strong className="text-slate-800">{container.container_type} ({container.max_cbm} CBM)</strong>
                  </span>
                  <Link
                    href={`/containers/${container.id}`}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Recent Purchase Orders</h2>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            All Orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No active purchase orders found. Click "New Purchase Order" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier / Shop #</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cartons / CBM</th>
                  <th className="py-3 px-4">Total (RMB)</th>
                  <th className="py-3 px-4">Delivery Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{order.po_number}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{order.supplier?.name || '-'}</div>
                      <div className="text-[11px] text-slate-400">{order.supplier?.shop_no}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <POStatusBadge status={order.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-semibold text-slate-800">{order.total_cartons} ctns</span> • {order.total_cbm.toFixed(2)} CBM
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCNY(order.total_amount_cny)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{formatDate(order.warehouse_delivery_date)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
