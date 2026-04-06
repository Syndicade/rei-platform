'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Property = {
  id: string
  address: string
  city: string
  state: string
  zip: string
  list_price: number | null
  property_type: string | null
  occupancy_status: string | null
  pipeline_status: string
  rating: number | null
}

type Stage = {
  id: string
  label: string
  hiddenByDefault: boolean
}

const DEFAULT_STAGES: Stage[] = [
  { id: 'new-match',      label: 'New Match',      hiddenByDefault: false },
  { id: 'saved',          label: 'Saved',          hiddenByDefault: false },
  { id: 'analyzing',      label: 'Analyzing',      hiddenByDefault: false },
  { id: 'pursuing',       label: 'Pursuing',       hiddenByDefault: false },
  { id: 'under-contract', label: 'Under Contract', hiddenByDefault: false },
  { id: 'closed',         label: 'Closed',         hiddenByDefault: true  },
  { id: 'lost',           label: 'Lost',           hiddenByDefault: true  },
]

const STORAGE_KEY = 'rei-pipeline-stages'

function loadStages(): Stage[] {
  if (typeof window === 'undefined') return DEFAULT_STAGES
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_STAGES
  } catch {
    return DEFAULT_STAGES
  }
}

function saveStages(stages: Stage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stages))
}

export default function PipelinePage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES)
  const [showClosed, setShowClosed] = useState(false)
  const [managing, setManaging] = useState(false)
  const [editingStages, setEditingStages] = useState<Stage[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const dragPropertyId = useRef<string | null>(null)
  const dragSourceStage = useRef<string | null>(null)

  useEffect(() => { setStages(loadStages()) }, [])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, city, state, zip, list_price, property_type, occupancy_status, pipeline_status, rating')
        .order('created_at', { ascending: false })
      if (!error && data) setProperties(data)
      setLoading(false)
    }
    load()
  }, [])

  function handleDragStart(propertyId: string, stageLabel: string) {
    dragPropertyId.current = propertyId
    dragSourceStage.current = stageLabel
  }

  function handleDragOver(e: React.DragEvent, stageLabel: string) {
    e.preventDefault()
    setDragOverStage(stageLabel)
  }

  function handleDragLeave() {
    setDragOverStage(null)
  }

  async function handleDrop(e: React.DragEvent, targetStageLabel: string) {
    e.preventDefault()
    setDragOverStage(null)
    const propId = dragPropertyId.current
    if (!propId || dragSourceStage.current === targetStageLabel) return

    // Optimistically update UI
    setProperties(prev =>
      prev.map(p => p.id === propId ? { ...p, pipeline_status: targetStageLabel } : p)
    )

    // Save to Supabase
    const { error } = await supabase
      .from('properties')
      .update({ pipeline_status: targetStageLabel })
      .eq('id', propId)

    if (error) {
      // Revert on failure
      setProperties(prev =>
        prev.map(p => p.id === propId ? { ...p, pipeline_status: dragSourceStage.current! } : p)
      )
    }

    dragPropertyId.current = null
    dragSourceStage.current = null
  }

  function openManage() {
    setEditingStages(stages.map(s => ({ ...s })))
    setNewLabel('')
    setManaging(true)
  }

  function handleLabelChange(id: string, value: string) {
    setEditingStages(prev => prev.map(s => s.id === id ? { ...s, label: value } : s))
  }

  function handleToggleHidden(id: string) {
    setEditingStages(prev => prev.map(s => s.id === id ? { ...s, hiddenByDefault: !s.hiddenByDefault } : s))
  }

  function handleAddStage() {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    const newStage: Stage = {
      id: trimmed.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      label: trimmed,
      hiddenByDefault: false,
    }
    setEditingStages(prev => [...prev, newStage])
    setNewLabel('')
  }

  function handleDeleteStage(id: string) {
    setEditingStages(prev => prev.filter(s => s.id !== id))
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const updated = [...editingStages]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setEditingStages(updated)
  }

  function handleMoveDown(index: number) {
    if (index === editingStages.length - 1) return
    const updated = [...editingStages]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setEditingStages(updated)
  }

  async function handleSaveStages() {
    const cleaned = editingStages.filter(s => s.label.trim() !== '')
    for (const editedStage of cleaned) {
      const original = stages.find(s => s.id === editedStage.id)
      if (original && original.label !== editedStage.label) {
        await supabase
          .from('properties')
          .update({ pipeline_status: editedStage.label })
          .eq('pipeline_status', original.label)
      }
    }
    saveStages(cleaned)
    setStages(cleaned)
    setManaging(false)
  }

  const visibleStages = stages.filter(s => showClosed ? true : !s.hiddenByDefault)

  function getPropertiesForStage(stage: Stage) {
    return properties.filter(p => p.pipeline_status === stage.label)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading pipeline...</div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            {properties.length} total {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-4 py-2 transition-colors"
          >
            {showClosed ? 'Hide closed & lost' : 'Show closed & lost'}
          </button>
          <button
            onClick={openManage}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-4 py-2 transition-colors"
          >
            Manage stages
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${visibleStages.length}, 280px)` }}
        >
          {visibleStages.map(stage => {
            const stageProperties = getPropertiesForStage(stage)
            const isOver = dragOverStage === stage.label
            return (
              <div
                key={stage.id}
                className="flex flex-col min-h-0"
                onDragOver={(e) => handleDragOver(e, stage.label)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.label)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {stage.label}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {stageProperties.length}
                  </span>
                </div>
                <div className={`flex flex-col gap-3 min-h-24 rounded-xl p-2 transition-colors ${isOver ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}`}>
                  {stageProperties.length === 0 && !isOver ? (
                    <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-xs text-gray-400">
                      No properties
                    </div>
                  ) : (
                    stageProperties.map(property => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                        onDragStart={() => handleDragStart(property.id, property.pipeline_status)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {managing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Manage stages</h2>
            <p className="text-sm text-gray-500 mb-5">Rename, reorder, add, or remove pipeline stages.</p>
            <div className="flex flex-col gap-2 mb-5">
              {editingStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleMoveUp(index)} disabled={index === 0}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => handleMoveDown(index)} disabled={index === editingStages.length - 1}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <input value={stage.label} onChange={e => handleLabelChange(stage.id, e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900" />
                  <button onClick={() => handleToggleHidden(stage.id)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${stage.hiddenByDefault ? 'border-gray-200 text-gray-400 bg-gray-50' : 'border-blue-200 text-blue-600 bg-blue-50'}`}>
                    {stage.hiddenByDefault ? 'Hidden' : 'Visible'}
                  </button>
                  <button onClick={() => handleDeleteStage(stage.id)}
                    className="text-gray-300 hover:text-red-500 text-sm transition-colors">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-6">
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                placeholder="New stage name..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={handleAddStage}
                className="px-4 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">Add</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveStages}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save changes</button>
              <button onClick={() => setManaging(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PropertyCard({
  property,
  onClick,
  onDragStart,
}: {
  property: Property
  onClick: () => void
  onDragStart: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-grab active:cursor-grabbing text-left w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-medium text-gray-900 leading-snug">{property.address}</p>
      <p className="text-xs text-gray-400 mt-0.5">{property.city}, {property.state} {property.zip}</p>
      <div className="border-t border-gray-100 my-3" />
      <div className="flex flex-col gap-1.5">
        {property.list_price && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Price</span>
            <span className="text-xs font-medium text-gray-800">${property.list_price.toLocaleString()}</span>
          </div>
        )}
        {property.property_type && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Type</span>
            <span className="text-xs text-gray-700">{property.property_type}</span>
          </div>
        )}
        {property.occupancy_status && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Occupancy</span>
            <span className="text-xs text-gray-700">{property.occupancy_status}</span>
          </div>
        )}
      </div>
{property.rating && (
        <div className="mt-3 text-amber-400 text-xs tracking-tight">
          {'★'.repeat(property.rating)}{'☆'.repeat(5 - property.rating)}
        </div>
      )}
      {property.pipeline_status === 'Under Contract' && (
        <Link
          href={`/dashboard/deals/${property.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 block text-xs text-blue-600 hover:underline"
        >
          View Deal Tracker →
        </Link>
      )}
    </div>
  )
}