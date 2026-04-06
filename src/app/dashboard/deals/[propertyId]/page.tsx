'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_MILESTONES = [
  'Contract',
  'Earnest Money',
  'Inspection',
  'Due Diligence',
  'Financing',
  'Appraisal',
  'Title',
  'Insurance',
  'Utilities',
  'Final Walkthrough',
  'Closing',
]

type Task = {
  id: string
  title: string
  due_date: string | null
  assignee: string | null
  completed: boolean
  milestone_id: string
}

type Milestone = {
  id: string
  name: string
  sort_order: number
  completed: boolean
  due_date: string | null
  tasks: Task[]
}

type Deal = {
  id: string
  contract_date: string | null
  closing_date: string | null
  purchase_price: number | null
}

type Contact = {
  id: string
  name: string
  role: string
  phone: string | null
  email: string | null
}

type DealContact = {
  id: string
  role: string
  contact: Contact
}

function getRiskLevel(tasks: Task[]): { label: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let hasUrgent = false
  let hasWarning = false
  for (const task of tasks) {
    if (task.completed || !task.due_date) continue
    const due = new Date(task.due_date)
    due.setHours(0, 0, 0, 0)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) { hasUrgent = true }
    else if (daysUntil <= 3) { hasWarning = true }
  }
  if (hasUrgent) return { label: 'Urgent', color: 'bg-red-100 text-red-700' }
  if (hasWarning) return { label: 'Warning', color: 'bg-yellow-100 text-yellow-800' }
  return { label: 'On Track', color: 'bg-green-100 text-green-700' }
}

