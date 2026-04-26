'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type RiskLevel = 'Urgent' | 'Warning' | 'On Track'

interface Task {
  id: string
  title: string
  due_date: string | null
  completed: boolean
}

interface Deal {
  id: string
  property_id: string
  closing_date: string | null
  address: string
  progress: number
  nextTask: string | null
  nextDeadline: string | null
  risk: RiskLevel
}

interface AlertItem {
  property_id: string
  address: string
  task_title: string
  due_date: string
  type: 'overdue' | 'upcoming'
}

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) return

      const { data: dealsData } = await supabase
        .from('deals')
        .select(`
          id,
          property_id,
          closing_date,
          properties ( address, pipeline_status ),
          deal_tasks ( id, title, due_date, completed )
        `)
        .eq('workspace_id', membership.workspace_id)

      if (!dealsData) { setLoading(false); return }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const in3Days = new Date(today)
      in3Days.setDate(today.getDate() + 3)
      const in7Days = new Date(today)
      in7Days.setDate(today.getDate() + 7)

      const processedDeals: Deal[] = []
      const alertList: AlertItem[] = []

      for (const deal of dealsData) {
        const propData = deal.properties as { address: string; pipeline_status: string } | { address: string; pipeline_status: string }[] | null
const prop = Array.isArray(propData) ? (propData[0] ?? null) : propData
        if (!prop || prop.pipeline_status !== 'Under Contract') continue

        const tasks: Task[] = deal.deal_tasks || []
        const total = tasks.length
        const completedCount = tasks.filter(t => t.completed).length
        const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

        const incompleteSorted = tasks
          .filter(t => !t.completed && t.due_date)
          .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())

        const nextTask = incompleteSorted[0]?.title ?? null
        const nextDeadline = incompleteSorted[0]?.due_date ?? null

        let risk: RiskLevel = 'On Track'
        outer: for (const t of tasks) {
          if (!t.completed && t.due_date) {
            const due = new Date(t.due_date)
            due.setHours(0, 0, 0, 0)
            if (due < today) { risk = 'Urgent'; break outer }
            if (due <= in3Days) risk = 'Warning'
          }
        }

        for (const t of tasks) {
          if (!t.completed && t.due_date) {
            const due = new Date(t.due_date)
            due.setHours(0, 0, 0, 0)
            if (due < today) {
              alertList.push({ property_id: deal.property_id, address: prop.address, task_title: t.title, due_date: t.due_date, type: 'overdue' })
            } else if (due <= in7Days) {
              alertList.push({ property_id: deal.property_id, address: prop.address, task_title: t.title, due_date: t.due_date, type: 'upcoming' })
            }
          }
        }

        processedDeals.push({ id: deal.id, property_id: deal.property_id, closing_date: deal.closing_date, address: prop.address, progress, nextTask, nextDeadline, risk })
      }

      alertList.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'overdue' ? -1 : 1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })

      setDeals(processedDeals)
      setAlerts(alertList)
      setLoading(false)
    }

    load()
  }, [])

  function fmt(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const riskStyle: Record<RiskLevel, string> = {
    Urgent: 'bg-red-100 text-red-700',
    Warning: 'bg-yellow-100 text-yellow-700',
    'On Track': 'bg-green-100 text-green-700',
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Alert Panel */}
      {alerts.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-3">Alerts</h2>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <Link
                key={i}
                href={`/dashboard/deals/${alert.property_id}`}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${alert.type === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {alert.type === 'overdue' ? 'Overdue' : 'Due Soon'}
                </span>
                <span className="text-sm text-gray-800">
                  <span className="font-medium">{alert.address}</span>
                  <span className="text-gray-500"> — {alert.task_title} — due {fmt(alert.due_date)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Portfolio Table */}
      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-3">Active Deals</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-gray-500">No active deals. Move a property to Under Contract on the pipeline board to see it here.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Next Task</th>
                  <th className="px-4 py-3 font-medium">Next Deadline</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Closing Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deals.map(deal => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{deal.address}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${deal.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{deal.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{deal.nextTask ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(deal.nextDeadline)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskStyle[deal.risk]}`}>
                        {deal.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmt(deal.closing_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/deals/${deal.property_id}`} className="text-blue-600 hover:underline text-xs font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}