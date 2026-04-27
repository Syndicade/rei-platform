'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createBrowserClient } from '@supabase/ssr'

// Toledo, OH
const TOLEDO_CENTER: [number, number] = [-83.5552, 41.6528]
const TOLEDO_ZOOM = 11

const STATUS_COLORS: Record<string, string> = {
  'New Match':       '#818cf8', // indigo
  'Analyzing':       '#fbbf24', // amber
  'Offer Sent':      '#60a5fa', // blue
  'Under Contract':  '#34d399', // emerald
  'Closed':          '#10b981', // green
  'Lost':            '#f87171', // red
}
const DEFAULT_COLOR = '#94a3b8'

type Property = {
  id: string
  address: string
  city: string
  state: string
  zip: string
  list_price: number | null
  opening_bid: number | null
  pipeline_status: string
  latitude: number | null
  longitude: number | null
}

async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string,
  token: string
): Promise<[number, number] | null> {
  const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1&country=US`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.features?.[0]?.center) {
      const [lng, lat] = data.features[0].center as [number, number]
      return [lng, lat]
    }
  } catch {
    // silently skip failed geocodes
  }
  return null
}

function formatPrice(list: number | null, bid: number | null): string {
  const price = list ?? bid
  if (!price) return 'Price N/A'
  return `$${price.toLocaleString()}`
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Load properties from Supabase ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); setLoading(false); return }

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!member) { setError('No workspace found'); setLoading(false); return }

      const { data, error: fetchError } = await supabase
        .from('properties')
        .select('id, address, city, state, zip, list_price, opening_bid, pipeline_status, latitude, longitude')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })

      if (fetchError) { setError(fetchError.message); setLoading(false); return }

      const props: Property[] = data ?? []
      setProperties(props)
      setLoading(false)

      // ── Geocode anything missing coordinates ──────────────────────────────
      const missing = props.filter(p => p.latitude == null || p.longitude == null)
      if (missing.length === 0) return

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
      setGeocoding(true)
      setGeocodeProgress({ done: 0, total: missing.length })

      const updated = [...props]
      let done = 0

      for (const prop of missing) {
        const coords = await geocodeAddress(prop.address, prop.city, prop.state, prop.zip, token)
        done++
        setGeocodeProgress({ done, total: missing.length })

        if (coords) {
          await supabase
            .from('properties')
            .update({ longitude: coords[0], latitude: coords[1] })
            .eq('id', prop.id)

          const idx = updated.findIndex(p => p.id === prop.id)
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], longitude: coords[0], latitude: coords[1] }
          }
        }
      }

      setProperties([...updated])
      setGeocoding(false)
      setGeocodeProgress(null)
    }

    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialise Mapbox once loading is done ─────────────────────────────────
  useEffect(() => {
    if (loading || mapRef.current || !mapContainer.current) return

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: TOLEDO_CENTER,
      zoom: TOLEDO_ZOOM,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    map.on('load', () => setMapReady(true))

    mapRef.current = map

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [loading])

  // ── Add / refresh markers whenever properties or map-ready state changes ───
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    // Remove existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const map = mapRef.current

    properties.forEach(prop => {
      if (prop.latitude == null || prop.longitude == null) return

      const color = STATUS_COLORS[prop.pipeline_status] ?? DEFAULT_COLOR
      const priceStr = formatPrice(prop.list_price, prop.opening_bid)

      // Custom dot marker
      const el = document.createElement('div')
      el.style.cssText = [
        'width:14px',
        'height:14px',
        'border-radius:50%',
        `background:${color}`,
        'border:2.5px solid white',
        'box-shadow:0 2px 6px rgba(0,0,0,0.25)',
        'cursor:pointer',
        'transition:transform 0.15s ease',
      ].join(';')

      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.4)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

      const popup = new mapboxgl.Popup({
        offset: 18,
        maxWidth: '260px',
        closeButton: true,
        className: 'rei-popup',
      }).setHTML(`
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:2px 0;">
          <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#111827;line-height:1.3;">
            ${prop.address}
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
            ${prop.city}, ${prop.state} ${prop.zip}
          </p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="font-size:14px;font-weight:700;color:#111827;">${priceStr}</span>
            <span style="
              font-size:11px;font-weight:500;
              background:${color}22;color:${color};
              padding:2px 8px;border-radius:999px;
            ">${prop.pipeline_status}</span>
          </div>
          <a
            href="/dashboard/properties/${prop.id}"
            style="font-size:12px;font-weight:600;color:#4f46e5;text-decoration:none;"
          >View property →</a>
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([prop.longitude, prop.latitude])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [properties, mapReady])

  // ── Legend data ────────────────────────────────────────────────────────────
  const legendItems = Object.entries(STATUS_COLORS)
  const placedCount = properties.filter(p => p.latitude != null).length

return (
    <div className="flex flex-col bg-gray-100" style={{ position: 'fixed', top: 0, left: 144, right: 0, bottom: 0 }}>
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Map View</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {placedCount} of {properties.length} {properties.length === 1 ? 'property' : 'properties'} mapped
              {geocoding && geocodeProgress && (
                <span className="ml-2 text-indigo-600">
                  · Geocoding {geocodeProgress.done}/{geocodeProgress.total}…
                </span>
              )}
            </p>
          )}
        </div>

        {/* Legend */}
        {!loading && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {legendItems.map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white shadow"
                  style={{ background: color }}
                />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading properties…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center">
              <p className="text-sm font-medium text-red-600 mb-1">Failed to load properties</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          </div>
        )}

        <div ref={mapContainer} className="absolute inset-0" />
      </div>

      {/* Mapbox popup global styles */}
      <style>{`
        .rei-popup .mapboxgl-popup-content {
          padding: 12px 14px;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .rei-popup .mapboxgl-popup-close-button {
          font-size: 16px;
          color: #9ca3af;
          padding: 4px 6px;
        }
        .rei-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  )
}