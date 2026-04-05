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
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not logged in.')
      setSaving(false)
      return
    }

    // Get the user's workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      setError('Could not find your workspace. Make sure your account is linked to a workspace.')
      setSaving(false)
      return
    }

    // Insert the property
    const { error: insertError } = await supabase.from('properties').insert({
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
      source: 'manual',
      pipeline_status: 'New Match',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    router.push('/dashboard/properties')
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-white mb-8">Add Property</h1>

      <form onSubmit={handleSubmit} className="space-y-10">

        {/* Location */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Location</h2>
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
        </section>

        {/* Property Details */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Property Details</h2>
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
        </section>

        {/* Financials */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Financials</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="List Price ($)" name="list_price" type="number" value={form.list_price} onChange={handleChange} />
            <Field label="ARV ($)" name="arv" type="number" value={form.arv} onChange={handleChange} />
            <Field label="HOA Monthly ($)" name="hoa_monthly" type="number" value={form.hoa_monthly} onChange={handleChange} />
          </div>
        </section>

        {/* Reference Numbers */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Reference Numbers</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="MLS Number" name="mls_number" value={form.mls_number} onChange={handleChange} />
            <Field label="APN (Parcel Number)" name="apn" value={form.apn} onChange={handleChange} />
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Notes</h2>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Any initial notes about this property..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </section>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
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
            className="text-zinc-400 hover:text-white text-sm px-4 py-2.5 transition-colors"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}

// Reusable input field component
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
      <label className="text-sm text-zinc-400">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        step={step}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
    </div>
  )
}

// Reusable select dropdown component
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
      <label className="text-sm text-zinc-400">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}