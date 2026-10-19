'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingContainer, SourcingPurchaseOrder } from '@/lib/types';
import {
  FileSpreadsheet,
  Download,
  Container,
  ShoppingCart,
  Building2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { exportContainerPackingList, exportPurchaseOrderExcel } from '@/lib/excel/exporter';
import { formatCNY, formatDate } from '@/lib/utils/formatters';

export default function ExcelExportPage() {
  const [containers, setContainers] = useState<SourcingContainer[]>([]);
  const [orders, setOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExportData();
  }, []);

  const fetchExportData = async () => {
    setLoading(true);
    try {
      const { data: cData } = await supabase
        .from('sourcing_containers')
        .select('*')
        .order('created_at', { ascending: false });
      setContainers((cData as SourcingContainer[]) || []);

      const { data: poData } = await supabase
        .from('sourcing_purchase_orders')
        .select('*, supplier:sourcing_suppliers(*), items:sourcing_purchase_order_items(*, sourcing_item:sourcing_items(*))')
        .order('created_at', { ascending: false });
      setOrders((poData as SourcingPurchaseOrder[]) || []);
    } catch (err) {
      console.error('Error fetching export lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportContainer = async (container: SourcingContainer) => {
    // Fetch linked POs with items
    const { data: linkedPos } = await supabase
      .from('sourcing_purchase_orders')
      .select('*, supplier:sourcing_suppliers(*), items:sourcing_purchase_order_items(*, sourcing_item:sourcing_items(*))')
      .eq('container_id', container.id);

    exportContainerPackingList(container, (linkedPos as SourcingPurchaseOrder[]) || []);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-xs">Loading export templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <span>Excel Export & Packing List Generator</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Download formatted Excel files for freight forwarders, container stuffing, and warehouse receiving.
        </p>
      </div>

      {/* Section 1: Container Packing Lists */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Container className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900">Master Container Packing Lists</h2>
        </div>
        <p className="text-xs text-slate-500">
          Consolidated spreadsheets with combined multi-supplier carton numbering, CBM totals, and shipping marks.
        </p>

        {containers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
            No containers found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {containers.map((c) => (
              <div key={c.id} className="py-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-slate-900 text-sm">{c.container_number || 'Unnamed Plan'}</strong>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.container_type} ({c.max_cbm} CBM) • {c.shipping_line} • Loading: {formatDate(c.container_loading_date)}
                  </div>
                </div>

                <button
                  onClick={() => handleExportContainer(c)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Packing List</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Purchase Order Templates */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Individual Purchase Order Sheets</h2>
        </div>
        <p className="text-xs text-slate-500">
          Standardized purchase order files formatted for Chinese suppliers and office accounting.
        </p>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
            No purchase orders found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {orders.map((po) => (
              <div key={po.id} className="py-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 text-sm">{po.po_number}</strong>
                    <span className="text-xs text-slate-500 font-semibold">{po.supplier?.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {po.total_cartons} ctns • {po.total_cbm.toFixed(2)} CBM • {formatCNY(po.total_amount_cny)}
                  </div>
                </div>

                <button
                  onClick={() => exportPurchaseOrderExcel(po)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PO Excel</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
