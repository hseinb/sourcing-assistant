'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ContainerType, ContainerStatus } from '@/lib/types';
import {
  Container,
  ArrowLeft,
  Save,
  Ship,
} from 'lucide-react';
import { getContainerMaxCBM } from '@/lib/utils/formatters';

export default function NewContainerPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    container_number: '',
    seal_number: '',
    bl_number: '',
    container_type: '40HQ' as ContainerType,
    max_cbm: 68.0,
    shipping_line: 'CMA CGM',
    status: 'Planning' as ContainerStatus,
    warehouse_delivery_deadline: '',
    container_loading_date: '',
    etd: '',
    eta: '',
    forwarder_name: '',
    forwarder_contact: '',
    loading_warehouse_location: 'Yiwu Consolidator Warehouse',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleTypeChange = (type: ContainerType) => {
    const cbm = getContainerMaxCBM(type);
    setForm({ ...form, container_type: type, max_cbm: cbm });
  };

  const handleCreateContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('sourcing_containers')
        .insert({
          container_number: form.container_number.trim() || null,
          seal_number: form.seal_number.trim() || null,
          bl_number: form.bl_number.trim() || null,
          container_type: form.container_type,
          max_cbm: form.max_cbm,
          shipping_line: form.shipping_line || 'CMA CGM',
          status: form.status,
          warehouse_delivery_deadline: form.warehouse_delivery_deadline || null,
          container_loading_date: form.container_loading_date || null,
          etd: form.etd || null,
          eta: form.eta || null,
          forwarder_name: form.forwarder_name.trim() || null,
          forwarder_contact: form.forwarder_contact.trim() || null,
          loading_warehouse_location: form.loading_warehouse_location.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      router.push(`/containers/${data.id}`);
    } catch (err) {
      console.error('Error creating container:', err);
      alert('Failed to create container plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href="/containers"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Containers</span>
      </Link>

      <form onSubmit={handleCreateContainer} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-amber-600">Container Prepping</span>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">Plan New Container Consolidation</h1>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Creating...' : 'Create Container Plan'}</span>
          </button>
        </div>

        {/* Container Type Selector including 45HQ */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Container Type & Volume Capacity</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { type: '20GP' as ContainerType, cbm: 28, desc: '20ft Standard' },
              { type: '40GP' as ContainerType, cbm: 58, desc: '40ft Standard' },
              { type: '40HQ' as ContainerType, cbm: 68, desc: '40ft High Cube' },
              { type: '45HQ' as ContainerType, cbm: 78, desc: '45ft High Cube' },
              { type: 'LCL' as ContainerType, cbm: 100, desc: 'Loose Cargo' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleTypeChange(item.type)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.container_type === item.type
                    ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-400/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <strong className="block text-sm font-black">{item.type}</strong>
                <span className="text-xs text-slate-500 font-semibold">{item.cbm} CBM</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Container Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Container Number (CMA CGM / Line)</label>
            <input
              type="text"
              value={form.container_number}
              onChange={(e) => setForm({ ...form, container_number: e.target.value })}
              placeholder="e.g. CMAU1234567"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shipping Line</label>
            <select
              value={form.shipping_line}
              onChange={(e) => setForm({ ...form, shipping_line: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="CMA CGM">CMA CGM (Primary)</option>
              <option value="MSC">MSC</option>
              <option value="Maersk">Maersk</option>
              <option value="COSCO">COSCO Shipping</option>
              <option value="ONE">Ocean Network Express (ONE)</option>
              <option value="Evergreen">Evergreen</option>
              <option value="Other">Other Shipping Line</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Seal Number</label>
            <input
              type="text"
              value={form.seal_number}
              onChange={(e) => setForm({ ...form, seal_number: e.target.value })}
              placeholder="e.g. SL-998241"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Master Bill of Lading (B/L) #</label>
            <input
              type="text"
              value={form.bl_number}
              onChange={(e) => setForm({ ...form, bl_number: e.target.value })}
              placeholder="e.g. CMA-BL-20260831"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Consolidation WH Delivery Deadline
            </label>
            <input
              type="date"
              value={form.warehouse_delivery_deadline}
              onChange={(e) => setForm({ ...form, warehouse_delivery_deadline: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Container Loading / Stuffing Date</label>
            <input
              type="date"
              value={form.container_loading_date}
              onChange={(e) => setForm({ ...form, container_loading_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ETD (Departure Date)</label>
            <input
              type="date"
              value={form.etd}
              onChange={(e) => setForm({ ...form, etd: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ETA (Arrival Date)</label>
            <input
              type="date"
              value={form.eta}
              onChange={(e) => setForm({ ...form, eta: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Loading Warehouse Location in China</label>
            <input
              type="text"
              value={form.loading_warehouse_location}
              onChange={(e) => setForm({ ...form, loading_warehouse_location: e.target.value })}
              placeholder="e.g. Yiwu Consolidator WH #4, Chouzhou Road"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Consolidation Notes / Remarks</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Customs agent, forwarder details, stuffing sequence..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
