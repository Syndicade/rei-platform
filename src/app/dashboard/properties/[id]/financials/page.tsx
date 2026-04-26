'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

// ── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string
  address: string
  city: string
  state: string
  list_price: number | null
  arv: number | null
  hoa_monthly: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  property_type: string | null
}

interface Scenario {
  id: string
  label: string
  purchasePrice: number
  downPct: number
  interestRate: number
  loanTermYears: number
  closingCostPct: number
  rehabCost: number
  annualTaxes: number
  annualInsurance: number
  rentEstimate: number
  vacancyPct: number
  managementPct: number
  maintenancePct: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function newScenario(label: string, property: Property): Scenario {
  return {
    id: crypto.randomUUID(),
    label,
    purchasePrice: property.list_price ?? 0,
    downPct: 20,
    interestRate: 7.5,
    loanTermYears: 30,
    closingCostPct: 3,
    rehabCost: 0,
    annualTaxes: 2400,
    annualInsurance: 1200,
    rentEstimate: 0,
    vacancyPct: 8,
    managementPct: 10,
    maintenancePct: 5,
  }
}

function calcScenario(s: Scenario) {
  const downAmount = (s.purchasePrice * s.downPct) / 100
  const loanAmount = s.purchasePrice - downAmount
  const monthlyRate = s.interestRate / 100 / 12
  const numPayments = s.loanTermYears * 12

  // Monthly principal + interest
  const pi =
    monthlyRate === 0
      ? loanAmount / numPayments
      : (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)

  const monthlyTaxes = s.annualTaxes / 12
  const monthlyInsurance = s.annualInsurance / 12
  const monthlyHOA = 0 // pulled from property if needed
  const totalPITI = pi + monthlyTaxes + monthlyInsurance + monthlyHOA

  // Cash to close
  const closingCosts = (s.purchasePrice * s.closingCostPct) / 100
  const cashToClose = downAmount + closingCosts + s.rehabCost

  // Investment metrics
  const grossMonthlyRent = s.rentEstimate
  const vacancyLoss = grossMonthlyRent * (s.vacancyPct / 100)
  const effectiveRent = grossMonthlyRent - vacancyLoss
  const managementFee = effectiveRent * (s.managementPct / 100)
  const maintenanceFee = effectiveRent * (s.maintenancePct / 100)
  const totalMonthlyExpenses = totalPITI + managementFee + maintenanceFee
  const monthlyCashFlow = effectiveRent - totalMonthlyExpenses
  const annualCashFlow = monthlyCashFlow * 12

  // NOI = effective rent - operating expenses (no debt service)
  const annualNOI =
    (effectiveRent - managementFee - maintenanceFee - monthlyTaxes - monthlyInsurance) * 12
  const capRate = s.purchasePrice > 0 ? (annualNOI / s.purchasePrice) * 100 : 0
  const cashOnCash = cashToClose > 0 ? (annualCashFlow / cashToClose) * 100 : 0

  return {
    downAmount,
    loanAmount,
    pi,
    monthlyTaxes,
    monthlyInsurance,
    totalPITI,
    closingCosts,
    cashToClose,
    effectiveRent,
    managementFee,
    maintenanceFee,
    totalMonthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    annualNOI,
    capRate,
    cashOnCash,
  }
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtMoney(n: number) {
  return '$' + fmt(Math.abs(n))
}

// ── Input component ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 'any',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  step?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
        {prefix && (
          <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-300">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm text-gray-900 focus:outline-none"
        />
        {suffix && (
          <span className="px-2 text-gray-400 text-sm bg-gray-50 border-l border-gray-300">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Metric tile ───────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'green' | 'red' | 'neutral'
}) {
  const color =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
      ? 'text-red-500'
      : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activeId, setActiveId] = useState<string>('')

  // Load property
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('properties')
        .select('id,address,city,state,list_price,arv,hoa_monthly,bedrooms,bathrooms,sqft,property_type')
        .eq('id', id)
        .single()

      if (!data) { router.push('/dashboard/properties'); return }
      setProperty(data)

      const first = newScenario('Scenario 1', data)
      setScenarios([first])
      setActiveId(first.id)
      setLoading(false)
    }
    load()
  }, [id])

  const active = scenarios.find((s) => s.id === activeId)

