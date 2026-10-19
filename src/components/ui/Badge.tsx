import React from 'react';
import { POStatus, ContainerStatus, LedgerEntryType } from '@/lib/types';

export function POStatusBadge({ status }: { status: POStatus }) {
  const styles: Record<POStatus, string> = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    'PO Issued': 'bg-blue-50 text-blue-700 border-blue-200',
    'Deposit Paid': 'bg-purple-50 text-purple-700 border-purple-200',
    'In Production': 'bg-amber-50 text-amber-700 border-amber-200',
    'Ready at Factory': 'bg-teal-50 text-teal-700 border-teal-200',
    'Delivered to WH': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Loaded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Received WH': 'bg-green-50 text-green-700 border-green-200',
    Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.Draft}`}>
      {status}
    </span>
  );
}

export function ContainerStatusBadge({ status }: { status: ContainerStatus }) {
  const styles: Record<ContainerStatus, string> = {
    Planning: 'bg-slate-100 text-slate-700 border-slate-200',
    'Consolidating at WH': 'bg-amber-50 text-amber-800 border-amber-200',
    Loading: 'bg-blue-50 text-blue-700 border-blue-200',
    'On Board': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'In Transit': 'bg-purple-50 text-purple-700 border-purple-200',
    'Arrived Port': 'bg-teal-50 text-teal-700 border-teal-200',
    'Customs Cleared': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Received WH': 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.Planning}`}>
      {status}
    </span>
  );
}

export function LedgerTypeBadge({ type }: { type: LedgerEntryType }) {
  if (type.startsWith('Credit')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        {type} (Owed)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      {type} (Paid)
    </span>
  );
}
