'use client';

// src/app/dashboard/buy-boxes/[id]/edit/page.tsx

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import BuyBoxForm from '../../BuyBoxForm';
import type { BuyBox } from '@/types/buyBox';

export default function EditBuyBoxPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [buyBox, setBuyBox] = useState<BuyBox | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: bb }, { data: wm }] = await Promise.all([
        supabase.from('buy_boxes').select('*').eq('id', id).single(),
        supabase.from('workspace_members').select('workspace_id').single(),
      ]);
      setBuyBox(bb);
      setWorkspaceId(wm?.workspace_id ?? null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 text-center">Loading...</div>;
  }

  if (!buyBox || !workspaceId) {
    return <div className="p-6 text-sm text-red-500 text-center">Buy box not found.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Edit: {buyBox.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Leave any field blank to treat it as "no restriction."
        </p>
      </div>

      <BuyBoxForm
        workspaceId={workspaceId}
        initial={buyBox}
        buyBoxId={id}
      />
    </div>
  );
}
