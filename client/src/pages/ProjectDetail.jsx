import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import EntryModal from '../components/EntryModal.jsx'
import ProjectModal from '../components/ProjectModal.jsx'

const CHANNELS = ['Vor Ort', 'Teams', 'Telefon', 'E-Mail', 'Andere']

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('de-CH')
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeTimer, setActiveTimer, refresh } = useApp()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [showEditProject, setShowEditProject] = useState(false)
  const [invoiceNote, setInvoiceNote] = useState('')
  const [showInvoiceInput, setShowInvoiceInput] = useState(false)

  // Stoppuhr State
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerDisplay, setTimerDisplay] = useState('00:00')
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0)
  const [showStopForm, setShowStopForm] = useState(false)
  const [stopForm, setStopForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    channel: 'Vor Ort',
    description: '',
    hours: '',
    is_free: false,
  })
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    loadProject()
  }, [id])

  // Timer-Tick
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
        const secs = (elapsed % 60).toString().padStart(2, '0')
        setTimerDisplay(`${mins}:${secs}`)
        setStopwatchSeconds(elapsed)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerRunning])

  async function loadProject() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}`)
      const data = await res.json()
      setProject(data)
    } finally {
      setLoading(false)
    }
  }

  function startTimer() {
    if (activeTimer && activeTimer.projectId !== Number(id)) {
      if (!window.confirm('Eine andere Stoppuhr läuft. Jetzt wechseln?')) return
    }
    startTimeRef.current = Date.now()
    setTimerRunning(true)
    setTimerDisplay('00:00')
    setActiveTimer({ projectId: Number(id), startTime: startTimeRef.current })
  }

  function stopTimer() {
    setTimerRunning(false)
    setActiveTimer(null)
    const hours = Math.round((stopwatchSeconds / 3600) * 4) / 4 // auf 15min runden
    setStopForm(f => ({
      ...f,
      hours: hours > 0 ? hours : 0.25,
      entry_date: new Date().toISOString().split('T')[0],
    }))
    setShowStopForm(true)
  }

  async function saveStopwatchEntry() {
    if (!stopForm.description.trim()) return alert('Beschreibung eingeben')
    const res = await fetch(`/api/projects/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entry_date:  stopForm.entry_date,
        channel:     stopForm.channel,
        description: stopForm.description,
        hours:       parseFloat(stopForm.hours) || 0.25,
        is_free:     stopForm.is_free,
      }),
    })
    if (res.ok) {
      setShowStopForm(false)
      setStopwatchSeconds(0)
      setTimerDisplay('00:00')
      setStopForm(f => ({ ...f, description: '', hours: '' }))
      loadProject()
      refresh()
    }
  }

  async function deleteEntry(entryId) {
    if (!window.confirm('Eintrag wirklich löschen?')) return
    await fetch(`/api/entries/${entryId}`, { method: 'DELETE' })
    loadProject()
    refresh()
  }

  async function markRechnung() {
    const note = window.prompt('Rechnungsnotiz (optional):', project.invoice_note || '')
    if (note === null) return
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'rechnung_gestellt',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_note: note,
      }),
    })
    loadProject()
    refresh()
  }

  async function markBezahlt() {
    if (!window.confirm('Als bezahlt markieren?')) return
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bezahlt' }),
    })
    loadProject()
    refresh()
  }

  function copyBexioNote() {
    if (!project) return
    const totalHours = project.entries?.filter(e => !e.is_free).reduce((s, e) => s + e.hours, 0) || 0
    const allHours = project.entries?.reduce((s, e) => s + e.hours, 0) || 0
    const betrag = project.flat_rate
      ? project.flat_rate
      : totalHours * (project.hourly_rate || 125)

    const text = [
      `Kunde: ${project.client_name}`,
      `Projekt: ${project.topic || '–'}`,
      `Stunden total: ${allHours.toFixed(2)} h`,
      `Verrechenbare Stunden: ${totalHours.toFixed(2)} h`,
      `Betrag: CHF ${fmtCHF(betrag)}`,
      project.flat_rate ? `Pauschal: CHF ${fmtCHF(project.flat_rate)} (${project.flat_rate_note || ''})` : '',
      `Status: ${project.status}`,
      `Datum: ${new Date().toLocaleDateString('de-CH')}`,
    ].filter(Boolean).join(' | ')

    navigator.clipboard.writeText(text).then(() => {
      alert('Bexio-Notiz kopiert!')
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ff-dunkel-mid">Laden...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-ff-dunkel-mid">Projekt nicht gefunden.</p>
        <button onClick={() => navigate('/projekte')} className="btn-primary mt-4">Zurück</button>
      </div>
    )
  }

  const entries = project.entries || []
  const billableEntries = entries.filter(e => !e.is_free)
  const totalHours = billableEntries.reduce((s, e) => s + e.hours, 0)
  const allHours = entries.reduce((s, e) => s + e.hours, 0)
  const totalCHF = project.flat_rate
    ? project.flat_rate
    : totalHours * (project.hourly_rate || 125)

  let rechnungsBetrag = totalCHF
  if (project.discount_percent) rechnungsBetrag *= 1 - project.discount_percent / 100
  rechnungsBetrag = Math.round(rechnungsBetrag * 20) / 20

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ff-dunkel-mid">
        <button onClick={() => navigate('/projekte')} className="hover:text-ff-blau transition-colors">
          Projekte
        </button>
        <span>/</span>
        <span className="text-ff-dunkel font-medium">{project.client_name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* LINKE SPALTE: Hauptinhalt */}
        <div className="flex-1 space-y-5">

          {/* Projekt-Header */}
          <div className="card">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-ff-dunkel">{project.client_name}</h1>
                {project.topic && (
                  <p className="text-ff-dunkel-mid mt-0.5">{project.topic}</p>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <StatusBadge status={project.status} />
                  <span className="text-xs text-ff-dunkel-mid">
                    CHF {project.hourly_rate || 125}.–/h
                  </span>
                  {project.flat_rate && (
                    <span className="text-xs bg-ff-gelb-hell text-ff-dunkel px-2 py-0.5 rounded-full">
                      Pauschal CHF {fmtCHF(project.flat_rate)}
                      {project.flat_rate_note && ` · ${project.flat_rate_note}`}
                    </span>
                  )}
                  {project.discount_percent && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      Rabatt {project.discount_percent}%
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowEditProject(true)}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Bearbeiten
              </button>
            </div>
          </div>

          {/* STOPPUHR */}
          <div className={`card border-2 ${timerRunning ? 'border-ff-orange' : showStopForm ? 'border-ff-blau' : 'border-ff-blau-hell'} transition-all`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Start/Stop Button */}
                {!timerRunning ? (
                  <button
                    onClick={startTimer}
                    disabled={showStopForm}
                    className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                  >
                    <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={stopTimer}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 animate-pulse"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </button>
                )}

                <div>
                  <div className={`text-3xl font-mono font-bold ${timerRunning ? 'text-ff-orange' : 'text-ff-dunkel-mid'}`}>
                    {timerDisplay}
                  </div>
                  <p className="text-xs text-ff-dunkel-mid mt-0.5">
                    {timerRunning ? 'Stoppuhr läuft...' : showStopForm ? 'Eintrag erfassen' : 'Stoppuhr starten'}
                  </p>
                </div>
              </div>

              {!timerRunning && !showStopForm && (
                <button
                  onClick={() => setShowEntryModal(true)}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Manuell erfassen
                </button>
              )}
            </div>

            {/* Formular nach Stopp */}
            {showStopForm && (
              <div className="mt-5 pt-5 border-t border-ff-blau-hell space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Datum</label>
                    <input className="input" type="date" value={stopForm.entry_date}
                      onChange={e => setStopForm(f => ({ ...f, entry_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Kanal</label>
                    <select className="input" value={stopForm.channel}
                      onChange={e => setStopForm(f => ({ ...f, channel: e.target.value }))}>
                      {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Beschreibung *</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    placeholder="Was wurde gemacht?"
                    value={stopForm.description}
                    onChange={e => setStopForm(f => ({ ...f, description: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Stunden (gerundet)</label>
                    <input className="input" type="number" step="0.25" min="0"
                      value={stopForm.hours}
                      onChange={e => setStopForm(f => ({ ...f, hours: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Betrag</label>
                    <div className="input bg-ff-blau-hell border-ff-blau-mid font-semibold text-ff-dunkel">
                      {stopForm.is_free ? 'Kostenlos' : `CHF ${fmtCHF((parseFloat(stopForm.hours) || 0) * (project.hourly_rate || 125))}`}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={stopForm.is_free}
                    onChange={e => setStopForm(f => ({ ...f, is_free: e.target.checked }))}
                    className="w-4 h-4 rounded accent-ff-orange" />
                  <span className="text-sm text-ff-dunkel">Kostenlos (Erstgespräch)</span>
                </label>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveStopwatchEntry} className="btn-primary">
                    Speichern
                  </button>
                  <button onClick={() => { setShowStopForm(false); setStopwatchSeconds(0); setTimerDisplay('00:00') }}
                    className="btn-secondary">
                    Verwerfen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Zeiteinträge Tabelle */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-ff-blau-hell flex items-center justify-between">
              <h2 className="font-semibold text-ff-dunkel">Zeiteinträge</h2>
              <span className="text-xs text-ff-dunkel-mid">{entries.length} Einträge</span>
            </div>

            {entries.length === 0 ? (
              <div className="p-8 text-center text-ff-dunkel-mid">
                Noch keine Einträge. Stoppuhr starten oder manuell erfassen.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left">Datum</th>
                      <th className="px-4 py-3 text-left">Kanal</th>
                      <th className="px-4 py-3 text-left">Beschreibung</th>
                      <th className="px-4 py-3 text-right">Std.</th>
                      <th className="px-4 py-3 text-right">CHF</th>
                      <th className="px-4 py-3 text-center">Kostenlos</th>
                      <th className="px-4 py-3 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => {
                      const chf = e.is_free ? 0 : e.hours * (project.hourly_rate || 125)
                      return (
                        <tr key={e.id} className={`table-row ${e.is_free ? 'bg-ff-orange-hell/40' : ''}`}>
                          <td className="px-4 py-2.5 text-sm text-ff-dunkel-mid whitespace-nowrap">
                            {fmtDate(e.entry_date)}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-ff-dunkel-mid">
                            {e.channel || '–'}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-ff-dunkel max-w-xs">
                            <span className={e.is_free ? 'italic text-ff-dunkel-mid' : ''}>
                              {e.description}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right font-mono">
                            {parseFloat(e.hours).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold">
                            {e.is_free
                              ? <span className="text-ff-orange text-xs">Kostenlos</span>
                              : `CHF ${fmtCHF(chf)}`
                            }
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {e.is_free
                              ? <span className="text-ff-orange text-lg">●</span>
                              : <span className="text-gray-200 text-lg">●</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditEntry(e)}
                                className="p-1 rounded hover:bg-ff-blau-hell text-ff-dunkel-mid transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteEntry(e.id)}
                                className="p-1 rounded hover:bg-red-50 text-red-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Total Zeile */}
                  <tfoot>
                    <tr className="bg-ff-dunkel text-white">
                      <td colSpan={3} className="px-4 py-3 font-bold text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-bold font-mono text-sm">
                        {allHours.toFixed(2)} h
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-sm" colSpan={3}>
                        {project.flat_rate ? (
                          <span>
                            <span className="text-ff-dunkel-mid line-through mr-2 font-normal">
                              CHF {fmtCHF(totalHours * (project.hourly_rate || 125))}
                            </span>
                            Pauschal CHF {fmtCHF(project.flat_rate)}
                          </span>
                        ) : (
                          `CHF ${fmtCHF(totalHours * (project.hourly_rate || 125))}`
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RECHTE SPALTE: Aktionen */}
        <div className="w-full lg:w-72 space-y-4">

          {/* Zusammenfassung */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-ff-dunkel text-sm">Zusammenfassung</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ff-dunkel-mid">Stunden total</span>
                <span className="font-mono font-semibold">{allHours.toFixed(2)} h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ff-dunkel-mid">Verrechenbar</span>
                <span className="font-mono font-semibold">{totalHours.toFixed(2)} h</span>
              </div>
              <div className="border-t border-ff-blau-hell pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ff-dunkel-mid">
                    {project.flat_rate ? 'Stundenbasiert' : 'Betrag'}
                  </span>
                  <span className="font-semibold">
                    CHF {fmtCHF(totalHours * (project.hourly_rate || 125))}
                  </span>
                </div>
                {project.flat_rate && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-ff-dunkel-mid">Pauschal</span>
                    <span className="font-semibold text-ff-blau">
                      CHF {fmtCHF(project.flat_rate)}
                    </span>
                  </div>
                )}
                {project.discount_percent && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-ff-dunkel-mid">Rabatt {project.discount_percent}%</span>
                    <span className="text-red-500">
                      - CHF {fmtCHF((project.flat_rate || totalHours * (project.hourly_rate || 125)) * project.discount_percent / 100)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-ff-blau rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-white text-sm font-medium">Rechnungsbetrag</span>
                <span className="text-white font-bold">CHF {fmtCHF(rechnungsBetrag)}</span>
              </div>
            </div>
          </div>

          {/* Rechnungsstatus */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-ff-dunkel text-sm">Rechnung</h3>

            {project.status === 'offen' && (
              <button onClick={markRechnung} className="w-full btn-primary flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Rechnung stellen
              </button>
            )}

            {project.status === 'rechnung_gestellt' && (
              <>
                <div className="bg-ff-blau-hell rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ff-dunkel-mid">Datum</span>
                    <span className="font-medium">{fmtDate(project.invoice_date)}</span>
                  </div>
                  {project.invoice_note && (
                    <div className="text-ff-dunkel-mid text-xs mt-1 italic">
                      {project.invoice_note}
                    </div>
                  )}
                </div>
                <button onClick={markBezahlt} className="w-full btn-success flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Als bezahlt markieren
                </button>
              </>
            )}

            {project.status === 'bezahlt' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Bezahlt
                </div>
                {project.invoice_date && (
                  <p className="text-green-600 text-xs mt-1">
                    Rechnung vom {fmtDate(project.invoice_date)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Aktionen */}
          <div className="card space-y-2">
            <h3 className="font-semibold text-ff-dunkel text-sm">Aktionen</h3>

            <button
              onClick={() => window.open(`/api/projects/${id}/pdf`, '_blank')}
              className="w-full btn-secondary flex items-center gap-2 justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF Rapport herunterladen
            </button>

            <button
              onClick={copyBexioNote}
              className="w-full btn-secondary flex items-center gap-2 justify-center text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Bexio-Notiz kopieren
            </button>

            <button
              onClick={() => setShowEntryModal(true)}
              className="w-full btn-secondary flex items-center gap-2 justify-center text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4" />
              </svg>
              Eintrag manuell erfassen
            </button>
          </div>

          {/* Projekt-Info */}
          <div className="card text-xs text-ff-dunkel-mid space-y-1">
            <p>Projekt #{project.id} · {project.year}</p>
            <p>Erstellt {fmtDate(project.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEntryModal && (
        <EntryModal
          projectId={id}
          hourlyRate={project.hourly_rate}
          onClose={() => setShowEntryModal(false)}
          onSaved={() => { setShowEntryModal(false); loadProject(); refresh() }}
        />
      )}

      {editEntry && (
        <EntryModal
          projectId={id}
          entry={editEntry}
          hourlyRate={project.hourly_rate}
          onClose={() => setEditEntry(null)}
          onSaved={() => { setEditEntry(null); loadProject(); refresh() }}
        />
      )}

      {showEditProject && (
        <ProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onSaved={() => { setShowEditProject(false); loadProject(); refresh() }}
        />
      )}
    </div>
  )
}