  function updateActive(patch: Partial<Scenario>) {
    setScenarios((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, ...patch } : s))
    )
  }

  function addScenario() {
    if (!property) return
    const label = `Scenario ${scenarios.length + 1}`
    const clone: Scenario = {
      ...newScenario(label, property),
      ...(active ?? {}),
      id: crypto.randomUUID(),
      label,
    }
    setScenarios((prev) => [...prev, clone])
    setActiveId(clone.id)
  }

  function removeScenario(sid: string) {
    const next = scenarios.filter((s) => s.id !== sid)
    setScenarios(next)
    if (activeId === sid) setActiveId(next[0]?.id ?? '')
  }

  if (loading || !property || !active) {
    return <div className="p-8 text-gray-500 text-sm">Loading...</div>
  }

  const calc = calcScenario(active)
  const cashFlowColor =
    calc.monthlyCashFlow >= 0 ? 'green' : 'red'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/properties/${id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to property
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Financial Analysis</h1>
          <p className="text-gray-500 text-sm">
            {property.address}, {property.city}, {property.state}
          </p>
        </div>
      </div>

      {/* Scenario tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {scenarios.map((s) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => setActiveId(s.id)}
              className={`px-4 py-1.5 rounded-l-md text-sm font-medium border transition-colors ${
                s.id === activeId
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
            {scenarios.length > 1 && (
              <button
                onClick={() => removeScenario(s.id)}
                className={`px-2 py-1.5 rounded-r-md text-sm border-t border-r border-b transition-colors ${
                  s.id === activeId
                    ? 'bg-gray-800 text-gray-300 border-gray-900 hover:bg-gray-700'
                    : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {scenarios.length < 5 && (
          <button
            onClick={addScenario}
            className="px-4 py-1.5 rounded-md text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:bg-gray-50"
          >
            + Add scenario
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Inputs ── */}
        <div className="lg:col-span-1 space-y-5">

          {/* Scenario label */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scenario name</label>
            <input
              type="text"
              value={active.label}
              onChange={(e) => updateActive({ label: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none"
            />
          </div>

          {/* Purchase */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Purchase</h3>
            <Field label="Purchase price" value={active.purchasePrice} onChange={(v) => updateActive({ purchasePrice: v })} prefix="$" />
            <Field label="Down payment" value={active.downPct} onChange={(v) => updateActive({ downPct: v })} suffix="%" step="0.5" />
            <Field label="Interest rate" value={active.interestRate} onChange={(v) => updateActive({ interestRate: v })} suffix="%" step="0.125" />
            <Field label="Loan term" value={active.loanTermYears} onChange={(v) => updateActive({ loanTermYears: v })} suffix="yrs" />
            <Field label="Closing costs" value={active.closingCostPct} onChange={(v) => updateActive({ closingCostPct: v })} suffix="%" step="0.25" />
            <Field label="Rehab / repair budget" value={active.rehabCost} onChange={(v) => updateActive({ rehabCost: v })} prefix="$" />
          </div>

          {/* Carrying costs */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Carrying costs (annual)</h3>
            <Field label="Property taxes" value={active.annualTaxes} onChange={(v) => updateActive({ annualTaxes: v })} prefix="$" />
            <Field label="Insurance" value={active.annualInsurance} onChange={(v) => updateActive({ annualInsurance: v })} prefix="$" />
          </div>

          {/* Rental income */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Rental income</h3>
            <Field label="Monthly rent estimate" value={active.rentEstimate} onChange={(v) => updateActive({ rentEstimate: v })} prefix="$" />
            <Field label="Vacancy rate" value={active.vacancyPct} onChange={(v) => updateActive({ vacancyPct: v })} suffix="%" />
            <Field label="Property management" value={active.managementPct} onChange={(v) => updateActive({ managementPct: v })} suffix="%" />
            <Field label="Maintenance / CapEx" value={active.maintenancePct} onChange={(v) => updateActive({ maintenancePct: v })} suffix="%" />
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Key metrics */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Investment metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric
                label="Monthly cash flow"
                value={(calc.monthlyCashFlow >= 0 ? '+' : '') + fmtMoney(calc.monthlyCashFlow)}
                sub={`${fmtMoney(Math.abs(calc.annualCashFlow))}/yr`}
                highlight={cashFlowColor}
              />
              <Metric label="Cap rate" value={fmt(calc.capRate, 2) + '%'} highlight="neutral" />
              <Metric
                label="Cash-on-cash return"
                value={fmt(calc.cashOnCash, 2) + '%'}
                highlight={calc.cashOnCash >= 8 ? 'green' : calc.cashOnCash >= 0 ? 'neutral' : 'red'}
              />
              <Metric label="Cash to close" value={fmtMoney(calc.cashToClose)} highlight="neutral" />
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly payment breakdown</h3>
            <div className="space-y-2 text-sm">
              <Row label="Loan amount" value={fmtMoney(calc.loanAmount)} />
              <Row label="Down payment" value={fmtMoney(calc.downAmount)} sub={`${active.downPct}%`} />
              <div className="border-t border-gray-100 my-2" />
              <Row label="Principal + interest" value={fmtMoney(calc.pi)} />
              <Row label="Property taxes" value={fmtMoney(calc.monthlyTaxes)} sub="monthly" />
              <Row label="Insurance" value={fmtMoney(calc.monthlyInsurance)} sub="monthly" />
              <div className="border-t border-gray-100 my-2" />
              <Row label="Total PITI" value={fmtMoney(calc.totalPITI)} bold />
            </div>
          </div>

          {/* Cash to close */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Cash to close</h3>
            <div className="space-y-2 text-sm">
              <Row label="Down payment" value={fmtMoney(calc.downAmount)} />
              <Row label={`Closing costs (${active.closingCostPct}%)`} value={fmtMoney(calc.closingCosts)} />
              <Row label="Rehab budget" value={fmtMoney(active.rehabCost)} />
              <div className="border-t border-gray-100 my-2" />
              <Row label="Total cash required" value={fmtMoney(calc.cashToClose)} bold />
            </div>
          </div>

          {/* Cash flow breakdown */}
          {active.rentEstimate > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly cash flow breakdown</h3>
              <div className="space-y-2 text-sm">
                <Row label="Gross rent" value={fmtMoney(active.rentEstimate)} />
                <Row label={`Vacancy (${active.vacancyPct}%)`} value={'−' + fmtMoney(active.rentEstimate * active.vacancyPct / 100)} />
                <Row label="Effective rent" value={fmtMoney(calc.effectiveRent)} bold />
                <div className="border-t border-gray-100 my-2" />
                <Row label="Total PITI" value={'−' + fmtMoney(calc.totalPITI)} />
                <Row label={`Management (${active.managementPct}%)`} value={'−' + fmtMoney(calc.managementFee)} />
                <Row label={`Maintenance (${active.maintenancePct}%)`} value={'−' + fmtMoney(calc.maintenanceFee)} />
                <div className="border-t border-gray-100 my-2" />
                <Row
                  label="Net monthly cash flow"
                  value={(calc.monthlyCashFlow >= 0 ? '+' : '') + fmtMoney(calc.monthlyCashFlow)}
                  bold
                  color={calc.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}
                />
              </div>
            </div>
          )}

          {/* Scenario comparison */}
          {scenarios.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Scenario comparison</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                    <th className="pb-2 font-medium">Scenario</th>
                    <th className="pb-2 font-medium text-right">Purchase</th>
                    <th className="pb-2 font-medium text-right">Cash to close</th>
                    <th className="pb-2 font-medium text-right">PITI</th>
                    <th className="pb-2 font-medium text-right">Cash flow/mo</th>
                    <th className="pb-2 font-medium text-right">CoC return</th>
                    <th className="pb-2 font-medium text-right">Cap rate</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => {
                    const c = calcScenario(s)
                    const isActive = s.id === activeId
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setActiveId(s.id)}
                        className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${isActive ? 'bg-blue-50' : ''}`}
                      >
                        <td className="py-2 font-medium text-gray-900">{s.label}</td>
                        <td className="py-2 text-right text-gray-700">{fmtMoney(s.purchasePrice)}</td>
                        <td className="py-2 text-right text-gray-700">{fmtMoney(c.cashToClose)}</td>
                        <td className="py-2 text-right text-gray-700">{fmtMoney(c.totalPITI)}</td>
                        <td className={`py-2 text-right font-medium ${c.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {(c.monthlyCashFlow >= 0 ? '+' : '') + fmtMoney(c.monthlyCashFlow)}
                        </td>
                        <td className="py-2 text-right text-gray-700">{fmt(c.cashOnCash, 2)}%</td>
                        <td className="py-2 text-right text-gray-700">{fmt(c.capRate, 2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  sub,
  bold,
  color,
}: {
  label: string
  value: string
  sub?: string
  bold?: boolean
  color?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-gray-600 ${bold ? 'font-semibold text-gray-900' : ''}`}>
        {label}
        {sub && <span className="text-gray-400 font-normal ml-1">({sub})</span>}
      </span>
      <span className={`${bold ? 'font-semibold' : ''} ${color ?? 'text-gray-900'}`}>{value}</span>
    </div>
  )
}