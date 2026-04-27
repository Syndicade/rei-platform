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

type Tab = 'queue' | 'saved' | 'dismissed'

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

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString()
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
// Modals (page-level — never remount inside cards)
// ---------------------------------------------------------------------------

function SnoozeModal({ onConfirm, onCancel }: { onConfirm: (date: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Snooze until</h3>
        <p className="text-sm text-gray-500 mb-4">Property will reappear in the queue after this date.</p>
        <input
          type="date"
          value={date}
          min={today()}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={() => onConfirm(date)} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Snooze</button>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({ address, onConfirm, onCancel }: { address: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete property?</h3>
        <p className="text-sm text-gray-500 mb-1">{address}</p>
        <p className="text-sm text-red-500 mb-5">This permanently deletes the property and all associated data. This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatPill
// ---------------------------------------------------------------------------

function StatPill({ label, value }: { label?: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
      {label && <span className="text-gray-400">{label}</span>}
      {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// MatchCard
// ---------------------------------------------------------------------------

function MatchCard({ match }: { match: BuyBoxMatch }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round(match.score)
  const color = match.isMatch ? 'border-emerald-200 bg-emerald-50' : pct >= 50 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
  const badgeColor = match.isMatch ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
  return (
    <div className={`border rounded-lg ${color} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColor}`}>{match.isMatch ? '✓ Match' : `${pct}%`}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{match.buyBox.name}</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">{match.passedCount}/{match.totalCount} criteria</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className="h-1 w-full bg-white/60">
        <div className={`h-full ${match.isMatch ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
      </div>
      {open && (
        <div className="px-3 py-2 space-y-1 bg-white/40">
          {match.criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 flex-shrink-0 font-bold ${c.passed ? 'text-emerald-500' : 'text-red-400'}`}>{c.passed ? '✓' : '✗'}</span>
              <span className="text-gray-600">{c.explanation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StarButton
// ---------------------------------------------------------------------------

function StarButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      className={`p-1.5 rounded-lg transition-colors ${active ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
    >
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </button>
  )
}

// ---------------------------------------------------------------------------
// PropertyCard
// ---------------------------------------------------------------------------

function PropertyCard({
  entry,
  mode,
  onAction,
  onToggleFavorite,
  onDelete,
  onRestore,
  onSnoozeRequest,
}: {
  entry: QueueEntry
  mode: Tab
  onAction: (id: string, action: ReviewAction, extra?: { snoozed_until?: string; dismissed_price?: number }) => Promise<void>
  onToggleFavorite: (id: string) => Promise<void>
  onDelete: (id: string) => void
  onRestore: (id: string) => Promise<void>
  onSnoozeRequest: (id: string) => void
}) {
  const { property, matches, review } = entry
  const [loading, setLoading] = useState<string | null>(null)
  const price = property.list_price ?? property.opening_bid
  const fullMatches = matches.filter(m => m.isMatch)
  const isFavorite = review?.is_favorite ?? false

  async function handle(action: ReviewAction, extra?: { snoozed_until?: string; dismissed_price?: number }) {
    setLoading(action)
    await onAction(property.id, action, extra)
    setLoading(null)
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      mode === 'saved' ? 'border-emerald-200 ring-1 ring-emerald-100' :
      mode === 'dismissed' ? 'border-gray-200 opacity-80' :
      'border-gray-200'
    }`}>
      {/* Saved banner */}
      {mode === 'saved' && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold text-emerald-700">Saved</span>
        </div>
      )}
      {/* Dismissed banner */}
      {mode === 'dismissed' && review && (
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-1.5 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-400">
            {review.action === 'DismissUnlessChanged'
              ? `Dismissed unless changed · was ${fmt(review.dismissed_price ?? undefined)}`
              : 'Dismissed'}
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-semibold text-gray-900 leading-tight truncate">{property.address}</h3>
              <StarButton active={isFavorite} onClick={() => onToggleFavorite(property.id)} />
            </div>
            <p className="text-sm text-gray-500">{property.city}, {property.state} {property.zip}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-gray-900">{fmt(price)}</div>
            {property.arv && <div className="text-xs text-gray-400">ARV {fmt(property.arv)}</div>}
          </div>
        </div>

        {/* Favorite badge */}
        {isFavorite && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium mb-2">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Favorite
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {property.property_type && <StatPill value={property.property_type} />}
          {property.bedrooms != null && <StatPill label="bd" value={String(property.bedrooms)} />}
          {property.bathrooms != null && <StatPill label="ba" value={String(property.bathrooms)} />}
          {property.sqft != null && <StatPill label="sqft" value={property.sqft.toLocaleString()} />}
          {property.year_built != null && <StatPill label="built" value={String(property.year_built)} />}
          {property.county && <StatPill label="county" value={property.county} />}
          {property.occupancy_status && <StatPill value={property.occupancy_status} />}
          {property.arv && price && <StatPill label="ratio" value={`${Math.round((price / property.arv) * 100)}%`} />}
        </div>

        {/* Match summary */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            {fullMatches.length > 0
              ? `${fullMatches.length} full match${fullMatches.length > 1 ? 'es' : ''}`
              : 'Partial matches only'}
          </p>
          <div className="space-y-1.5">
            {matches.map((m, i) => <MatchCard key={i} match={m} />)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {mode === 'queue' && (
            <>
              <button onClick={() => handle('Save')} disabled={loading !== null}
                className="flex-1 min-w-[72px] px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {loading === 'Save' ? '…' : '✓ Save'}
              </button>
              <button onClick={() => onSnoozeRequest(property.id)} disabled={loading !== null}
                className="flex-1 min-w-[72px] px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors">
                {loading === 'Snooze' ? '…' : '⏱ Snooze'}
              </button>
              <button onClick={() => handle('Dismiss')} disabled={loading !== null}
                className="flex-1 min-w-[72px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                {loading === 'Dismiss' ? '…' : 'Dismiss'}
              </button>
              <button onClick={() => handle('DismissUnlessChanged', { dismissed_price: price ?? undefined })} disabled={loading !== null}
                className="flex-1 min-w-[120px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                {loading === 'DismissUnlessChanged' ? '…' : 'Dismiss if unchanged'}
              </button>
            </>
          )}
          {mode === 'saved' && (
            <>
              <button onClick={() => handle('Dismiss')} disabled={loading !== null}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                {loading === 'Dismiss' ? '…' : 'Unsave'}
              </button>
            </>
          )}
          {mode === 'dismissed' && (
            <>
              <button onClick={() => onRestore(property.id)} disabled={loading !== null}
                className="flex-1 min-w-[80px] px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                {loading === 'restore' ? '…' : '↩ Restore to queue'}
              </button>
              <button onClick={() => onDelete(property.id)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                Delete property
              </button>
            </>
          )}
          <a href={`/dashboard/properties/${property.id}`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
            View →
          </a>
        </div>
      </div>
    </div>
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

  // Snooze modal state — page-level so it never remounts
  const [snoozingPropertyId, setSnoozingPropertyId] = useState<string | null>(null)
  // Delete modal state
  const [deletingEntry, setDeletingEntry] = useState<QueueEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
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

    const { data: properties } = await supabase
      .from('properties')
      .select(`id, address, city, state, zip, county, property_type, bedrooms, bathrooms,
               sqft, year_built, list_price, opening_bid, arv, hoa_monthly,
               occupancy_status, pipeline_status`)
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })

    if (!properties?.length) { setLoading(false); return }

    const { data: reviews } = await supabase
      .from('property_reviews')
      .select('*')
      .eq('workspace_id', wsId)

    const reviewMap: Record<string, PropertyReview> = {}
    for (const r of reviews ?? []) reviewMap[r.property_id] = r

    const entries: QueueEntry[] = []
    await Promise.all(
      properties.map(async (prop) => {
        const matches = await getPropertyMatches(prop as any, wsId)
        if (!matches.some(m => m.isMatch)) return
        entries.push({ property: prop as ReviewableProperty, matches, review: reviewMap[prop.id] ?? null })
      })
    )

    entries.sort((a, b) =>
      b.matches.filter(m => m.isMatch).length - a.matches.filter(m => m.isMatch).length
    )

    setAllEntries(entries)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAction(
    propertyId: string,
    action: ReviewAction,
    extra?: { snoozed_until?: string; dismissed_price?: number }
  ) {
    if (!workspaceId) return
    const existing = allEntries.find(e => e.property.id === propertyId)?.review
    await supabase.from('property_reviews').upsert(
      {
        workspace_id: workspaceId,
        property_id: propertyId,
        action,
        snoozed_until: extra?.snoozed_until ?? null,
        dismissed_price: extra?.dismissed_price ?? null,
        is_favorite: existing?.is_favorite ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,property_id' }
    )
    setAllEntries(prev => prev.map(e =>
      e.property.id === propertyId
        ? { ...e, review: { ...(e.review ?? {} as any), workspace_id: workspaceId, property_id: propertyId, action, snoozed_until: extra?.snoozed_until ?? null, dismissed_price: extra?.dismissed_price ?? null, is_favorite: e.review?.is_favorite ?? false } as PropertyReview }
        : e
    ))
  }

  async function handleToggleFavorite(propertyId: string) {
    if (!workspaceId) return
    const entry = allEntries.find(e => e.property.id === propertyId)
    const current = entry?.review?.is_favorite ?? false
    const newVal = !current

    // If no review record yet, insert with a neutral action placeholder
    if (!entry?.review) {
      // We need an action — don't change queue status, just track favorite
      // Use upsert; if no existing action we won't set one here (rely on existing record)
      // In practice, favorite is only toggled after an action exists (card is visible)
      // But just in case, we skip if no record — user must take an action first
      return
    }

    await supabase.from('property_reviews')
      .update({ is_favorite: newVal, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('property_id', propertyId)

    setAllEntries(prev => prev.map(e =>
      e.property.id === propertyId
        ? { ...e, review: { ...e.review!, is_favorite: newVal } }
        : e
    ))
  }

  async function handleRestore(propertyId: string) {
    if (!workspaceId) return
    await supabase.from('property_reviews')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('property_id', propertyId)
    setAllEntries(prev => prev.map(e =>
      e.property.id === propertyId ? { ...e, review: null } : e
    ))
  }

  async function handleDeleteProperty(propertyId: string) {
    await supabase.from('properties').delete().eq('id', propertyId)
    setAllEntries(prev => prev.filter(e => e.property.id !== propertyId))
    setDeletingEntry(null)
  }

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------

  const queueEntries = allEntries.filter(e => {
    const r = e.review
    if (!r) return true
    if (r.action === 'Save') return false
    if (r.action === 'Dismiss' || r.action === 'DismissUnlessChanged') return false
    if (r.action === 'Snooze') return snoozeExpired(r)
    return true
  })

  const savedEntries = allEntries.filter(e => e.review?.action === 'Save')

  const dismissedEntries = allEntries.filter(e =>
    e.review?.action === 'Dismiss' || e.review?.action === 'DismissUnlessChanged'
  )

  // Favorites float to top within each list
  function sortFavoritesFirst(entries: QueueEntry[]) {
    return [...entries].sort((a, b) => {
      const af = a.review?.is_favorite ? 1 : 0
      const bf = b.review?.is_favorite ? 1 : 0
      return bf - af
    })
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'queue', label: 'Queue', count: queueEntries.length },
    { key: 'saved', label: 'Saved', count: savedEntries.length },
    { key: 'dismissed', label: 'Dismissed', count: dismissedEntries.length },
  ]

  const visibleEntries =
    tab === 'queue' ? sortFavoritesFirst(queueEntries) :
    tab === 'saved' ? sortFavoritesFirst(savedEntries) :
    sortFavoritesFirst(dismissedEntries)

  const emptyMessages: Record<Tab, { icon: string; title: string; sub: string }> = {
    queue: { icon: '✓', title: 'Queue is clear', sub: 'No new matched properties to review.' },
    saved: { icon: '🔖', title: 'No saved properties yet', sub: 'Save properties from the queue to track them here.' },
    dismissed: { icon: '🗂', title: 'No dismissed properties', sub: 'Dismissed properties will appear here.' },
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page-level modals */}
      {snoozingPropertyId && (
        <SnoozeModal
          onConfirm={async date => {
            const id = snoozingPropertyId
            setSnoozingPropertyId(null)
            await handleAction(id, 'Snooze', { snoozed_until: date })
          }}
          onCancel={() => setSnoozingPropertyId(null)}
        />
      )}
      {deletingEntry && (
        <DeleteModal
          address={deletingEntry.property.address}
          onConfirm={() => handleDeleteProperty(deletingEntry.property.id)}
          onCancel={() => setDeletingEntry(null)}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Properties that fully match at least one active buy box.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6 shadow-sm">
          {tabs.map(t => {
            const activeColor =
              t.key === 'saved' ? 'bg-emerald-600 text-white shadow-sm' :
              t.key === 'dismissed' ? 'bg-gray-500 text-white shadow-sm' :
              'bg-gray-900 text-white shadow-sm'
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? activeColor : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            Loading matched properties…
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">{emptyMessages[tab].icon}</div>
            <p className="text-gray-700 font-medium">{emptyMessages[tab].title}</p>
            <p className="text-sm text-gray-400 mt-1">{emptyMessages[tab].sub}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleEntries.map(entry => (
              <PropertyCard
                key={entry.property.id}
                entry={entry}
                mode={tab}
                onAction={handleAction}
                onToggleFavorite={handleToggleFavorite}
                onDelete={id => setDeletingEntry(allEntries.find(e => e.property.id === id) ?? null)}
                onRestore={handleRestore}
                onSnoozeRequest={id => setSnoozingPropertyId(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}