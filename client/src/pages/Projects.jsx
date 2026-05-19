import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import ProjectModal from '../components/ProjectModal.jsx'

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Inline Status-Schalter – zeigt den aktuellen Status als klickbarer Button
// Klick öffnet ein kleines Dropdown direkt in der Tabellenzeile
function StatusSchalter({ project, onChanged }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // Klick ausserhalb → schliessen
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const STATUS = [
    { value: 'offen',             label: 'Offen',             color: 'bg-ff-orange-hell text-ff-orange border-ff-orange/30' },
    { value: 'rechnung_gestellt', label: 'Rechnung gestellt', color: 'bg-ff-blau-hell text-ff-blau border-ff-blau/30' },
    { value: 'bezahlt',           label: 'Bezahlt',           color: 'bg-green-100 text-green-700 border-green-300' },
  ]
  const current = STATUS.find(s => s.value === project.status) || STATUS[0]

  async function setStatus(newStatus) {
    if (newStatus === project.status) { setOpen(false); return }
    setLoading(true)
    const body = { status: newStatus }
    if (newStatus === 'rechnung_gestellt') {
      body.invoice_date = new Date().toISOString().split('T')[0]
    }
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    setOpen(false)
    onChanged()
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border
          transition-all hover:shadow-sm ${current.color} ${loading ? 'opacity-50' : ''}`}
      >
        {loading ? '...' : current.label}
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[170px]">
          {STATUS.map(s => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors
                ${s.value === project.status ? 'font-bold' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                s.value === 'offen' ? 'bg-ff-orange' :
                s.value === 'rechnung_gestellt' ? 'bg-ff-blau' : 'bg-green-500'
              }`} />
              {s.label}
              {s.value === project.status && (
                <svg className="w-3.5 h-3.5 ml-auto text-ff-blau" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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

  async function deleteProject(p, e) {
    e.stopPropagation()
    if (!window.confirm(`Projekt "${p.client_name}" wirklich löschen?`)) return
    await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
    refresh()
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form })
      if (res.ok) {
        const d = await res.json()
        alert(`Import erfolgreich: ${d.imported} Einträge importiert`)
        refresh()
      }
    } catch { alert('Import fehlgeschlagen') }
    setImporting(false)
    e.target.value = ''
  }

  const filtered = filterStatus === 'alle'
    ? projects
    : projects.filter(p => p.status === filterStatus)

  // Statistiken
  const stats = {
    offen:   projects.filter(p => p.status === 'offen').length,
    rechnung: projects.filter(p => p.status === 'rechnung_gestellt').length,
    bezahlt: projects.filter(p => p.status === 'bezahlt').length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ff-dunkel">Projekte {year}</h1>
          <p className="text-ff-dunkel-mid text-sm">
            {projects.length} Projekte &nbsp;·&nbsp;
            <span className="text-ff-orange">{stats.offen} offen</span> &nbsp;·&nbsp;
            <span className="text-ff-blau">{stats.rechnung} Rechnung gestellt</span> &nbsp;·&nbsp;
            <span className="text-green-600">{stats.bezahlt} bezahlt</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <label htmlFor="excel-import" className={`btn-secondary flex items-center gap-1.5 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Importiert...' : 'Excel Import'}
          </label>
          <input id="excel-import" type="file" accept=".xlsx,.xls" onChange={handleImport} disabled={importing}
            style={{position:'fixed',top:'-200px',left:'-200px',width:'1px',height:'1px',opacity:0}} />
        </div>
      </div>

      {/* Tabelle */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ff-dunkel-mid">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-3">📂</p>
            <p className="text-ff-dunkel font-medium">Keine Projekte gefunden</p>
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
                      {p.flat_rate && (
                        <span className="block text-xs text-ff-dunkel-mid font-normal">
                          Pauschal
                        </span>
                      )}
                    </td>

                    {/* Status – direkt klickbar, kein Seitenaufruf nötig */}
                    <td className="px-4 py-3 text-center">
                      <StatusSchalter project={p} onChanged={refresh} />
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-ff-dunkel-mid hidden md:table-cell">
                      {p.last_activity
                        ? new Date(p.last_activity).toLocaleDateString('de-CH')
                        : '–'}
                    </td>

                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {/* Detail */}
                        <button onClick={() => navigate(`/projekte/${p.id}`)}
                          title="Detail" className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-blau transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {/* PDF */}
                        <button onClick={() => window.open(`/api/projects/${p.id}/pdf`, '_blank')}
                          title="PDF" className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-dunkel-mid transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        {/* Bearbeiten */}
                        <button onClick={() => setEditProject(p)}
                          title="Bearbeiten" className="p-1.5 rounded hover:bg-ff-blau-hell text-ff-dunkel-mid transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* Löschen */}
                        <button onClick={e => deleteProject(p, e)}
                          title="Löschen" className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors">
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
        <ProjectModal project={editProject} onClose={() => setEditProject(null)}
          onSaved={() => { setEditProject(null); refresh() }} />
      )}
    </div>
  )
}
