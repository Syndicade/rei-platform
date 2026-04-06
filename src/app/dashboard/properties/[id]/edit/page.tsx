'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')

  const [form, setForm] = useState({
    address: '',
    city: 'Toledo',
    state: 'OH',
    zip: '',
    county: 'Lucas',
    property_type: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    lot_size: '',
    year_built: '',
    list_price: '',
    arv: '',
    hoa_monthly: '',
    siding_material: '',
    occupancy_status: '',
    mls_number: '',
    apn: '',
    notes: '',
    pipeline_status: 'New Match',
    rating: '',
    auction_date: '',
    opening_bid: '',
    buyer_premium: '',
    deposit_amount: '',
    auction_url: '',
    image_urls: [] as string[],
  })

  // Load the existing property record when the page opens
  useEffect(() => {
    async function loadProperty() {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Could not load property.')
        setLoading(false)
        return
      }

      // Pre-fill every form field with the existing values
      setForm({
        address: data.address ?? '',
        city: data.city ?? 'Toledo',
        state: data.state ?? 'OH',
        zip: data.zip ?? '',
        county: data.county ?? 'Lucas',
        property_type: data.property_type ?? '',
        bedrooms: data.bedrooms ?? '',
        bathrooms: data.bathrooms ?? '',
        sqft: data.sqft ?? '',
        lot_size: data.lot_size ?? '',
        year_built: data.year_built ?? '',
        list_price: data.list_price ?? '',
        arv: data.arv ?? '',
        hoa_monthly: data.hoa_monthly ?? '',
        siding_material: data.siding_material ?? '',
        occupancy_status: data.occupancy_status ?? '',
        mls_number: data.mls_number ?? '',
        apn: data.apn ?? '',
        notes: data.notes ?? '',
        pipeline_status: data.pipeline_status ?? 'New Match',
        rating: data.rating ?? '',
        auction_date: data.auction_date ?? '',
        opening_bid: data.opening_bid ?? '',
        buyer_premium: data.buyer_premium ?? '',
        deposit_amount: data.deposit_amount ?? '',
        auction_url: data.auction_url ?? '',
        image_urls: data.image_urls ?? [],
      })

      setLoading(false)
    }

    loadProperty()
  }, [id])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Upload a photo file to Supabase Storage and add the returned URL to the list
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const filename = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(filename, file)

    if (uploadError) {
      setError('Photo upload failed.')
      return
    }

    const { data: urlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(filename)

    setForm({ ...form, image_urls: [...form.image_urls, urlData.publicUrl] })
    e.target.value = ''
  }

  // Add a manually pasted photo URL to the list
  function handleAddUrl() {
    const trimmed = newImageUrl.trim()
    if (!trimmed) return
    setForm({ ...form, image_urls: [...form.image_urls, trimmed] })
    setNewImageUrl('')
  }

  // Remove a photo from the list by its index position
  function handleRemoveImage(index: number) {
    const updated = form.image_urls.filter((_, i) => i !== index)
    setForm({ ...form, image_urls: updated })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('properties')
      .update({
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip || null,
        county: form.county,
        property_type: form.property_type || null,
        bedrooms: form.bedrooms !== '' ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms !== '' ? Number(form.bathrooms) : null,
        sqft: form.sqft !== '' ? Number(form.sqft) : null,
        lot_size: form.lot_size !== '' ? Number(form.lot_size) : null,
        year_built: form.year_built !== '' ? Number(form.year_built) : null,
        list_price: form.list_price !== '' ? Number(form.list_price) : null,
        arv: form.arv !== '' ? Number(form.arv) : null,
        hoa_monthly: form.hoa_monthly !== '' ? Number(form.hoa_monthly) : null,
        siding_material: form.siding_material || null,
        occupancy_status: form.occupancy_status || null,
        mls_number: form.mls_number || null,
        apn: form.apn || null,
        notes: form.notes || null,
        pipeline_status: form.pipeline_status,
        rating: form.rating !== '' ? Number(form.rating) : null,
        auction_date: form.auction_date || null,
        opening_bid: form.opening_bid !== '' ? Number(form.opening_bid) : null,
        buyer_premium: form.buyer_premium !== '' ? Number(form.buyer_premium) : null,
        deposit_amount: form.deposit_amount !== '' ? Number(form.deposit_amount) : null,
        auction_url: form.auction_url || null,
        image_urls: form.image_urls.length > 0 ? form.image_urls : null,
      })
      .eq('id', id)

    if (updateError) {
      setError('Save failed. Please try again.')
      setSaving(false)
      return
    }

    router.push(`/dashboard/properties/${id}`)
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading property...</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Property</h1>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/properties/${id}`)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Address */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Address</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <input name="address" value={form.address} onChange={handleChange} required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input name="city" value={form.city} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input name="state" value={form.state} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input name="zip" value={form.zip} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input name="county" value={form.county} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </section>

        {/* Property Details */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Property Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select name="property_type" value={form.property_type} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">Select...</option>
                <option>Single Family</option>
                <option>Multi-Family</option>
                <option>Condo</option>
                <option>Townhouse</option>
                <option>Mobile Home</option>
                <option>Land</option>
                <option>Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupancy Status</label>
              <select name="occupancy_status" value={form.occupancy_status} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">Select...</option>
                <option>Vacant</option>
                <option>Owner Occupied</option>
                <option>Tenant Occupied</option>
                <option>Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
              <input name="bedrooms" type="number" value={form.bedrooms} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
              <input name="bathrooms" type="number" step="0.5" value={form.bathrooms} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sq Ft</label>
              <input name="sqft" type="number" value={form.sqft} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lot Size (acres)</label>
              <input name="lot_size" type="number" step="0.01" value={form.lot_size} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year Built</label>
              <input name="year_built" type="number" value={form.year_built} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Siding Material</label>
              <select name="siding_material" value={form.siding_material} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">Select...</option>
                <option>Vinyl</option>
                <option>Brick</option>
                <option>Aluminum</option>
                <option>Wood</option>
                <option>Fiber Cement</option>
                <option>Stucco</option>
                <option>Unknown</option>
              </select>
            </div>
          </div>
        </section>

        {/* Financials */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Financials</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">List Price ($)</label>
              <input name="list_price" type="number" value={form.list_price} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ARV ($)</label>
              <input name="arv" type="number" value={form.arv} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HOA Monthly ($)</label>
              <input name="hoa_monthly" type="number" value={form.hoa_monthly} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {/* Identifiers */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Identifiers</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MLS Number</label>
              <input name="mls_number" value={form.mls_number} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">APN (Parcel Number)</label>
              <input name="apn" value={form.apn} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {/* Pipeline & Rating */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Pipeline & Rating</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Status</label>
              <select name="pipeline_status" value={form.pipeline_status} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option>New Match</option>
                <option>Saved</option>
                <option>Analyzing</option>
                <option>Pursuing</option>
                <option>Under Contract</option>
                <option>Closed</option>
                <option>Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1–5)</label>
              <select name="rating" value={form.rating} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">No rating</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>
        </section>

        {/* Auction Details */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Auction Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auction Date</label>
              <input name="auction_date" type="date" value={form.auction_date} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Bid ($)</label>
              <input name="opening_bid" type="number" value={form.opening_bid} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Premium ($)</label>
              <input name="buyer_premium" type="number" value={form.buyer_premium} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount ($)</label>
              <input name="deposit_amount" type="number" value={form.deposit_amount} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Auction URL</label>
              <input name="auction_url" type="url" value={form.auction_url} onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {/* Photos */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Photos</h2>

          {/* Existing photos with remove buttons */}
          {form.image_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {form.image_urls.map((url, index) => (
                <div key={index} className="relative">
                  <img src={url} alt="" className="w-full h-28 object-cover rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded px-1.5 py-0.5 hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload a new file */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload photo</label>
            <input type="file" accept="image/*" onChange={handleFileUpload}
              className="text-sm text-gray-600" />
          </div>

          {/* Paste a URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Or paste a photo URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
              >
                Add
              </button>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Notes</h2>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </section>

        {/* Save */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/properties/${id}`)}
            className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}