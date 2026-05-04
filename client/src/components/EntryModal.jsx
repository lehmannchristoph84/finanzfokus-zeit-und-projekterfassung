import { useState } from 'react'

const CHANNELS = ['Vor Ort', 'Teams', 'Telefon', 'E-Mail', 'Andere']

export default function EntryModal({ projectId, entry, hourlyRate, onClose, onSaved }) {
  const isEdit = !!entry
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    entry_date:  entry?.entry_date || today,
    channel:     entry?.channel || 'Vor Ort',
    description: entry?.description || '',
    hours:       entry?.hours || '',
    is_free:     entry?.is_free || false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const chfPreview = form.is_free
    ? 0
    : (parseFloat(form.hours) || 0) * (hourlyRate || 125)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) return setError('Beschreibung erforderlich')
    if (!form.hours || isNaN(parseFloat(form.hours))) return setError('Stunden eingeben')
    setLoading(true)
    setError('')

    const payload = {
      entry_date:  form.entry_date || null,
      channel:     form.channel || null,
      description: form.description,
      hours:       parseFloat(form.hours),
      is_free:     form.is_free,
    }

    try {
      const url = isEdit
        ? `/api/entries/${entry.id}`
        : `/api/projects/${projectId}/entries`
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-ff-dunkel rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-semibold">{isEdit ? 'Eintrag bearbeiten' : 'Zeiteintrag hinzufügen'}</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Datum</label>
              <input className="input" type="date" value={form.entry_date}
                onChange={e => set('entry_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Kanal</label>
              <select className="input" value={form.channel}
                onChange={e => set('channel', e.target.value)}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Beschreibung *</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Was wurde gemacht?"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Stunden *</label>
              <input
                className="input"
                type="number"
                step="0.25"
                min="0"
                value={form.hours}
                onChange={e => set('hours', e.target.value)}
                placeholder="z. B. 1.5"
              />
            </div>
            <div>
              <label className="label">Betrag (berechnet)</label>
              <div className="input bg-ff-blau-hell border-ff-blau-mid text-ff-dunkel font-semibold">
                {form.is_free ? 'Kostenlos' : `CHF ${chfPreview.toFixed(2)}`}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-ff-orange-hell border border-ff-orange/30">
            <input
              type="checkbox"
              checked={form.is_free}
              onChange={e => set('is_free', e.target.checked)}
              className="w-4 h-4 rounded accent-ff-orange"
            />
            <div>
              <span className="text-sm font-medium text-ff-dunkel">Kostenlos (Erstgespräch)</span>
              <p className="text-xs text-ff-dunkel-mid">Stunden werden erfasst, CHF = 0</p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
