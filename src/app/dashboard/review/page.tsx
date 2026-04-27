'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { getPropertyMatches } from '@/lib/buyBoxEngine'
import type { BuyBoxMatch } from '@/types/buyBox'
import type { ReviewAction, PropertyReview } from '@/types/propertyReview'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewableProperty {
  id: string
  address: string
  city: string
  state: string
  zip: string
  county: string | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  year_built: number | null
  list_price: number | null
  opening_bid: number | null
  arv: number | null
  hoa_monthly: number | null
  occupancy_status: string | null
  pipeline_status: string
}

interface QueueEntry {
  property: ReviewableProperty
  matches: BuyBoxMatch[]
  review: PropertyReview | null
}

type Tab = 'queue' | 'saved'

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | null | undefined, prefix = '$') {
  if (n == null) return '—'
  return prefix + n.toLocaleString()
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function snoozeExpired(review: PropertyReview | null): boolean {
  if (!review || review.action !== 'Snooze') return true
  if (!review.snoozed_until) return true
  return review.snoozed_until < today()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
      <span className="text-gray-400">{label}</span>
      {value}
    </span>
  )
}

function MatchCard({ match }: { match: BuyBoxMatch }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round(match.score)
  const color = match.isMatch
    ? 'border-emerald-200 bg-emerald-50'
    : pct >= 50
    ? 'border-amber-200 bg-amber-50'
    : 'border-gray-200 bg-gray-50'
  const badgeColor = match.isMatch
    ? 'bg-emerald-100 text-emerald-700'
    : pct >= 50
    ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-200 text-gray-500'

  return (
    <div className={`border rounded-lg ${color} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColor}`}>
            {match.isMatch ? '✓ Match' : `${pct}%`}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">
            {match.buyBox.name}
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {match.passedCount}/{match.totalCount} criteria
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Score bar */}
      <div className="h-1 w-full bg-white/60">
        <div
          className={`h-full transition-all ${match.isMatch ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && (
        <div className="px-3 py-2 space-y-1 bg-white/40">
          {match.criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 flex-shrink-0 font-bold ${c.passed ? 'text-emerald-500' : 'text-red-400'}`}>
                {c.passed ? '✓' : '✗'}
              </span>
              <span className="text-gray-600">{c.explanation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SnoozeModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (date: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Snooze until</h3>
        <p className="text-sm text-gray-500 mb-4">
          This property will reappear in the queue after the selected date.
        </p>
        <input
          type="date"
          value={date}
          min={today()}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(date)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Snooze
          </button>
        </div>
      </div>
    </div>
  )
}

function PropertyCard({
  entry,
  onAction,
  saved = false,
}: {
  entry: QueueEntry
  onAction: (propertyId: string, action: ReviewAction, extra?: { snoozed_until?: string; dismissed_price?: number }) => Promise<void>
  saved?: boolean
}) {
  const { property, matches, review } = entry
  const [snoozing, setSnoozing] = useState(false)
  const [loading, setLoading] = useState<ReviewAction | null>(null)

  const fullMatches = matches.filter(m => m.isMatch)
  const price = property.list_price ?? property.opening_bid

  async function handle(action: ReviewAction, extra?: { snoozed_until?: string; dismissed_price?: number }) {
    setLoading(action)
    await onAction(property.id, action, extra)
    setLoading(null)
  }

  return (
    <>
      {snoozing && (
        <SnoozeModal
          onConfirm={async date => {
            setSnoozing(false)
            await handle('Snooze', { snoozed_until: date })
          }}
          onCancel={() => setSnoozing(false)}
        />
      )}

      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${saved ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
        {saved && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700">Saved</span>
          </div>
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 leading-tight">{property.address}</h3>
              <p className="text-sm text-gray-500">{property.city}, {property.state} {property.zip}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-gray-900">{fmt(price)}</div>
              {property.arv && (
                <div className="text-xs text-gray-400">ARV {fmt(property.arv)}</div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {property.property_type && <StatPill label="" value={property.property_type} />}
            {property.bedrooms != null && <StatPill label="bd" value={String(property.bedrooms)} />}
            {property.bathrooms != null && <StatPill label="ba" value={String(property.bathrooms)} />}
            {property.sqft != null && <StatPill label="sqft" value={property.sqft.toLocaleString()} />}
            {property.year_built != null && <StatPill label="built" value={String(property.year_built)} />}
            {property.county && <StatPill label="county" value={property.county} />}
            {property.occupancy_status && <StatPill label="" value={property.occupancy_status} />}
            {property.arv && price && (
              <StatPill label="ratio" value={`${Math.round((price / property.arv) * 100)}%`} />
            )}
          </div>

          {/* Match summary */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {fullMatches.length > 0
                ? `${fullMatches.length} full match${fullMatches.length > 1 ? 'es' : ''}`
                : 'Partial matches only'}
            </p>
            <div className="space-y-1.5">
              {matches.map((m, i) => (
                <MatchCard key={i} match={m} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            {!saved && (
              <button
                onClick={() => handle('Save')}
                disabled={loading !== null}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'Save' ? '…' : '✓ Save'}
              </button>
            )}
            {saved && (
              <button
                onClick={() => handle('Dismiss')}
                disabled={loading !== null}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {loading === 'Dismiss' ? '…' : 'Unsave'}
              </button>
            )}
            {!saved && (
              <>
                <button
                  onClick={() => setSnoozing(true)}
                  disabled={loading !== null}
                  className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {loading === 'Snooze' ? '…' : '⏱ Snooze'}
                </button>
                <button
                  onClick={() => handle('Dismiss')}
                  disabled={loading !== null}
                  className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {loading === 'Dismiss' ? '…' : 'Dismiss'}
                </button>
                <button
                  onClick={() => handle('DismissUnlessChanged', { dismissed_price: price ?? undefined })}
                  disabled={loading !== null}
                  className="flex-1 min-w-[120px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors text-center"
                  title="Resurface if the price changes"
                >
                  {loading === 'DismissUnlessChanged' ? '…' : 'Dismiss if unchanged'}
                </button>
              </>
            )}
            <a
              href={`/dashboard/properties/${property.id}`}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              View →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReviewQueuePage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [allEntries, setAllEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('queue')

  // Load workspace + all data
  const load = useCallback(async () => {
    setLoading(true)

    // 1. Get workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()
    if (!member) { setLoading(false); return }

    const wsId = member.workspace_id
    setWorkspaceId(wsId)

    // 2. Fetch all properties
    const { data: properties } = await supabase
      .from('properties')
      .select(`
        id, address, city, state, zip, county,
        property_type, bedrooms, bathrooms, sqft,
        year_built, list_price, opening_bid, arv,
        hoa_monthly, occupancy_status, pipeline_status
      `)
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })

    if (!properties || properties.length === 0) { setLoading(false); return }

    // 3. Fetch existing reviews
    const { data: reviews } = await supabase
      .from('property_reviews')
      .select('*')
      .eq('workspace_id', wsId)

    const reviewMap: Record<string, PropertyReview> = {}
    for (const r of reviews ?? []) reviewMap[r.property_id] = r

    // 4. Run buy box matching for each property
    const entries: QueueEntry[] = []

    await Promise.all(
      properties.map(async (prop) => {
        const matches = await getPropertyMatches(prop as any, wsId)
        const hasFullMatch = matches.some(m => m.isMatch)
        if (!hasFullMatch) return

        const review = reviewMap[prop.id] ?? null
        entries.push({ property: prop as ReviewableProperty, matches, review })
      })
    )

    // Sort: saved first (within saved tab), then by match count
    entries.sort((a, b) => {
      const aMatches = a.matches.filter(m => m.isMatch).length
      const bMatches = b.matches.filter(m => m.isMatch).length
      return bMatches - aMatches
    })

    setAllEntries(entries)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Upsert a review action
  async function handleAction(
    propertyId: string,
    action: ReviewAction,
    extra?: { snoozed_until?: string; dismissed_price?: number }
  ) {
    if (!workspaceId) return

    await supabase
      .from('property_reviews')
      .upsert(
        {
          workspace_id: workspaceId,
          property_id: propertyId,
          action,
          snoozed_until: extra?.snoozed_until ?? null,
          dismissed_price: extra?.dismissed_price ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,property_id' }
      )

    // Optimistic update
    setAllEntries(prev =>
      prev.map(e =>
        e.property.id === propertyId
          ? {
              ...e,
              review: {
                ...(e.review ?? {}),
                workspace_id: workspaceId,
                property_id: propertyId,
                action,
                snoozed_until: extra?.snoozed_until ?? null,
                dismissed_price: extra?.dismissed_price ?? null,
              } as PropertyReview,
            }
          : e
      )
    )
  }

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------

  const savedEntries = allEntries.filter(e => e.review?.action === 'Save')

  const queueEntries = allEntries.filter(e => {
    const r = e.review
    if (!r) return true                                    // no action yet
    if (r.action === 'Save') return false                  // in saved tab
    if (r.action === 'Dismiss') return false               // hidden
    if (r.action === 'Snooze') return snoozeExpired(r)     // show if expired

    if (r.action === 'DismissUnlessChanged') {
      // Resurface if price has changed
      const currentPrice = e.property.list_price ?? e.property.opening_bid
      return currentPrice != null && currentPrice !== r.dismissed_price
    }
    return true
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Properties that fully match at least one active buy box — ready for your decision.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6 shadow-sm">
          {([
            { key: 'queue', label: 'Queue', count: queueEntries.length },
            { key: 'saved', label: 'Saved', count: savedEntries.length },
          ] as { key: Tab; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${tab === t.key
                  ? t.key === 'saved'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              {t.label}
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-semibold
                ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}
              `}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            Loading matched properties…
          </div>
        ) : tab === 'queue' ? (
          queueEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-gray-700 font-medium">Queue is clear</p>
              <p className="text-sm text-gray-400 mt-1">
                No new matched properties to review. Check back after adding properties or updating buy boxes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {queueEntries.map(entry => (
                <PropertyCard
                  key={entry.property.id}
                  entry={entry}
                  onAction={handleAction}
                />
              ))}
            </div>
          )
        ) : (
          savedEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">🔖</div>
              <p className="text-gray-700 font-medium">No saved properties yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Save properties from the queue to track them here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedEntries.map(entry => (
                <PropertyCard
                  key={entry.property.id}
                  entry={entry}
                  onAction={handleAction}
                  saved
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}