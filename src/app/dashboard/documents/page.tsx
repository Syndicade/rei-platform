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

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isImage(name: string) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension(name))
}

function isPDF(name: string) {
  return fileExtension(name) === 'pdf'
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  async function openPreview(doc: Document) {
    setPreviewDoc(doc)
    setPreviewUrl(null)
    setPreviewLoading(true)

    const { data, error } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(doc.url, 300) // 5 min expiry for preview

    if (!error && data?.signedUrl) {
      setPreviewUrl(data.signedUrl)
    }
    setPreviewLoading(false)
  }

  function closePreview() {
    setPreviewDoc(null)
    setPreviewUrl(null)
  }

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

  const previewSupported = previewDoc ? (isImage(previewDoc.name) || isPDF(previewDoc.name)) : false

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className={`flex-1 p-6 overflow-auto transition-all ${previewDoc ? 'max-w-xl' : ''}`}>
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

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, property, or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Loading documents…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              {search
                ? 'No documents match your search.'
                : 'No documents uploaded yet. Upload documents from any property detail page.'}
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
                  <tr
                    key={doc.id}
                    className={`hover:bg-gray-50 cursor-pointer ${previewDoc?.id === doc.id ? 'bg-indigo-50' : ''}`}
                    onClick={() => openPreview(doc)}
                  >
                    <td className="px-4 py-3 text-gray-900 font-medium max-w-[180px] truncate">
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
                        onClick={e => e.stopPropagation()}
                      >
                        {doc.property_address}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(doc) }}
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

      {/* Preview panel */}
      {previewDoc && (
        <div className="w-full max-w-2xl border-l border-gray-200 bg-white flex flex-col">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{previewDoc.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{previewDoc.property_address}</p>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <button
                onClick={() => handleDownload(previewDoc)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 border border-indigo-200 rounded-md hover:bg-indigo-50"
              >
                Download
              </button>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close preview"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Preview content */}
          <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
            {previewLoading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading preview…</p>
              </div>
            ) : !previewUrl ? (
              <div className="text-center px-6">
                <p className="text-sm text-gray-500">Preview unavailable.</p>
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="mt-2 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Download instead
                </button>
              </div>
            ) : !previewSupported ? (
              <div className="text-center px-6">
                <p className="text-sm text-gray-500 mb-3">Preview not available for this file type.</p>
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Download to view
                </button>
              </div>
            ) : isImage(previewDoc.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={previewDoc.name}
                className="max-w-full max-h-full object-contain p-4"
              />
            ) : (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={previewDoc.name}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}