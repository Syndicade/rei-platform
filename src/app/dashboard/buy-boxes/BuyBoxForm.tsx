'use client';

// src/app/dashboard/buy-boxes/BuyBoxForm.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { BuyBox } from '@/types/buyBox';

const PROPERTY_TYPES = [
  'Single Family',
  'Multi-Family',
  'Condo',
  'Townhouse',
  'Mobile Home',
  'Land',
  'Commercial',
];

const OCCUPANCY_OPTIONS = [
  'Vacant',
  'Owner Occupied',
  'Tenant Occupied',
  'Unknown',
];

interface Props {
  workspaceId: string;
  initial?: Partial<BuyBox>;
  buyBoxId?: string;
}

export default function BuyBoxForm({ workspaceId, initial, buyBoxId }: Props) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(initial?.name ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initial?.property_types ?? []);
  const [minPrice, setMinPrice] = useState(initial?.min_price?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(initial?.max_price?.toString() ?? '');
  const [minArv, setMinArv] = useState(initial?.min_arv?.toString() ?? '');
  const [maxArv, setMaxArv] = useState(initial?.max_arv?.toString() ?? '');
  const [maxArvRatio, setMaxArvRatio] = useState(
    initial?.max_arv_ratio !== null && initial?.max_arv_ratio !== undefined
      ? (initial.max_arv_ratio * 100).toString()
      : ''
  );
  const [minBedrooms, setMinBedrooms] = useState(initial?.min_bedrooms?.toString() ?? '');
  const [maxBedrooms, setMaxBedrooms] = useState(initial?.max_bedrooms?.toString() ?? '');
  const [minBathrooms, setMinBathrooms] = useState(initial?.min_bathrooms?.toString() ?? '');
  const [minSqft, setMinSqft] = useState(initial?.min_sqft?.toString() ?? '');
  const [maxSqft, setMaxSqft] = useState(initial?.max_sqft?.toString() ?? '');
  const [minYearBuilt, setMinYearBuilt] = useState(initial?.min_year_built?.toString() ?? '');
  const [maxHoa, setMaxHoa] = useState(initial?.max_hoa?.toString() ?? '');
  const [selectedOccupancy, setSelectedOccupancy] = useState<string[]>(
    initial?.occupancy_statuses ?? []
  );
  const [counties, setCounties] = useState(initial?.counties?.join(', ') ?? '');
  const [zipCodes, setZipCodes] = useState(initial?.zip_codes?.join(', ') ?? '');

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function toggleOccupancy(o: string) {
    setSelectedOccupancy((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  }

  function parseNum(v: string): number | null {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function parseArr(v: string): string[] | null {
    const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
    return arr.length > 0 ? arr : null;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      is_active: isActive,
      property_types: selectedTypes.length > 0 ? selectedTypes : null,
      min_price: parseNum(minPrice),
      max_price: parseNum(maxPrice),
      min_arv: parseNum(minArv),
      max_arv: parseNum(maxArv),
      max_arv_ratio: maxArvRatio !== '' ? (parseNum(maxArvRatio) ?? 0) / 100 : null,
      min_bedrooms: parseNum(minBedrooms),
      max_bedrooms: parseNum(maxBedrooms),
      min_bathrooms: parseNum(minBathrooms),
      min_sqft: parseNum(minSqft),
      max_sqft: parseNum(maxSqft),
      min_year_built: parseNum(minYearBuilt),
      max_hoa: parseNum(maxHoa),
      occupancy_statuses: selectedOccupancy.length > 0 ? selectedOccupancy : null,
      counties: parseArr(counties),
      zip_codes: parseArr(zipCodes),
    };

    let err;
    if (buyBoxId) {
      ({ error: err } = await supabase.from('buy_boxes').update(payload).eq('id', buyBoxId));
    } else {
      ({ error: err } = await supabase.from('buy_boxes').insert(payload));
    }

    setSaving(false);

    if (err) {
      setError(err.message);
    } else {
      router.push('/dashboard/buy-boxes');
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <Section title="General">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Name *</Label>
            <input
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Toledo SFR Core"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              Active -- run matching against this buy box
            </label>
          </div>
        </div>
      </Section>

      <Section title="Property Type">
        <p className="text-xs text-gray-500 mb-3">Leave all unchecked to allow any property type.</p>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selectedTypes.includes(t)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Financials">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumField label="Min Price" value={minPrice} onChange={setMinPrice} prefix="$" placeholder="e.g. 30000" />
          <NumField label="Max Price" value={maxPrice} onChange={setMaxPrice} prefix="$" placeholder="e.g. 120000" />
          <NumField label="Min ARV" value={minArv} onChange={setMinArv} prefix="$" placeholder="e.g. 80000" />
          <NumField label="Max ARV" value={maxArv} onChange={setMaxArv} prefix="$" placeholder="e.g. 200000" />
          <NumField label="Max Price/ARV %" value={maxArvRatio} onChange={setMaxArvRatio} suffix="%" placeholder="e.g. 70" />
          <NumField label="Max HOA / mo" value={maxHoa} onChange={setMaxHoa} prefix="$" placeholder="e.g. 0" />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Price/ARV % -- property passes if (price / ARV) is at or below this value. Enter 70 for the 70% rule.
        </p>
      </Section>

      <Section title="Physical">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumField label="Min Beds" value={minBedrooms} onChange={setMinBedrooms} placeholder="e.g. 2" />
          <NumField label="Max Beds" value={maxBedrooms} onChange={setMaxBedrooms} placeholder="e.g. 5" />
          <NumField label="Min Baths" value={minBathrooms} onChange={setMinBathrooms} placeholder="e.g. 1" />
          <NumField label="Min Sqft" value={minSqft} onChange={setMinSqft} placeholder="e.g. 900" />
          <NumField label="Max Sqft" value={maxSqft} onChange={setMaxSqft} placeholder="e.g. 2500" />
          <NumField label="Min Year Built" value={minYearBuilt} onChange={setMinYearBuilt} placeholder="e.g. 1950" />
        </div>
      </Section>

      <Section title="Occupancy Status">
        <p className="text-xs text-gray-500 mb-3">Leave all unchecked to allow any occupancy status.</p>
        <div className="flex flex-wrap gap-2">
          {OCCUPANCY_OPTIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggleOccupancy(o)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selectedOccupancy.includes(o)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Location">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Counties</Label>
            <input
              className={input}
              value={counties}
              onChange={(e) => setCounties(e.target.value)}
              placeholder="e.g. Lucas, Wood"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Leave blank for any.</p>
          </div>
          <div>
            <Label>Zip Codes</Label>
            <input
              className={input}
              value={zipCodes}
              onChange={(e) => setZipCodes(e.target.value)}
              placeholder="e.g. 43609, 43612, 43615"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Leave blank for any.</p>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : buyBoxId ? 'Save Changes' : 'Create Buy Box'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/buy-boxes')}
          className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
  );
}

function NumField({
  label, value, onChange, prefix, suffix, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>
        )}
        <input
          type="number"
          className={`${input} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}

const input =
  'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
