'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ERPItem, ERPItemImage } from '@/lib/types';
import { Search, X, Package, Check, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';

interface ERPItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ERPItem, imageUrl?: string) => void;
  selectedItemId?: number | null;
}

export function ERPItemPickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedItemId,
}: ERPItemPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ERPItem[]>([]);
  const [imagesMap, setImagesMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchERPItems();
  }, [isOpen]);

  const fetchERPItems = async (query = '') => {
    setLoading(true);
    try {
      let req = supabase
        .from('tbl_items')
        .select('*')
        .order('item_id', { ascending: false })
        .limit(40);

      if (query.trim()) {
        req = req.or(`code.ilike.%${query}%,item_name.ilike.%${query}%,description.ilike.%${query}%,upc.ilike.%${query}%`);
      }

      const { data: itemData, error } = await req;
      if (error) throw error;

      const fetchedItems = (itemData as ERPItem[]) || [];
      setItems(fetchedItems);

      // Fetch corresponding images from item_images
      if (fetchedItems.length > 0) {
        const itemIds = fetchedItems.map((i) => i.item_id);
        const { data: imgData } = await supabase
          .from('item_images')
          .select('ItemID, Thumb, View')
          .in('ItemID', itemIds);

        const imgMap: Record<number, string> = {};
        (imgData as ERPItemImage[] || []).forEach((row) => {
          let url: string | undefined;
          if (Array.isArray(row.Thumb) && row.Thumb.length > 0) {
            const first = row.Thumb[0];
            url = typeof first === 'string' ? first : first?.url;
          } else if (Array.isArray(row.View) && row.View.length > 0) {
            const first = row.View[0];
            url = typeof first === 'string' ? first : first?.url;
          }
          if (url) imgMap[row.ItemID] = url;
        });
        setImagesMap(imgMap);
      }
    } catch (err) {
      console.error('Error fetching ERP items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    const timeout = setTimeout(() => {
      fetchERPItems(val);
    }, 300);
    return () => clearTimeout(timeout);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Select Warehouse ERP Item</h3>
            <p className="text-xs text-slate-500">Search tbl_items from your linked inventory</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by SKU code, item name, UPC, or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">Loading warehouse items...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No warehouse items found matching "{searchTerm}"
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedItemId === item.item_id;
              const imgUrl = imagesMap[item.item_id];

              return (
                <div
                  key={item.item_id}
                  onClick={() => {
                    onSelect(item, imgUrl);
                    onClose();
                  }}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Item Thumbnail */}
                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgUrl}
                          alt={item.item_name || 'Item'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {item.code || `ID #${item.item_id}`}
                        </span>
                        {item.upc && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {item.upc}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5 font-medium">
                        {item.item_name || 'Unnamed Item'}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Stock: <strong className="text-slate-700">{formatNumber(item.qtty, 0)}</strong></span>
                        <span>Price: <strong className="text-slate-700">${formatNumber(item.price)}</strong></span>
                        {item.material && <span>Mat: {item.material}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isSelected ? (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <button className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
