'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Document = {
  id: string
  name: string
  type: string
  url: string
  created_at: string
  property_id: string
  property_address: string
}

const TYPE_COLORS: Record<string, string> = {
  'Inspection Report':  'bg-blue-100 text-blue-700',
  'Purchase Agreement': 'bg-purple-100 text-purple-700',
  'Closing Doc':        'bg-green-100 text-green-700',
  'Photo':              'bg-yellow-100 text-yellow-700',
  'Other':              'bg-gray-100 text-gray-600',
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
      if (!member) return

      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, type, url, created_at, property_id, properties(address)')
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })

      if (docs) {
        setDocuments(docs.map((d: any) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          url: d.url,
          created_at: d.created_at,
          property_id: d.property_id,
          property_address: d.properties?.address ?? 'Unknown property',
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleDownload(doc: Document) {
    setDownloading(doc.id)
    const { data, error } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(doc.url, 60)

    if (error || !data?.signedUrl) {
      alert('Failed to generate download link.')
      setDownloading(null)
      return
    }

    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = doc.name
    a.click()
    setDownloading(null)
  }

  const filtered = documents.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.property_address.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {documents.length} document{documents.length !== 1 ? 's' : ''} across all properties
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, property, or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading documents…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            {search ? 'No documents match your search.' : 'No documents uploaded yet. Upload documents from any property detail page.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium max-w-xs truncate">
                    {doc.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[doc.type] ?? TYPE_COLORS['Other']}`}>
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/properties/${doc.property_id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {doc.property_address}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      {downloading === doc.id ? 'Preparing…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}