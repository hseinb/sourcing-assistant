'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  FileSpreadsheet,
  Container,
  Zap,
  DollarSign,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  fetchLiveExchangeRate,
  getStoredExchangeRate,
  setStoredExchangeRate,
  convertCNYtoUSD,
  convertUSDtoCNY,
} from '@/lib/utils/currency';
import { RapidMarketCaptureModal } from '@/components/items/RapidMarketCaptureModal';
import { formatCNY, formatUSD } from '@/lib/utils/formatters';

export function Navbar() {
  const [rate, setRate] = useState(7.25);
  const [rateSource, setRateSource] = useState<'live' | 'cache' | 'default'>('default');
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isRapidModalOpen, setIsRapidModalOpen] = useState(false);

  const [customRateInput, setCustomRateInput] = useState('7.25');
  const [calcCny, setCalcCny] = useState('100');
  const [calcUsd, setCalcUsd] = useState('');
  const [refreshingRate, setRefreshingRate] = useState(false);

  useEffect(() => {
    initRate();
  }, []);

  const initRate = async () => {
    const info = await fetchLiveExchangeRate();
    setRate(info.rate);
    setRateSource(info.source);
    setCustomRateInput(String(info.rate));
    setCalcUsd(String(convertCNYtoUSD(100, info.rate)));
  };

  const handleRefreshRate = async () => {
    setRefreshingRate(true);
    try {
      localStorage.removeItem('sourcing_rate_timestamp');
      const info = await fetchLiveExchangeRate();
      setRate(info.rate);
      setRateSource(info.source);
      setCustomRateInput(String(info.rate));
      setCalcUsd(String(convertCNYtoUSD(parseFloat(calcCny) || 100, info.rate)));
    } finally {
      setRefreshingRate(false);
    }
  };

  const handleApplyCustomRate = (e: React.FormEvent) => {
    e.preventDefault();
    const newRate = parseFloat(customRateInput);
    if (!isNaN(newRate) && newRate > 0) {
      setStoredExchangeRate(newRate);
      setRate(newRate);
      setRateSource('cache');
      setCalcUsd(String(convertCNYtoUSD(parseFloat(calcCny) || 100, newRate)));
      setIsRateModalOpen(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs no-print">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight hidden sm:block">
            Sourcing & Order Hub
          </h2>

          {/* Live Currency Rate Indicator Badge */}
          <button
            onClick={() => setIsRateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-colors border border-slate-200"
            title="Live USD / CNY Exchange Rate"
          >
            <span className="text-emerald-700 font-black">$1 = ¥{rate.toFixed(2)}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Walking Mode (Rapid Capture) */}
          <button
            type="button"
            onClick={() => setIsRapidModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-xs hover:brightness-105 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Walking Mode</span>
          </button>

          <Link
            href="/excel/import"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import Excel</span>
          </Link>

          <Link
            href="/containers/new"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            <Container className="w-3.5 h-3.5 text-amber-600" />
            <span>Prep Container</span>
          </Link>

          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New PO</span>
          </Link>
        </div>
      </header>

      {/* Exchange Rate Converter Modal */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative max-w-sm w-full bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  $¥
                </div>
                <h3 className="font-bold text-sm text-slate-900">Exchange Rate Engine</h3>
              </div>
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyCustomRate} className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Active Rate</span>
                  <strong className="text-sm font-mono text-slate-900">1 USD = {rate} CNY</strong>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshRate}
                  disabled={refreshingRate}
                  className="p-2 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-white transition-colors"
                  title="Fetch Live Rate"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingRate ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Custom Exchange Rate (RMB per 1 USD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={customRateInput}
                  onChange={(e) => setCustomRateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold"
                />
              </div>

              {/* Quick Conversion Calculator */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Quick Conversion
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">RMB (¥)</label>
                    <input
                      type="number"
                      value={calcCny}
                      onChange={(e) => {
                        setCalcCny(e.target.value);
                        setCalcUsd(String(convertCNYtoUSD(parseFloat(e.target.value) || 0, rate)));
                      }}
                      className="w-full px-2 py-1 bg-white border rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">USD ($)</label>
                    <input
                      type="number"
                      value={calcUsd}
                      onChange={(e) => {
                        setCalcUsd(e.target.value);
                        setCalcCny(String(convertUSDtoCNY(parseFloat(e.target.value) || 0, rate)));
                      }}
                      className="w-full px-2 py-1 bg-white border rounded text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                >
                  Save Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Walking Mode Rapid Capture Modal */}
      <RapidMarketCaptureModal
        isOpen={isRapidModalOpen}
        onClose={() => setIsRapidModalOpen(false)}
      />
    </>
  );
}