export default function DealPage() {
  const { propertyId } = useParams()
  const [property, setProperty] = useState<{ address: string; city: string; state: string } | null>(null)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [dealContacts, setDealContacts] = useState<DealContact[]>([])
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)

  // Task form state
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null)

  // Deal info edit state
  const [editingDeal, setEditingDeal] = useState(false)
  const [contractDate, setContractDate] = useState('')
  const [closingDate, setClosingDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')

  // Contact assignment state
  const [addingContact, setAddingContact] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState('')
  const [selectedContactRole, setSelectedContactRole] = useState('')

  useEffect(() => {
    loadAll()
  }, [propertyId])

  async function loadAll() {
    setLoading(true)

    // Load property
    const { data: prop } = await supabase
      .from('properties')
      .select('address, city, state, workspace_id')
      .eq('id', propertyId)
      .single()

    if (!prop) { setLoading(false); return }
    setProperty(prop)

    // Load or create deal
    let { data: existingDeal } = await supabase
      .from('deals')
      .select('*')
      .eq('property_id', propertyId)
      .single()

    if (!existingDeal) {
      const { data: newDeal } = await supabase
        .from('deals')
        .insert({ property_id: propertyId, workspace_id: prop.workspace_id })
        .select()
        .single()
      existingDeal = newDeal
    }

    if (!existingDeal) { setLoading(false); return }
    setDeal(existingDeal)
    setContractDate(existingDeal.contract_date ?? '')
    setClosingDate(existingDeal.closing_date ?? '')
    setPurchasePrice(existingDeal.purchase_price ?? '')

    // Load milestones — create defaults if none exist
    let { data: ms } = await supabase
      .from('deal_milestones')
      .select('*')
      .eq('deal_id', existingDeal.id)
      .order('sort_order')

    if (!ms || ms.length === 0) {
      const inserts = DEFAULT_MILESTONES.map((name, i) => ({
        deal_id: existingDeal.id,
        name,
        sort_order: i,
      }))
      await supabase.from('deal_milestones').insert(inserts)
      const { data: fresh } = await supabase
        .from('deal_milestones')
        .select('*')
        .eq('deal_id', existingDeal.id)
        .order('sort_order')
      ms = fresh
    }

    // Load tasks
    const { data: tasks } = await supabase
      .from('deal_tasks')
      .select('*')
      .eq('deal_id', existingDeal.id)

    const combined: Milestone[] = (ms ?? []).map((m) => ({
      ...m,
      tasks: (tasks ?? []).filter((t) => t.milestone_id === m.id),
    }))
    setMilestones(combined)

    // Load deal contacts
    const { data: dc } = await supabase
      .from('deal_contacts')
      .select('id, role, contact:contacts(id, name, phone, email, role)')
      .eq('deal_id', existingDeal.id)
    setDealContacts((dc as unknown as DealContact[]) ?? [])

    // Load all workspace contacts for the dropdown
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', prop.workspace_id)
      .order('name')
    setAvailableContacts(allContacts ?? [])

    setLoading(false)
  }

  async function saveDealInfo() {
    if (!deal) return
    await supabase.from('deals').update({
      contract_date: contractDate || null,
      closing_date: closingDate || null,
      purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
    }).eq('id', deal.id)
    setDeal({ ...deal, contract_date: contractDate, closing_date: closingDate, purchase_price: purchasePrice ? parseFloat(purchasePrice) : null })
    setEditingDeal(false)
  }

  async function toggleMilestone(m: Milestone) {
    const updated = !m.completed
    await supabase.from('deal_milestones').update({ completed: updated }).eq('id', m.id)
    setMilestones(milestones.map((x) => x.id === m.id ? { ...x, completed: updated } : x))
  }

  async function toggleTask(task: Task) {
    const updated = !task.completed
    await supabase.from('deal_tasks').update({ completed: updated }).eq('id', task.id)
    setMilestones(milestones.map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => t.id === task.id ? { ...t, completed: updated } : t),
    })))
  }

  async function addTask(milestoneId: string) {
    if (!newTaskTitle.trim() || !deal) return
    const { data: task } = await supabase.from('deal_tasks').insert({
      deal_id: deal.id,
      milestone_id: milestoneId,
      title: newTaskTitle.trim(),
      due_date: newTaskDue || null,
      assignee: newTaskAssignee.trim() || null,
      completed: false,
    }).select().single()
    if (task) {
      setMilestones(milestones.map((m) =>
        m.id === milestoneId ? { ...m, tasks: [...m.tasks, task] } : m
      ))
    }
    setNewTaskTitle('')
    setNewTaskDue('')
    setNewTaskAssignee('')
    setAddingTaskTo(null)
  }

  async function deleteTask(taskId: string, milestoneId: string) {
    await supabase.from('deal_tasks').delete().eq('id', taskId)
    setMilestones(milestones.map((m) =>
      m.id === milestoneId ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) } : m
    ))
  }

  async function assignContact() {
    if (!deal || !selectedContactId || !selectedContactRole.trim()) return
    const { data: dc } = await supabase.from('deal_contacts').insert({
      deal_id: deal.id,
      contact_id: selectedContactId,
      role: selectedContactRole.trim(),
    }).select('id, role, contact:contacts(id, name, phone, email, role)').single()
    if (dc) setDealContacts([...dealContacts, dc as unknown as DealContact])
    setSelectedContactId('')
    setSelectedContactRole('')
    setAddingContact(false)
  }

  async function removeDealContact(dcId: string) {
    await supabase.from('deal_contacts').delete().eq('id', dcId)
    setDealContacts(dealContacts.filter((dc) => dc.id !== dcId))
  }

  const allTasks = milestones.flatMap((m) => m.tasks)
  const completedTasks = allTasks.filter((t) => t.completed).length
  const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0
  const risk = getRiskLevel(allTasks)

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!property || !deal) return <div className="p-8 text-gray-500">Deal not found.</div>

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <Link href={`/dashboard/properties/${propertyId}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to property
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          {property.address}, {property.city}, {property.state}
        </h1>
        <div className="flex items-center gap-4 mt-2">
          <span className={`text-sm font-medium px-2 py-1 rounded ${risk.color}`}>{risk.label}</span>
          <span className="text-sm text-gray-500">{progress}% complete ({completedTasks} of {allTasks.length} tasks)</span>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full w-full">
          <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Deal Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Deal Info</h2>
          <button onClick={() => setEditingDeal(!editingDeal)} className="text-sm text-blue-600 hover:underline">
            {editingDeal ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editingDeal ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Contract Date</label>
              <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Closing Date</label>
              <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Purchase Price</label>
              <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-3">
              <button onClick={saveDealInfo}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-gray-500">Contract Date</div>
              <div className="font-medium text-gray-900">{deal.contract_date ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Closing Date</div>
              <div className="font-medium text-gray-900">{deal.closing_date ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Purchase Price</div>
              <div className="font-medium text-gray-900">
                {deal.purchase_price ? `$${deal.purchase_price.toLocaleString()}` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones & Tasks</h2>
        <div className="space-y-3">
          {milestones.map((m) => {
            const mTasks = m.tasks
            const mCompleted = mTasks.filter((t) => t.completed).length
            const isOpen = expandedMilestone === m.id
            return (
              <div key={m.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Milestone row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedMilestone(isOpen ? null : m.id)}>
                  <input type="checkbox" checked={m.completed}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleMilestone(m)}
                    className="w-4 h-4 rounded" />
                  <span className={`flex-1 font-medium text-sm ${m.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {m.name}
                  </span>
                  <span className="text-xs text-gray-400">{mCompleted}/{mTasks.length} tasks</span>
                  <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Tasks */}
                {isOpen && (
                  <div className="px-4 py-3 space-y-2">
                    {mTasks.length === 0 && (
                      <p className="text-sm text-gray-400">No tasks yet.</p>
                    )}
                    {mTasks.map((task) => {
                      const today = new Date(); today.setHours(0,0,0,0)
                      const due = task.due_date ? new Date(task.due_date) : null
                      if (due) due.setHours(0,0,0,0)
                      const overdue = due && !task.completed && due < today
                      const dueSoon = due && !task.completed && !overdue &&
                        Math.ceil((due.getTime() - today.getTime()) / 86400000) <= 3
                      return (
                        <div key={task.id} className="flex items-start gap-3 py-2 border-t border-gray-100 first:border-0">
                          <input type="checkbox" checked={task.completed}
                            onChange={() => toggleTask(task)}
                            className="mt-0.5 w-4 h-4 rounded" />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {task.title}
                            </div>
                            <div className="flex gap-3 mt-0.5 text-xs">
                              {task.due_date && (
                                <span className={overdue ? 'text-red-600 font-medium' : dueSoon ? 'text-yellow-700 font-medium' : 'text-gray-400'}>
                                  Due {task.due_date}{overdue ? ' — Overdue' : dueSoon ? ' — Due soon' : ''}
                                </span>
                              )}
                              {task.assignee && <span className="text-gray-400">{task.assignee}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteTask(task.id, m.id)}
                            className="text-gray-300 hover:text-red-400 text-xs mt-0.5">
                            Remove
                          </button>
                        </div>
                      )
                    })}

                    {/* Add task form */}
                    {addingTaskTo === m.id ? (
                      <div className="border-t border-gray-100 pt-3 space-y-2">
                        <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Task title" className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
                        <div className="flex gap-2">
                          <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
                          <input value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                            placeholder="Assignee" className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => addTask(m.id)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
                            Add task
                          </button>
                          <button onClick={() => setAddingTaskTo(null)}
                            className="text-gray-500 px-3 py-1.5 text-sm hover:text-gray-700">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTaskTo(m.id)}
                        className="text-sm text-blue-600 hover:underline mt-1">
                        + Add task
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Deal Contacts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Deal Contacts</h2>
          <button onClick={() => setAddingContact(!addingContact)}
            className="text-sm text-blue-600 hover:underline">
            {addingContact ? 'Cancel' : '+ Assign contact'}
          </button>
        </div>

        {addingContact && (
          <div className="flex gap-3 mb-4">
            <select value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">Select a contact</option>
              {availableContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input value={selectedContactRole} onChange={(e) => setSelectedContactRole(e.target.value)}
              placeholder="Role (e.g. Lender)" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
            <button onClick={assignContact}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Assign
            </button>
          </div>
        )}

        {dealContacts.length === 0 ? (
          <p className="text-sm text-gray-400">No contacts assigned to this deal yet.</p>
        ) : (
          <div className="space-y-3">
            {dealContacts.map((dc) => (
              <div key={dc.id} className="flex items-center justify-between py-2 border-t border-gray-100 first:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{dc.contact?.name}</div>
                  <div className="text-xs text-gray-400">{dc.role}</div>
                  <div className="text-xs text-gray-400">{dc.contact?.phone} {dc.contact?.email}</div>
                </div>
                <button onClick={() => removeDealContact(dc.id)}
                  className="text-gray-300 hover:text-red-400 text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}