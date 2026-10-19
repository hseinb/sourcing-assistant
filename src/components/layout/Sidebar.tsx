'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  Container,
  BookOpen,
  FileSpreadsheet,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Suppliers & Shops', href: '/suppliers', icon: Building2 },
  { label: 'Sourced Items', href: '/items', icon: Package },
  { label: 'Purchase Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Container Prepping', href: '/containers', icon: Container, highlight: true },
  { label: 'Supplier Ledger', href: '/ledger', icon: BookOpen },
  { label: 'Excel Import / Parser', href: '/excel/import', icon: FileSpreadsheet },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar (100% Fixed & Frozen to Viewport) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 border-r border-slate-800 fixed inset-y-0 left-0 z-40 no-print">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/30">
              SA
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                Sourcing Assistant
              </h1>
              <p className="text-xs text-amber-400 font-medium">China Wholesale & Factory</p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto min-h-0">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : item.highlight ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.highlight && !active && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    CMA
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Market Shortcuts & Status */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs shrink-0">
          <div className="flex items-center justify-between text-slate-400 mb-2 font-medium">
            <span>Sourcing Hubs</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Synced
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-slate-400">
            <span className="px-2 py-1 bg-slate-800/60 rounded text-[11px] text-center border border-slate-700/40">
              Yiwu (义乌)
            </span>
            <span className="px-2 py-1 bg-slate-800/60 rounded text-[11px] text-center border border-slate-700/40">
              Guangzhou (广州)
            </span>
            <span className="px-2 py-1 bg-slate-800/60 rounded text-[11px] text-center border border-slate-700/40">
              Shantou (汕头)
            </span>
            <span className="px-2 py-1 bg-slate-800/60 rounded text-[11px] text-center border border-slate-700/40">
              Foshan (佛山)
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-300 px-2 py-1 flex items-center justify-around no-print">
        <Link
          href="/"
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            isActive('/') ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>
        <Link
          href="/suppliers"
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            isActive('/suppliers') ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5" />
          <span>Shops</span>
        </Link>
        <Link
          href="/items"
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            isActive('/items') ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>Items</span>
        </Link>
        <Link
          href="/containers"
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            isActive('/containers') ? 'text-amber-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Container className="w-5 h-5 mb-0.5" />
          <span>Container</span>
        </Link>
        <Link
          href="/ledger"
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            isActive('/ledger') ? 'text-blue-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Ledger</span>
        </Link>
      </nav>
    </>
  );
}
