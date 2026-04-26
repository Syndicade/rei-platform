'use client';

// src/app/dashboard/buy-boxes/page.tsx

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import type { BuyBox } from '@/types/buyBox';

export default function BuyBoxesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [buyBoxes, setBuyBoxes] = useState<BuyBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('buy_boxes')
      .select('*')
      .order('created_at', { ascending: true });
    setBuyBoxes(data ?? []);
    setLoading(false);
  }

  async function toggleActive(bb: BuyBox) {
    setTogglingId(bb.id);
    await supabase
      .from('buy_boxes')
      .update({ is_active: !bb.is_active })
      .eq('id', bb.id);
    setBuyBoxes((prev) =>
      prev.map((b) => (b.id === bb.id ? { ...b, is_active: !b.is_active } : b))
    );
    setTogglingId(null);
  }

  async function deleteBuyBox(id: string) {
    if (!confirm('Delete this buy box? This cannot be undone.')) return;
    setDeletingId(id);
    await supabase.from('buy_boxes').delete().eq('id', id);
    setBuyBoxes((prev) => prev.filter((b) => b.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Buy Boxes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Saved investment criteria used to score and filter properties.
          </p>
        </div>
        <Link
          href="/dashboard/buy-boxes/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Buy Box
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading...</div>
      ) : buyBoxes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No buy boxes yet</h3>
          <p className="text-sm text-gray-400 mb-4">
            Create your first buy box to start matching properties against your investment criteria.
          </p>
          <Link
            href="/dashboard/buy-boxes/new"
            className="inline-flex px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Buy Box
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {buyBoxes.map((bb) => (
            <BuyBoxCard
              key={bb.id}
              bb={bb}
              onToggle={() => toggleActive(bb)}
              onDelete={() => deleteBuyBox(bb.id)}
              toggling={togglingId === bb.id}
              deleting={deletingId === bb.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuyBoxCard({
  bb, onToggle, onDelete, toggling, deleting,
}: {
  bb: BuyBox;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
  deleting: boolean;
}) {
  const chips = buildChips(bb);

  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-colors ${
        bb.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900 text-sm">{bb.name}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                bb.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {bb.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">No criteria configured</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            disabled={toggling}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {toggling ? '...' : bb.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <Link
            href={`/dashboard/buy-boxes/${bb.id}/edit`}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-xs px-3 py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildChips(bb: BuyBox): string[] {
  const chips: string[] = [];

  if (bb.property_types?.length)
    chips.push(bb.property_types.join(' / '));

  if (bb.min_price !== null && bb.max_price !== null)
    chips.push(`$${fmt(bb.min_price)} - $${fmt(bb.max_price)}`);
  else if (bb.min_price !== null)
    chips.push(`>= $${fmt(bb.min_price)}`);
  else if (bb.max_price !== null)
    chips.push(`<= $${fmt(bb.max_price)}`);

  if (bb.max_arv_ratio !== null)
    chips.push(`<= ${(bb.max_arv_ratio * 100).toFixed(0)}% ARV`);

  if (bb.min_bedrooms !== null || bb.max_bedrooms !== null) {
    const lo = bb.min_bedrooms ?? '?';
    const hi = bb.max_bedrooms ?? '?';
    chips.push(bb.max_bedrooms === null ? `>= ${lo} bed` : `${lo}-${hi} bed`);
  }

  if (bb.min_sqft !== null)
    chips.push(`>= ${bb.min_sqft.toLocaleString()} sqft`);

  if (bb.min_year_built !== null)
    chips.push(`Built >= ${bb.min_year_built}`);

  if (bb.max_hoa !== null)
    chips.push(`HOA <= $${bb.max_hoa}/mo`);

  if (bb.occupancy_statuses?.length)
    chips.push(bb.occupancy_statuses.join(' / '));

  if (bb.zip_codes?.length)
    chips.push(`Zips: ${bb.zip_codes.slice(0, 3).join(', ')}${bb.zip_codes.length > 3 ? '...' : ''}`);

  if (bb.counties?.length)
    chips.push(`${bb.counties.join(', ')} Co.`);

  return chips;
}

function fmt(n: number) {
  return n.toLocaleString();
}
