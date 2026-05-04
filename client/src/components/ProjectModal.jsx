import { useState } from 'react'

const THEMEN = ['Pensionsplanung', 'Finanzplanung', 'Firmengründung', 'Vorsorgeanalyse', 'Versicherungsanalyse', 'Diverse Arbeiten']

export default function ProjectModal({ onClose, onSaved, project }) {
  const isEdit = !!project
  const [form, setForm] = useState({
    client_name:     project?.client_name || '',
    topic:           project?.topic || '',
    year:            project?.year || new Date().getFullYear(),
    hourly_rate:     project?.hourly_rate || 125,
    flat_rate:       project?.flat_rate || '',
    flat_rate_note:  project?.flat_rate_note || '',
    discount_percent:project?.discount_percent || '',
    useFlat:         !!project?.flat_rate,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.client_name.trim()) return setError('Kundenname ist erforderlich')
    setLoading(true)
    setError('')

    const payload = {
      client_name:     form.client_name,
      topic:           form.topic || null,
      year:            Number(form.year),
      hourly_rate:     Number(form.hourly_rate) || 125,
      flat_rate:       form.useFlat && form.flat_rate ? Number(form.flat_rate) : null,
      flat_rate_note:  form.useFlat ? form.flat_rate_note : null,
      discount_percent:form.discount_percent ? Number(form.discount_percent) : null,
    }

    try {
      const url = isEdit ? `/api/projects/${project.id}` : '/api/projects'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="bg-ff-dunkel rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-semibold">{isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}</h2>
          <button onClick={onClose} className="text-ff-dunkel-mid hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Kundenname */}
          <div>
            <label className="label">Kunde / Name *</label>
            <input
              className="input"
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
              placeholder="z. B. Hofer Barbara"
              autoFocus
            />
          </div>

          {/* Thema */}
          <div>
            <label className="label">Thema</label>
            <input
              className="input"
              value={form.topic}
              onChange={e => set('topic', e.target.value)}
              placeholder="Thema eingeben..."
              list="themen-list"
            />
            <datalist id="themen-list">
              {THEMEN.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          {/* Jahr + Stundensatz */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Jahr</label>
              <select className="input" value={form.year} onChange={e => set('year', e.target.value)}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stundensatz (CHF)</label>
              <input
                className="input"
                type="number"
                step="5"
                value={form.hourly_rate}
                onChange={e => set('hourly_rate', e.target.value)}
              />
            </div>
          </div>

          {/* Pauschal Toggle */}
          <div className="border border-ff-blau-hell rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set('useFlat', !form.useFlat)}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.useFlat ? 'bg-ff-blau' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.useFlat ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-ff-dunkel">Pauschalpreis vereinbart</span>
            </label>

            {form.useFlat && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label">Pauschalpreis (CHF)</label>
                  <input
                    className="input"
                    type="number"
                    step="10"
                    value={form.flat_rate}
                    onChange={e => set('flat_rate', e.target.value)}
                    placeholder="z. B. 550"
                  />
                </div>
                <div>
                  <label className="label">Pauschalnotiz</label>
                  <input
                    className="input"
                    value={form.flat_rate_note}
                    onChange={e => set('flat_rate_note', e.target.value)}
                    placeholder="z. B. max. Pauschal 550.- abgemacht"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rabatt */}
          <div>
            <label className="label">Rabatt (%, optional)</label>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={form.discount_percent}
              onChange={e => set('discount_percent', e.target.value)}
              placeholder="z. B. 30"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Speichern...' : isEdit ? 'Speichern' : 'Projekt erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
