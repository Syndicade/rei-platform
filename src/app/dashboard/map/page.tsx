'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const TOLEDO_CENTER: [number, number] = [-83.5552, 41.6528]
const TOLEDO_ZOOM = 11

const STATUS_COLORS: Record<string, string> = {
  'New Match':      '#818cf8',
  'Analyzing':      '#fbbf24',
  'Offer Sent':     '#60a5fa',
  'Under Contract': '#34d399',
  'Closed':         '#10b981',
  'Lost':           '#f87171',
}
const DEFAULT_COLOR = '#94a3b8'

// All possible status values mapped for Mapbox match expression
const STATUS_MATCH_EXPRESSION = [
  'match',
  ['get', 'status'],
  ...Object.entries(STATUS_COLORS).flatMap(([k, v]) => [k, v]),
  DEFAULT_COLOR,
]

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
  address: string, city: string, state: string, zip: string, token: string
): Promise<[number, number] | null> {
  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`)
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1&country=US`
    )
    const data = await res.json()
    if (data.features?.[0]?.center) return data.features[0].center as [number, number]
  } catch { /* skip */ }
  return null
}

function formatPrice(list: number | null, bid: number | null) {
  const p = list ?? bid
  return p ? `$${p.toLocaleString()}` : 'Price N/A'
}

function buildGeoJSON(props: Property[]) {
  return {
    type: 'FeatureCollection' as const,
    features: props
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.longitude!, p.latitude!] },
        properties: {
          id: p.id,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          price: formatPrice(p.list_price, p.opening_bid),
          status: p.pipeline_status,
          color: STATUS_COLORS[p.pipeline_status] ?? DEFAULT_COLOR,
        },
      })),
  }
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)

  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Load + geocode ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); setLoading(false); return }

      const { data: member } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
      if (!member) { setError('No workspace found'); setLoading(false); return }

      const { data, error: e } = await supabase
        .from('properties')
        .select('id, address, city, state, zip, list_price, opening_bid, pipeline_status, latitude, longitude')
        .eq('workspace_id', member.workspace_id)
      if (e) { setError(e.message); setLoading(false); return }

      const props: Property[] = data ?? []
      const missing = props.filter(p => p.latitude == null || p.longitude == null)

      if (missing.length > 0) {
        setGeocodeProgress({ done: 0, total: missing.length })
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
        let done = 0
        for (const prop of missing) {
          const coords = await geocodeAddress(prop.address, prop.city, prop.state, prop.zip, token)
          done++
          setGeocodeProgress({ done, total: missing.length })
          if (coords) {
            await supabase.from('properties')
              .update({ longitude: coords[0], latitude: coords[1] }).eq('id', prop.id)
            const idx = props.findIndex(p => p.id === prop.id)
            if (idx !== -1) props[idx] = { ...props[idx], longitude: coords[0], latitude: coords[1] }
          }
        }
        setGeocodeProgress(null)
      }

      setProperties([...props])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mapContainer.current || mapRef.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) { setError('Mapbox token not configured'); return }

    if (!document.getElementById('mapbox-css')) {
      const link = document.createElement('link')
      link.id = 'mapbox-css'
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!mapContainer.current) return
      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: TOLEDO_CENTER,
        zoom: TOLEDO_ZOOM,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

      map.on('load', () => {
        const geojson = buildGeoJSON(properties)

        // Add GeoJSON source
        map.addSource('properties', { type: 'geojson', data: geojson })

        // Outer white circle (border)
        map.addLayer({
          id: 'property-pins-border',
          type: 'circle',
          source: 'properties',
          paint: {
            'circle-radius': 9,
            'circle-color': '#ffffff',
            'circle-opacity': 1,
          },
        })

        // Inner colored circle
        map.addLayer({
          id: 'property-pins',
          type: 'circle',
          source: 'properties',
          paint: {
            'circle-radius': 7,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'circle-color': STATUS_MATCH_EXPRESSION as any,
            'circle-opacity': 1,
            'circle-stroke-width': 0,
          },
        })

        // Hover effect
        map.on('mouseenter', 'property-pins', () => {
          map.getCanvas().style.cursor = 'pointer'
          map.setPaintProperty('property-pins', 'circle-radius', 10)
        })
        map.on('mouseleave', 'property-pins', () => {
          map.getCanvas().style.cursor = ''
          map.setPaintProperty('property-pins', 'circle-radius', 7)
        })

        // Click → popup
        map.on('click', 'property-pins', (e) => {
          if (!e.features?.[0]) return
          const props = e.features[0].properties as {
            id: string; address: string; city: string; state: string
            zip: string; price: string; status: string; color: string
          }
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]
          const color = props.color

          new mapboxgl.Popup({ offset: 14, maxWidth: '270px', closeButton: true })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:4px 2px">
                <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#111827;line-height:1.3">${props.address}</p>
                <p style="margin:0 0 10px;font-size:12px;color:#6b7280">${props.city}, ${props.state} ${props.zip}</p>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                  <span style="font-size:15px;font-weight:700;color:#111827">${props.price}</span>
                  <span style="font-size:11px;font-weight:500;background:${color}22;color:${color};padding:2px 9px;border-radius:999px">${props.status}</span>
                </div>
                <a
                  href="/dashboard/properties/${props.id}"
                  style="display:inline-block;font-size:12px;font-weight:600;color:#4f46e5;text-decoration:none;padding:6px 14px;background:#eef2ff;border-radius:6px"
                >View property →</a>
              </div>
            `)
            .addTo(map)
        })
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [loading, properties]) // eslint-disable-line react-hooks/exhaustive-deps

  const placedCount = properties.filter(p => p.latitude != null).length

  return (
    <div style={{
      position: 'fixed', top: 0, bottom: 0, right: 0, left: '144px',
      display: 'flex', flexDirection: 'column', background: '#f3f4f6',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px', background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, zIndex: 1,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>Map View</h1>
          {!loading && (
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {placedCount} of {properties.length} {properties.length === 1 ? 'property' : 'properties'} mapped
              {geocodeProgress && (
                <span style={{ marginLeft: '8px', color: '#4f46e5' }}>
                  · Geocoding {geocodeProgress.done}/{geocodeProgress.total}…
                </span>
              )}
            </p>
          )}
        </div>
        {!loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px' }}>
            {Object.entries(STATUS_COLORS).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block', width: '10px', height: '10px',
                  borderRadius: '50%', background: color,
                  border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 10, background: '#f3f4f6',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '32px', height: '32px', border: '2px solid #4f46e5',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Loading properties…</p>
            </div>
          </div>
        )}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'white', borderRadius: '8px', padding: '24px',
              maxWidth: '320px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}>
              <p style={{ color: '#dc2626', fontWeight: 500, margin: '0 0 4px' }}>Failed to load</p>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>{error}</p>
            </div>
          </div>
        )}
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}