'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import BuyBoxBadge from '@/components/BuyBoxBadge'

type Property = {
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
  pipeline_status: string | null
  occupancy_status: string | null
}

export default function PropertiesPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [properties, setProperties] = useState<Property[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [{ data: propertiesData }, { data: wm }] = await Promise.all([
        supabase
          .from('properties')
          .select('id, address, city, state, zip, county, property_type, bedrooms, bathrooms, sqft, year_built, list_price, opening_bid, arv, hoa_monthly, pipeline_status, occupancy_status')
          .order('created_at', { ascending: false }),
        supabase
          .from('workspace_members')
          .select('workspace_id')
          .single(),
      ])

      if (propertiesData) setProperties(propertiesData)
      if (wm?.workspace_id) setWorkspaceId(wm.workspace_id)
      setLoading(false)
    }

    fetchData()
  }, [])

  function formatPrice(value: number | null) {
    if (!value) return '—'
    return '$' + value.toLocaleString()
  }

  return (
    <div className="py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white">Properties</h1>
        <button
          onClick={() => router.push('/dashboard/properties/new')}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          + Add Property
        </button>
      </div>

      {loading && (
        <p className="text-zinc-400 text-sm">Loading...</p>
      )}

      {!loading && properties.length === 0 && (
        <div className="text-center py-24">
          <p className="text-zinc-400 text-sm">No properties yet.</p>
          <button
            onClick={() => router.push('/dashboard/properties/new')}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Add your first property
          </button>
        </div>
      )}

      {!loading && properties.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-left border-b border-zinc-800">
                <th className="pb-3 pr-6 font-medium">Address</th>
                <th className="pb-3 pr-6 font-medium">Type</th>
                <th className="pb-3 pr-6 font-medium">Beds / Baths</th>
                <th className="pb-3 pr-6 font-medium">Sq Ft</th>
                <th className="pb-3 pr-6 font-medium">List Price</th>
                <th className="pb-3 pr-6 font-medium">Status</th>
                <th className="pb-3 pr-6 font-medium">Occupancy</th>
                <th className="pb-3 font-medium">Buy Box</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/dashboard/properties/${p.id}`)}
                  className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-4 pr-6 text-white font-medium">
                    {p.address}<br />
                    <span className="text-zinc-400 font-normal">{p.city}, {p.state} {p.zip}</span>
                  </td>
                  <td className="py-4 pr-6 text-zinc-300">{p.property_type ?? '—'}</td>
                  <td className="py-4 pr-6 text-zinc-300">
                    {p.bedrooms ?? '—'} bd / {p.bathrooms ?? '—'} ba
                  </td>
                  <td className="py-4 pr-6 text-zinc-300">{p.sqft ? p.sqft.toLocaleString() : '—'}</td>
                  <td className="py-4 pr-6 text-zinc-300">{formatPrice(p.list_price)}</td>
                  <td className="py-4 pr-6">
                    <span className="bg-zinc-700 text-zinc-200 text-xs px-2.5 py-1 rounded-full">
                      {p.pipeline_status ?? '—'}
                    </span>
                  </td>
                  <td className="py-4 pr-6 text-zinc-300">{p.occupancy_status ?? '—'}</td>
                  <td className="py-4" onClick={(e) => e.stopPropagation()}>
                    {workspaceId && (
                      <BuyBoxBadge
                        property={{
                          id: p.id,
                          address: p.address,
                          property_type: p.property_type,
                          list_price: p.list_price,
                          opening_bid: p.opening_bid,
                          arv: p.arv,
                          bedrooms: p.bedrooms,
                          bathrooms: p.bathrooms,
                          sqft: p.sqft,
                          year_built: p.year_built,
                          hoa_monthly: p.hoa_monthly,
                          occupancy_status: p.occupancy_status,
                          county: p.county,
                          zip: p.zip,
                        }}
                        workspaceId={workspaceId}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}