'use client';

// src/app/dashboard/buy-boxes/new/page.tsx

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import BuyBoxForm from '../BuyBoxForm';

export default function NewBuyBoxPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .single()
      .then(({ data }) => setWorkspaceId(data?.workspace_id ?? null));
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">New Buy Box</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Define your investment criteria. Leave any field blank to treat it as "no restriction."
        </p>
      </div>

      {workspaceId ? (
        <BuyBoxForm workspaceId={workspaceId} />
      ) : (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      )}
    </div>
  );
}
