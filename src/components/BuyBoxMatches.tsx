'use client';

// src/components/BuyBoxMatches.tsx

import { useEffect, useState } from 'react';
import { getPropertyMatches } from '@/lib/buyBoxEngine';
import type { BuyBoxMatch, MatchableProperty } from '@/types/buyBox';

interface Props {
  property: MatchableProperty;
  workspaceId: string;
}

export default function BuyBoxMatches({ property, workspaceId }: Props) {
  const [matches, setMatches] = useState<BuyBoxMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getPropertyMatches(property, workspaceId).then((results) => {
      setMatches(results);
      setLoading(false);
    });
  }, [property.id, workspaceId]);

  if (loading) {
    return (
      <Section>
        <p className="text-sm text-gray-400">Evaluating buy boxes...</p>
      </Section>
    );
  }

  if (matches.length === 0) {
    return (
      <Section>
        <p className="text-sm text-gray-400">
          No active buy boxes.{' '}
          <a href="/dashboard/buy-boxes/new" className="text-blue-600 hover:underline">
            Create one
          </a>
        </p>
      </Section>
    );
  }

  return (
    <Section>
      {/* Summary banner */}
      <div className="flex items-center gap-3 mb-4">
        {matches.filter((m) => m.isMatch).length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {matches.filter((m) => m.isMatch).length} buy box match
            {matches.filter((m) => m.isMatch).length !== 1 ? 'es' : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
            No full matches
          </span>
        )}
        <span className="text-xs text-gray-400">
          {matches.length} buy box{matches.length !== 1 ? 'es' : ''} evaluated
        </span>
      </div>

      {/* Match cards */}
      <div className="space-y-2">
        {matches.map((m) => (
          <MatchCard
            key={m.buyBox.id}
            match={m}
            isExpanded={expanded === m.buyBox.id}
            onToggle={() =>
              setExpanded((prev) => (prev === m.buyBox.id ? null : m.buyBox.id))
            }
          />
        ))}
      </div>
    </Section>
  );
}

function MatchCard({
  match,
  isExpanded,
  onToggle,
}: {
  match: BuyBoxMatch;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { buyBox, isMatch, score, passedCount, totalCount, criteria } = match;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isMatch
          ? 'border-green-200 bg-green-50'
          : score >= 50
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isMatch
                ? 'bg-green-200 text-green-800'
                : score >= 50
                ? 'bg-amber-200 text-amber-800'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {score}%
          </span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {buyBox.name}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {passedCount}/{totalCount} criteria
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isMatch ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && criteria.length > 0 && (
        <div className="border-t border-current border-opacity-10 px-4 pb-3 pt-2 space-y-1.5">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                  c.passed ? 'bg-green-500' : 'bg-red-400'
                }`}
              >
                {c.passed ? '✓' : '✗'}
              </span>
              <div>
                <span className="font-medium text-gray-700">{c.label}: </span>
                <span className="text-gray-500">{c.explanation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isExpanded && criteria.length === 0 && (
        <div className="border-t border-current border-opacity-10 px-4 py-3">
          <p className="text-xs text-gray-400 italic">
            No criteria configured -- property automatically matches.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Buy Box Matches</h2>
      {children}
    </div>
  );
}
