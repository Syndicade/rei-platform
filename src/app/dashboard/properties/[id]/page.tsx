'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Image from 'next/image'
import Link from 'next/link'
import BuyBoxMatches from '@/components/BuyBoxMatches';

type Property = {
  id: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_size: number | null
  year_built: number | null
  list_price: number | null
  arv: number | null
  hoa_monthly: number | null
  siding_material: string | null
  occupancy_status: string | null
  mls_number: string | null
  apn: string | null
  notes: string | null
  pipeline_status: string | null
  source: string | null
  created_at: string
  rating: number | null
  auction_date: string | null
  opening_bid: number | null
  buyer_premium: number | null
  deposit_amount: number | null
  auction_url: string | null
  image_urls: string[] | null
}

type Document = {
  id: string
  name: string
  url: string
  type: string
  created_at: string
}

type Note = {
  id: string
  content: string
  created_at: string
}

const DOCUMENT_TYPES = ['Inspection Report', 'Purchase Agreement', 'Closing Doc', 'Photo', 'Other']

export default function PropertyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('Other')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (member) setWorkspaceId(member.workspace_id)

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Property not found.')
      } else {
        setProperty(data)
      }

      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false })

      setDocuments(docs ?? [])

      const { data: noteData } = await supabase
        .from('notes')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false })

      setNotes(noteData ?? [])

      setLoading(false)
    }
    load()
  }, [id])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !workspaceId) return

    setUploading(true)
    const path = `${workspaceId}/${id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(path, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('documents')
      .insert({
        workspace_id: workspaceId,
        property_id: id,
        name: file.name,
        url: path,
        type: docType,
      })

    if (insertError) {
      alert('Failed to save document record.')
    } else {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false })
      setDocuments(docs ?? [])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
  }

  async function handleDownload(doc: Document) {
    const { data, error } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(doc.url, 60)

    if (error || !data) {
      alert('Could not generate download link.')
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  async function handleDeleteDocument(doc: Document) {
    if (!confirm(`Delete "${doc.name}"?`)) return
    await supabase.storage.from('property-documents').remove([doc.url])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  async function handleAddNote() {
    if (!newNote.trim() || !workspaceId) return
    setSavingNote(true)

    const { error } = await supabase.from('notes').insert({
      workspace_id: workspaceId,
      property_id: id,
      content: newNote.trim(),
    })

    if (!error) {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false })
      setNotes(data ?? [])
      setNewNote('')
    }

    setSavingNote(false)
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (loading) {
    return <div className="py-20 text-center text-gray-400 text-sm">Loading...</div>
  }

  if (error || !property) {
    return <div className="py-20 text-center text-red-500 text-sm">{error ?? 'Something went wrong.'}</div>
  }

  const hasAuctionData = property.auction_date || property.opening_bid || property.buyer_premium || property.deposit_amount || property.auction_url

  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/properties')}
          className="text-gray-400 hover:text-gray-700 text-sm mb-4 inline-block transition-colors"
        >
          ← Back to Properties
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{property.address}</h1>
            <p className="text-gray-500 text-sm mt-1">{property.city}, {property.state} {property.zip}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {property.rating && <RatingBadge rating={property.rating} />}
            <StatusBadge status={property.pipeline_status} />
            {property.pipeline_status === 'Under Contract' && (
              <Link href={`/dashboard/deals/${property.id}`} className="text-sm text-blue-600 hover:underline">
                View Deal Tracker &rarr;
              </Link>
            )}
            <Link
              href={`/dashboard/properties/${property.id}/financials`}
              className="bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors"
            >
              Financial Analysis
            </Link>
            <button
              onClick={() => router.push(`/dashboard/properties/${property.id}/edit`)}
              className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* Photos */}
        {property.image_urls && property.image_urls.length > 0 && (
          <Section title="Photos">
            <div className="grid grid-cols-3 gap-3">
              {property.image_urls.map((url, i) => (
                <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={url}
                    alt={`Property photo ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Location */}
        <Section title="Location">
          <Grid>
            <DetailField label="Street Address" value={property.address} />
            <DetailField label="City" value={property.city} />
            <DetailField label="State" value={property.state} />
            <DetailField label="ZIP Code" value={property.zip} />
            <DetailField label="County" value={property.county} />
          </Grid>
        </Section>

        {/* Property Details */}
        <Section title="Property Details">
          <Grid>
            <DetailField label="Property Type" value={property.property_type} />
            <DetailField label="Siding Material" value={property.siding_material} />
            <DetailField label="Bedrooms" value={property.bedrooms} />
            <DetailField label="Bathrooms" value={property.bathrooms} />
            <DetailField label="Square Feet" value={property.sqft ? property.sqft.toLocaleString() : null} />
            <DetailField label="Lot Size (acres)" value={property.lot_size} />
            <DetailField label="Year Built" value={property.year_built} />
            <DetailField label="Occupancy Status" value={property.occupancy_status} />
          </Grid>
        </Section>

        {/* Financials */}
        <Section title="Financials">
          <Grid>
            <DetailField label="List Price" value={formatCurrency(property.list_price)} />
            <DetailField label="ARV" value={formatCurrency(property.arv)} />
            <DetailField label="HOA Monthly" value={formatCurrency(property.hoa_monthly)} />
          </Grid>
        </Section>

 {/* Buy Box Matches */}        {/* ← ADD THIS BLOCK */}
        {workspaceId && (
          <BuyBoxMatches
            property={{
              id: property.id,
              address: property.address,
              property_type: property.property_type,
              list_price: property.list_price,
              opening_bid: property.opening_bid,
              arv: property.arv,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              sqft: property.sqft,
              year_built: property.year_built,
              hoa_monthly: property.hoa_monthly,
              occupancy_status: property.occupancy_status,
              county: property.county,
              zip: property.zip,
            }}
            workspaceId={workspaceId}
          />
        )}
        
        {/* Auction */}
        {hasAuctionData && (
          <Section title="Auction Details">
            <Grid>
              <DetailField label="Auction Date" value={property.auction_date ? formatDate(property.auction_date) : null} />
              <DetailField label="Opening Bid" value={formatCurrency(property.opening_bid)} />
              <DetailField label="Buyer Premium" value={formatCurrency(property.buyer_premium)} />
              <DetailField label="Deposit Amount" value={formatCurrency(property.deposit_amount)} />
              {property.auction_url && (
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Auction URL</span>
                  <a
                    href={property.auction_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {property.auction_url}
                  </a>
                </div>
              )}
            </Grid>
          </Section>
        )}

        {/* Reference Numbers */}
        <Section title="Reference Numbers">
          <Grid>
            <DetailField label="MLS Number" value={property.mls_number} />
            <DetailField label="APN (Parcel Number)" value={property.apn} />
          </Grid>
        </Section>

        {/* Description (property.notes from the property record) */}
        {property.notes && (
          <Section title="Description">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{property.notes}</p>
          </Section>
        )}

        {/* Documents */}
        <Section title="Documents">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 bg-white"
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {uploading ? 'Uploading...' : 'Upload File'}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.type} &middot; {formatDate(doc.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc)}
                        className="text-sm text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 resize-none w-full"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {savingNote ? 'Saving...' : 'Add Note'}
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <p className="text-sm text-gray-400">No notes yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
{notes.map(note => (
  <NoteItem
    key={note.id}
    note={note}
    onDelete={handleDeleteNote}
    onUpdate={async (noteId, newContent) => {
      await supabase.from('notes').update({ content: newContent }).eq('id', noteId)
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: newContent } : n))
    }}
  />
))}
              </div>
            )}
          </div>
        </Section>

        {/* Record Info */}
        <Section title="Record Info">
          <Grid>
            <DetailField label="Source" value={property.source} />
            <DetailField label="Added" value={formatDate(property.created_at)} />
          </Grid>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900">
        {value !== null && value !== undefined && value !== ''
          ? value
          : <span className="text-gray-400">—</span>
        }
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      {status}
    </span>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  return (
    <span className="text-sm text-amber-400 tracking-tight">{stars}</span>
  )
}

function NoteItem({ note, onDelete, onUpdate }: {
  note: Note
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    await onUpdate(note.id, draft.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="py-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 resize-none w-full"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setDraft(note.content) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
          <div className="flex gap-3 flex-shrink-0 mt-0.5">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">{formatDateTime(note.created_at)}</p>
    </div>
  )
}

function formatCurrency(value: number | null): string | null {
  if (value === null) return null
  return '$' + value.toLocaleString()
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}