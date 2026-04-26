'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROLES = ['Lender', 'Inspector', 'Title', 'Contractor', 'Insurance Agent', 'Agent', 'Attorney', 'Other']

interface Contact {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
}

const empty = { name: '', role: 'Lender', email: '', phone: '' }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setWorkspaceId(membership.workspace_id)

      const { data } = await supabase
        .from('contacts')
        .select('id, name, role, email, phone')
        .eq('workspace_id', membership.workspace_id)
        .order('name')

      setContacts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function openNew() {
    setEditingId(null)
    setForm(empty)
    setError(null)
    setShowForm(true)
  }

  function openEdit(contact: Contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      role: contact.role,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(empty)
    setError(null)
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!workspaceId) return
    setSaving(true)
    setError(null)

    if (editingId) {
      const { error: err } = await supabase
        .from('contacts')
        .update({ name: form.name.trim(), role: form.role, email: form.email || null, phone: form.phone || null })
        .eq('id', editingId)

      if (err) { setError(err.message); setSaving(false); return }

      setContacts(prev => prev.map(c => c.id === editingId
        ? { ...c, name: form.name.trim(), role: form.role, email: form.email || null, phone: form.phone || null }
        : c
      ))
    } else {
      const { data, error: err } = await supabase
        .from('contacts')
        .insert({ workspace_id: workspaceId, name: form.name.trim(), role: form.role, email: form.email || null, phone: form.phone || null })
        .select('id, name, role, email, phone')
        .single()

      if (err || !data) { setError(err?.message ?? 'Failed to save.'); setSaving(false); return }
      setContacts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }

    setSaving(false)
    cancel()
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        {!showForm && (
          <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Add Contact
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-900">{editingId ? 'Edit Contact' : 'New Contact'}</h2>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(419) 555-0100"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Contact'}
            </button>
            <button onClick={cancel} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact List */}
      {contacts.length === 0 && !showForm ? (
        <p className="text-sm text-gray-500">No contacts yet. Add your first contact to get started.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map(contact => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{contact.name}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.role}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(contact)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                    <button onClick={() => remove(contact.id)} className="text-red-500 hover:underline text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}