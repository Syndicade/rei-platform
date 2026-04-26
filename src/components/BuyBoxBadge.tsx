'use client';

// src/components/BuyBoxBadge.tsx

import { useEffect, useState } from 'react';
import { getPropertyMatches } from '@/lib/buyBoxEngine';
import type { MatchableProperty, BuyBoxMatch } from '@/types/buyBox';

interface Props {
  property: MatchableProperty;
  workspaceId: string;
}

export default function BuyBoxBadge({ property, workspaceId }: Props) {
  const [matches, setMatches] = useState<BuyBoxMatch[] | null>(null);

  useEffect(() => {
    getPropertyMatches(property, workspaceId).then(setMatches);
  }, [property.id, workspaceId]);

  if (matches === null) {
    return <span className="text-xs text-gray-300">...</span>;
  }

  const full = matches.filter((m) => m.isMatch).length;
  const best = matches[0]?.score ?? 0;

  if (matches.length === 0) {
    return <span className="text-xs text-gray-300">No boxes</span>;
  }

  if (full > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        {full} match{full !== 1 ? 'es' : ''}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
        best >= 50
          ? 'text-amber-700 bg-amber-50 border border-amber-200'
          : 'text-gray-400 bg-gray-50 border border-gray-100'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full inline-block ${
          best >= 50 ? 'bg-amber-400' : 'bg-gray-300'
        }`}
      />
      {best}% best
    </span>
  );
}
