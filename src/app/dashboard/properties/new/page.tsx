'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function NewPropertyPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
const [imageUrls, setImageUrls] = useState<string>('')

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
    rating: '',
    auction_date: '',
    opening_bid: '',
    buyer_premium: '',
    deposit_amount: '',
    auction_url: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files))
    }
  }

async function uploadImages(propertyId: string): Promise<string[]> {
  const urls: string[] = []

  // Handle file uploads
  for (const file of imageFiles) {
    const ext = file.name.split('.').pop()
    const path = `${propertyId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('property-images')
      .upload(path, file)
    if (!error) {
      const { data } = supabase.storage
        .from('property-images')
        .getPublicUrl(path)
      urls.push(data.publicUrl)
    }
  }

  // Handle pasted URLs
  const pastedUrls = imageUrls
    .split('\n')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'))
  urls.push(...pastedUrls)

  return urls
}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not logged in.')
      setSaving(false)
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      setError('Could not find your workspace.')
      setSaving(false)
      return
    }

    // Insert property first to get the ID
    const { data: inserted, error: insertError } = await supabase
      .from('properties')
      .insert({
        workspace_id: membership.workspace_id,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        county: form.county,
        property_type: form.property_type || null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
        sqft: form.sqft ? parseInt(form.sqft) : null,
        lot_size: form.lot_size ? parseFloat(form.lot_size) : null,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        list_price: form.list_price ? parseFloat(form.list_price) : null,
        arv: form.arv ? parseFloat(form.arv) : null,
        hoa_monthly: form.hoa_monthly ? parseFloat(form.hoa_monthly) : null,
        siding_material: form.siding_material || null,
        occupancy_status: form.occupancy_status || null,
        mls_number: form.mls_number || null,
        apn: form.apn || null,
        notes: form.notes || null,
        rating: form.rating ? parseInt(form.rating) : null,
        auction_date: form.auction_date || null,
        opening_bid: form.opening_bid ? parseFloat(form.opening_bid) : null,
        buyer_premium: form.buyer_premium ? parseFloat(form.buyer_premium) : null,
        deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
        auction_url: form.auction_url || null,
        source: 'manual',
        pipeline_status: 'New Match',
      })
      .select()
      .single()

    if (insertError || !inserted) {
      setError(insertError?.message ?? 'Failed to save property.')
      setSaving(false)
      return
    }

    // Upload images if any were selected
    if (imageFiles.length > 0) {
      const urls = await uploadImages(inserted.id)
      if (urls.length > 0) {
        await supabase
          .from('properties')
          .update({ image_urls: urls })
          .eq('id', inserted.id)
      }
    }

    router.push('/dashboard/properties')
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Add Property</h1>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Location */}
        <Card title="Location">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Street Address *" name="address" value={form.address} onChange={handleChange} required />
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" name="city" value={form.city} onChange={handleChange} />
              <Field label="State" name="state" value={form.state} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="ZIP Code" name="zip" value={form.zip} onChange={handleChange} />
              <Field label="County" name="county" value={form.county} onChange={handleChange} />
            </div>
          </div>
        </Card>

        {/* Property Details */}
        <Card title="Property Details">
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Property Type"
              name="property_type"
              value={form.property_type}
              onChange={handleChange}
              options={['Single Family', 'Multi-Family', 'Condo', 'Townhouse', 'Mobile Home', 'Land', 'Commercial', 'Other']}
            />
            <SelectField
              label="Siding Material"
              name="siding_material"
              value={form.siding_material}
              onChange={handleChange}
              options={['Vinyl', 'Brick', 'Aluminum', 'Wood', 'Fiber Cement', 'Stucco', 'Stone', 'Other']}
            />
            <Field label="Bedrooms" name="bedrooms" type="number" value={form.bedrooms} onChange={handleChange} />
            <Field label="Bathrooms" name="bathrooms" type="number" value={form.bathrooms} onChange={handleChange} step="0.5" />
            <Field label="Square Feet" name="sqft" type="number" value={form.sqft} onChange={handleChange} />
            <Field label="Lot Size (acres)" name="lot_size" type="number" value={form.lot_size} onChange={handleChange} step="0.01" />
            <Field label="Year Built" name="year_built" type="number" value={form.year_built} onChange={handleChange} />
            <SelectField
              label="Occupancy Status"
              name="occupancy_status"
              value={form.occupancy_status}
              onChange={handleChange}
              options={['Vacant', 'Owner Occupied', 'Tenant Occupied', 'Unknown']}
            />
          </div>
        </Card>

        {/* Financials */}
        <Card title="Financials">
          <div className="grid grid-cols-2 gap-4">
            <Field label="List Price ($)" name="list_price" type="number" value={form.list_price} onChange={handleChange} />
            <Field label="ARV ($)" name="arv" type="number" value={form.arv} onChange={handleChange} />
            <Field label="HOA Monthly ($)" name="hoa_monthly" type="number" value={form.hoa_monthly} onChange={handleChange} />
          </div>
        </Card>

        {/* Auction */}
        <Card title="Auction Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Auction Date" name="auction_date" type="date" value={form.auction_date} onChange={handleChange} />
            <Field label="Opening Bid ($)" name="opening_bid" type="number" value={form.opening_bid} onChange={handleChange} />
            <Field label="Buyer Premium ($)" name="buyer_premium" type="number" value={form.buyer_premium} onChange={handleChange} />
            <Field label="Deposit Amount ($)" name="deposit_amount" type="number" value={form.deposit_amount} onChange={handleChange} />
            <div className="col-span-2">
              <Field label="Auction URL" name="auction_url" value={form.auction_url} onChange={handleChange} />
            </div>
          </div>
        </Card>

        {/* Reference Numbers */}
        <Card title="Reference Numbers">
          <div className="grid grid-cols-2 gap-4">
            <Field label="MLS Number" name="mls_number" value={form.mls_number} onChange={handleChange} />
            <Field label="APN (Parcel Number)" name="apn" value={form.apn} onChange={handleChange} />
          </div>
        </Card>

        {/* Rating */}
        <Card title="Rating">
          <SelectField
            label="Deal Rating (1–5)"
            name="rating"
            value={form.rating}
            onChange={handleChange}
            options={['1', '2', '3', '4', '5']}
          />
        </Card>

{/* Images */}
<Card title="Photos">
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-500">Upload Photos</label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageChange}
        className="text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
      />
      {imageFiles.length > 0 && (
        <p className="text-xs text-gray-400">{imageFiles.length} photo{imageFiles.length > 1 ? 's' : ''} selected</p>
      )}
    </div>
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-500">Or paste image URLs (one per line)</label>
      <textarea
        value={imageUrls}
        onChange={(e) => setImageUrls(e.target.value)}
        rows={3}
        placeholder="https://example.com/photo1.jpg"
        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  </div>
</Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Any initial notes about this property..."
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </Card>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Property'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-700 text-sm px-4 py-2.5 transition-colors"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 px-6 py-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label, name, value, onChange, type = 'text', required = false, step,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  step?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-500">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        step={step}
        className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

function SelectField({
  label, name, value, onChange, options,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-500">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}