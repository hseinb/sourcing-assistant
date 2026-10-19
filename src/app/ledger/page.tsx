'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SourcingLedgerEntry, SourcingSupplier, SourcingPurchaseOrder, LedgerEntryType } from '@/lib/types';
import {
  BookOpen,
  Plus,
  Search,
  DollarSign,
  Building2,
  Receipt,
  ExternalLink,
  Loader2,
  Calendar,
} from 'lucide-react';
import { formatCNY, formatUSD, formatNumber, formatDate } from '@/lib/utils/formatters';
import { LedgerTypeBadge } from '@/components/ui/Badge';
import { recalculatePOPaidAmounts } from '@/lib/ledger/syncLedger';

export default function LedgerPage() {
  const [entries, setEntries] = useState<SourcingLedgerEntry[]>([]);
  const [suppliers, setSuppliers] = useState<SourcingSupplier[]>([]);
  const [orders, setOrders] = useState<SourcingPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState('ALL');
  const [search, setSearch] = useState('');

  // New Transaction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    po_id: '',
    entry_type: 'Debit - Deposit' as LedgerEntryType,
    amount_cny: '',
    payment_method: 'WeChat Pay',
    reference_no: '',
    notes: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: eData, error: eErr } = await supabase
        .from('sourcing_supplier_ledger')
        .select('*, supplier:sourcing_suppliers(*)')
        .order('transaction_date', { ascending: false });
      if (eErr) throw eErr;
      setEntries((eData as SourcingLedgerEntry[]) || []);

      const { data: sData } = await supabase.from('sourcing_suppliers').select('*').order('name');
      setSuppliers((sData as SourcingSupplier[]) || []);

      const { data: poData } = await supabase.from('sourcing_purchase_orders').select('*').order('created_at', { ascending: false });
      setOrders((poData as SourcingPurchaseOrder[]) || []);
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount_cny);
    if (!form.supplier_id || isNaN(amt) || amt <= 0) {
      alert('Please fill out all required fields with a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPOId = form.po_id || null;
      const { error } = await supabase.from('sourcing_supplier_ledger').insert({
        supplier_id: form.supplier_id,
        po_id: selectedPOId,
        entry_type: form.entry_type,
        amount_cny: amt,
        payment_method: form.payment_method,
        reference_no: form.reference_no.trim() || null,
        notes: form.notes.trim() || null,
        transaction_date: form.transaction_date,
      });

      if (error) throw error;

      if (selectedPOId) {
        await recalculatePOPaidAmounts(selectedPOId);
      }

      setIsModalOpen(false);
      setForm({
        supplier_id: '',
        po_id: '',
        entry_type: 'Debit - Deposit',
        amount_cny: '',
        payment_method: 'WeChat Pay',
        reference_no: '',
        notes: '',
        transaction_date: new Date().toISOString().slice(0, 10),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to create transaction:', err);
      alert('Error recording transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSupplier = selectedSupplierId === 'ALL' || entry.supplier_id === selectedSupplierId;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (entry.supplier?.name && entry.supplier.name.toLowerCase().includes(q)) ||
      (entry.reference_no && entry.reference_no.toLowerCase().includes(q)) ||
      (entry.notes && entry.notes.toLowerCase().includes(q));

    return matchesSupplier && matchesSearch;
  });

  // Calculate totals
  let totalInvoicedCny = 0;
  let totalPaidCny = 0;
  entries.forEach((e) => {
    const amt = Number(e.amount_cny || 0);
    if (e.entry_type.startsWith('Credit')) totalInvoicedCny += amt;
    else if (e.entry_type.startsWith('Debit')) totalPaidCny += amt;
  });
  const balanceOwedCny = Math.max(0, totalInvoicedCny - totalPaidCny);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-rose-600" />
            <span>Supplier Accounting & Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Running Debit / Credit balance statements with Chinese wholesale suppliers (WeChat Pay, Alipay, TT Wire).
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment / Bill</span>
        </button>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Goods Invoiced</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{formatCNY(totalInvoicedCny)}</div>
          <span className="text-xs text-slate-500 mt-1 block">Value of all supplier orders</span>
        </div>

        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Paid / Deposits</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatCNY(totalPaidCny)}</div>
          <span className="text-xs text-emerald-700 mt-1 block">Transferred via WeChat/Alipay/TT</span>
        </div>

        <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">Net Outstanding Debt</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{formatCNY(balanceOwedCny)}</div>
          <span className="text-xs text-rose-700 mt-1 block">Total balance owed to Chinese vendors</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference #, supplier, or notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
          </div>

          <div>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="ALL">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.shop_no ? `(${s.shop_no})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
            <span className="text-xs">Loading ledger entries...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No transactions recorded yet. Click "Record Payment / Bill" to add an entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier & Shop #</th>
                  <th className="py-3 px-4">Entry Type</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Reference No</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Amount (RMB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{formatDate(entry.transaction_date)}</td>
                    <td className="py-3.5 px-4">
                      {entry.supplier ? (
                        <Link href={`/suppliers/${entry.supplier.id}`} className="font-bold text-slate-900 hover:text-blue-600">
                          {entry.supplier.name}
                        </Link>
                      ) : '-'}
                      <div className="text-[11px] text-slate-400">{entry.supplier?.shop_no}</div>
                    </td>
                    <td className="py-3.5 px-4"><LedgerTypeBadge type={entry.entry_type} /></td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{entry.payment_method || '-'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{entry.reference_no || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{entry.notes || '-'}</td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      <span className={entry.entry_type.startsWith('Credit') ? 'text-rose-600' : 'text-emerald-600'}>
                        {entry.entry_type.startsWith('Credit') ? '+' : '-'}{formatCNY(entry.amount_cny)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment / Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Record Payment / Invoice</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
                Close
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chinese Supplier *</label>
                <select
                  required
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.shop_no ? `(${s.shop_no})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Entry Type</label>
                <select
                  value={form.entry_type}
                  onChange={(e) => setForm({ ...form, entry_type: e.target.value as any })}
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
              {form.supplier_id && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link to Purchase Order (Optional / Recommended)
                  </label>
                  <select
                    value={form.po_id}
                    onChange={(e) => {
                      const poId = e.target.value;
                      const matchedPO = orders.find((o) => o.id === poId);
                      let suggestedAmt = form.amount_cny;
                      let refNo = form.reference_no;
                      let notes = form.notes;

                      if (matchedPO) {
                        refNo = refNo || matchedPO.po_number;
                        if (!suggestedAmt) {
                          if (form.entry_type.includes('Deposit')) {
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

                      setForm({
                        ...form,
                        po_id: poId,
                        amount_cny: suggestedAmt,
                        reference_no: refNo,
                        notes: notes,
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- No specific PO (General Supplier Payment/Invoice) --</option>
                    {orders
                      .filter((po) => po.supplier_id === form.supplier_id)
                      .map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} — Total: {formatCNY(po.total_amount_cny)} (Dep Paid: {formatCNY(po.deposit_paid_cny || 0)} / Bal Due: {formatCNY(po.balance_due_cny || po.total_amount_cny)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (RMB ¥) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={form.amount_cny}
                  onChange={(e) => setForm({ ...form, amount_cny: e.target.value })}
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
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
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference No / Trans ID</label>
                <input
                  type="text"
                  value={form.reference_no}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                  placeholder="e.g. WX-2026-0831"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Balance settlement for 40HQ container"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
