'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Image from 'next/image'
import Link from 'next/link'

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

  useEffect(() => {
    async function load() {
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
      setLoading(false)
    }
    load()
  }, [id])

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

        {/* Auction — only shown if any auction data exists */}
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

        {/* Notes */}
        {property.notes && (
          <Section title="Notes">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{property.notes}</p>
          </Section>
        )}

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