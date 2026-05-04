import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ProjectModal from '../components/ProjectModal.jsx'

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Projects() {
  const { year, refresh, refreshTick } = useApp()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [editProject, setEditProject] = useState(null)
  const [filterStatus, setFilterStatus] = useState('alle')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects?year=${year}`)
      .then(r => r.json())
      .then(data => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, refreshTick])

  async function markRechnung(p, e) {
    e.stopPropagation()
    const note = window.prompt('Rechnungsnotiz (optional):', '')
    if (note === null) return // Abgebrochen
    await fetch(`/api/projects/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'rechnung_gestellt',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_note: note,
      }),
    })
    refresh()
  }

  async function markBezahlt(p, e) {
    e.stopPropagation()
    if (!window.confirm(`"${p.client_name}" als bezahlt markieren?`)) return
    await fetch(`/api/projects/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bezahlt' }),
    })
    refresh()
  }

  async function deleteProject(p, e) {
    e.stopPropagation()
    if (!window.confirm(`Projekt "${p.client_name}" wirklich löschen? Alle Einträge werden gelöscht.`)) return
    await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
    refresh()
  }

  function downloadPDF(p, e) {
    e.stopPropagation()
    window.open(`/api/projects/${p.id}/pdf`, '_blank')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/projects/1/entries/import`, {
        method: 'POST',
        body: form,
      })
      // Route gibt Fehler wenn Projekt 1 nicht existiert – eigene Import-Route
      const res2 = await fetch('/api/import', { method: 'POST', body: form })
      if (res2.ok) {
        const d = await res2.json()
        alert(`Import erfolgreich: ${d.imported} Einträge importiert`)
        refresh()
      }
    } catch (err) {
      alert('Import fehlgeschlagen')
    }
    setImporting(false)
    e.target.value = ''
  }

  const filtered = filterStatus === 'alle'
    ? projects
    : projects.filter(p => p.status === filterStatus)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ff-dunkel">Projekte {year}</h1>
          <p className="text-ff-dunkel-mid text-sm">{projects.length} Projekte total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="alle">Alle Status</option>
            <option value="offen">Offen</option>
            <option value="rechnung_gestellt">Rechnung gestellt</option>
            <option value="bezahlt">Bezahlt</option>
          </select>

          {/* Excel Import */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Importiert...' : 'Excel Import'}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ff-dunkel-mid">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-3">📂</p>
            <p className="text-ff-dunkel font-medium">Keine Projekte gefunden</p>
            <p className="text-ff-dunkel-mid text-sm mt-1">Erstelle ein neues Projekt mit dem Button oben rechts</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-5 py-3 text-left">Kunde</th>
                  <th className="px-4 py-3 text-left">Thema</th>
                  <th className="px-4 py-3 text-right">Stunden</th>
                  <th className="px-4 py-3 text-right">Betrag</th>
                  <th className="px-4 py-3 text-right">Pauschal</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Letzte Aktivität</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="table-row cursor-pointer"
                    onClick={() => navigate(`/projekte/${p.id}`)}>
                    <td className="px-5 py-3 font-semibold text-ff-dunkel">{p.client_name}</td>
                    <td className="px-4 py-3 text-ff-dunkel-mid text-sm">{p.topic || '–'}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono">
                      {parseFloat(p.all_hours || 0).toFixed(2)} h
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      CHF {fmtCHF(p.calculated_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-ff-dunkel-mid">
                      {p.flat_rate ? `CHF ${fmtCHF(p.flat_rate)}` : '–'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-ff-dunkel-mid hidden md:table-cell">
                      {p.last_activity
                        ? new Date(p.last_activity).toLocaleDateString('de-CH')
                        : '–'}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/projekte/${p.id}`)}
                          title="Detail"
                          className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-blau transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {p.status === 'offen' && (
                          <button
                            onClick={e => markRechnung(p, e)}
                            title="Rechnung stellen"
                            className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-blau transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        )}
                        {p.status === 'rechnung_gestellt' && (
                          <button
                            onClick={e => markBezahlt(p, e)}
                            title="Als bezahlt markieren"
                            className="p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={e => downloadPDF(p, e)}
                          title="PDF Rapport"
                          className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-blau-mid transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setEditProject(p) }}
                          title="Bearbeiten"
                          className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-dunkel-mid transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={e => deleteProject(p, e)}
                          title="Löschen"
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editProject && (
        <ProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={() => { setEditProject(null); refresh() }}
        />
      )}
    </div>
  )
}
