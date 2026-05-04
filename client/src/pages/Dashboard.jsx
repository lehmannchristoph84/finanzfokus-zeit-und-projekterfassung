import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_CONFIG = [
  {
    status: 'offen',
    label: 'Offene Projekte',
    border: 'border-ff-orange',
    activeBg: 'bg-ff-orange-hell',
  },
  {
    status: 'rechnung_gestellt',
    label: 'Rechnung gestellt',
    border: 'border-ff-blau',
    activeBg: 'bg-ff-blau-hell',
  },
  {
    status: 'bezahlt',
    label: 'Bezahlt',
    border: 'border-green-500',
    activeBg: 'bg-green-50',
  },
]

export default function Dashboard() {
  const { year, refreshTick } = useApp()
  const [allProjects, setAllProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    // Alle Projekte laden (ohne Jahresfilter) – Filterlogik im Frontend
    fetch('/api/projects/all')
      .then(r => r.json())
      .then(data => { setAllProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refreshTick])

  // Offene / Rechnung gestellt: alle Jahre bis und mit dem gewählten Jahr (Übertrag)
  // Bezahlt: nur das gewählte Jahr
  const byStatus = (s) => {
    if (s === 'bezahlt') {
      return allProjects.filter(p => p.status === s && p.year === year)
    }
    return allProjects.filter(p => p.status === s && p.year <= year)
  }
  const sumAmount = (ps) => ps.reduce((a, p) => a + (p.calculated_amount || 0), 0)

  function toggleStatus(status) {
    setActiveStatus(prev => prev === status ? null : status)
  }

  const activeProjects = activeStatus ? byStatus(activeStatus) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ff-dunkel">Dashboard</h1>
        <p className="text-ff-dunkel-mid text-sm mt-0.5">Übersicht {year} · Karte anklicken für Details</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATUS_CONFIG.map(({ status, label, border, activeBg }) => {
          const ps = byStatus(status)
          const total = sumAmount(ps)
          const isActive = activeStatus === status

          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`card border-l-4 ${border} text-left transition-all duration-150 hover:shadow-md
                ${isActive ? activeBg + ' ring-2 ring-offset-1 ' + border.replace('border-', 'ring-') : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-ff-dunkel-mid uppercase tracking-wide">{label}</p>
                  <p className="text-3xl font-bold text-ff-dunkel mt-1">{loading ? '–' : ps.length}</p>
                  <p className="text-sm font-medium text-ff-dunkel-mid mt-0.5">
                    {loading ? '...' : `CHF ${fmtCHF(total)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={status} />
                  <span className="text-ff-dunkel-mid text-lg">{isActive ? '▲' : '▼'}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Detail-Tabelle – erscheint nur bei aktivem Status */}
      {activeStatus && (
        <div className="card p-0 overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-ff-blau-hell flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge status={activeStatus} />
              <span className="font-semibold text-ff-dunkel">
                {STATUS_CONFIG.find(s => s.status === activeStatus)?.label}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-ff-dunkel-mid">
                {activeProjects.length} Projekte · CHF {fmtCHF(sumAmount(activeProjects))}
              </span>
              <button
                onClick={() => setActiveStatus(null)}
                className="text-ff-dunkel-mid hover:text-ff-dunkel transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {activeProjects.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-ff-dunkel font-medium">Keine Projekte</p>
              <p className="text-ff-dunkel-mid text-sm mt-1">
                Noch keine Projekte mit diesem Status in {year}
              </p>
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
                    {activeStatus !== 'offen' && (
                      <th className="px-4 py-3 text-right">Rechnungsdatum</th>
                    )}
                    <th className="px-4 py-3 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map(p => (
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
                      {activeStatus !== 'offen' && (
                        <td className="px-4 py-3 text-right text-sm text-ff-dunkel-mid">
                          {p.invoice_date
                            ? new Date(p.invoice_date).toLocaleDateString('de-CH')
                            : '–'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/projekte/${p.id}`)}
                          className="text-ff-blau hover:text-ff-dunkel text-sm font-medium transition-colors"
                        >
                          Detail →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
