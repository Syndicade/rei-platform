'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DealRow = {
  id: string
  property_id: string
  contract_date: string | null
  closing_date: string | null
  purchase_price: number | null
  property: {
    address: string
    city: string
    state: string
  }
  taskStats: {
    total: number
    completed: number
  }
  risk: {
    label: string
    color: string
  }
}

function getRiskLevel(tasks: { completed: boolean; due_date: string | null }[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let hasUrgent = false
  let hasWarning = false
  for (const task of tasks) {
    if (task.completed || !task.due_date) continue
    const due = new Date(task.due_date)
    due.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) hasUrgent = true
    else if (daysUntil <= 3) hasWarning = true
  }
  if (hasUrgent) return { label: 'Urgent', color: 'bg-red-100 text-red-700' }
  if (hasWarning) return { label: 'Warning', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'On Track', color: 'bg-green-100 text-green-700' }
}

export default function DealsIndexPage() {
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeals()
  }, [])

  async function loadDeals() {
    setLoading(true)

    // Load all deals with their property
    const { data: dealData } = await supabase
      .from('deals')
      .select('id, property_id, contract_date, closing_date, purchase_price, property:properties(address, city, state)')

    if (!dealData || dealData.length === 0) {
      setDeals([])
      setLoading(false)
      return
    }

    // Filter to only Under Contract properties
    const { data: contractedProps } = await supabase
      .from('properties')
      .select('id')
      .eq('pipeline_status', 'Under Contract')

    const contractedIds = new Set((contractedProps ?? []).map((p) => p.id))
    const filteredDeals = dealData.filter((d) => contractedIds.has(d.property_id))

    if (filteredDeals.length === 0) {
      setDeals([])
      setLoading(false)
      return
    }

    // Load all tasks for these deals
    const dealIds = filteredDeals.map((d) => d.id)
    const { data: tasks } = await supabase
      .from('deal_tasks')
      .select('deal_id, completed, due_date')
      .in('deal_id', dealIds)

    const rows: DealRow[] = filteredDeals.map((d) => {
      const dealTasks = (tasks ?? []).filter((t) => t.deal_id === d.id)
      return {
        id: d.id,
        property_id: d.property_id,
        contract_date: d.contract_date,
        closing_date: d.closing_date,
        purchase_price: d.purchase_price,
        property: (Array.isArray(d.property) ? d.property[0] : d.property) as { address: string; city: string; state: string },
        taskStats: {
          total: dealTasks.length,
          completed: dealTasks.filter((t) => t.completed).length,
        },
        risk: getRiskLevel(dealTasks),
      }
    })

    setDeals(rows)
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Active Deals</h1>
        <p className="text-sm text-gray-500 mt-1">Properties currently under contract</p>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">No active deals. Move a property to Under Contract to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const progress = deal.taskStats.total > 0
              ? Math.round((deal.taskStats.completed / deal.taskStats.total) * 100)
              : 0
            return (
              <Link key={deal.id} href={`/dashboard/deals/${deal.property_id}`}
                className="block bg-white border border-gray-200 rounded-xl px-6 py-5 hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{deal.property?.address}</div>
                    <div className="text-sm text-gray-400">{deal.property?.city}, {deal.property?.state}</div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {deal.purchase_price && (
                      <div className="text-sm font-medium text-gray-700">
                        ${deal.purchase_price.toLocaleString()}
                      </div>
                    )}
                    {deal.closing_date && (
                      <div className="text-sm text-gray-400">
                        Closes {new Date(deal.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded ${deal.risk.color}`}>
                      {deal.risk.label}
                    </span>
                    <div className="text-sm text-gray-400 w-24 text-right">
                      {deal.taskStats.completed}/{deal.taskStats.total} tasks
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full">
                  <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}