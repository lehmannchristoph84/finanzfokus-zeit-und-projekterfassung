import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const { year, refreshTick } = useApp()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/projects?year=${year}`)
      .then(r => r.json())
      .then(data => { setProjects(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, refreshTick])

  const byStatus = (s) => projects.filter(p => p.status === s)
  const sumAmount = (ps) => ps.reduce((a, p) => a + (p.calculated_amount || 0), 0)

  const stats = [
    {
      label: 'Offene Projekte',
      status: 'offen',
      color: 'border-ff-orange',
      bg: 'bg-ff-orange-hell',
      icon: '🔵',
      iconBg: 'bg-ff-orange/10',
    },
    {
      label: 'Rechnung gestellt',
      status: 'rechnung_gestellt',
      color: 'border-ff-blau',
      bg: 'bg-ff-blau-hell',
      icon: '📄',
      iconBg: 'bg-ff-blau/10',
    },
    {
      label: 'Bezahlt',
      status: 'bezahlt',
      color: 'border-green-500',
      bg: 'bg-green-50',
      icon: '✅',
      iconBg: 'bg-green-100',
    },
  ]

  const openProjects = byStatus('offen')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ff-dunkel">Dashboard</h1>
          <p className="text-ff-dunkel-mid text-sm mt-0.5">Übersicht {year}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, status, color, bg, iconBg }) => {
          const ps = byStatus(status)
          const total = sumAmount(ps)
          return (
            <div key={status} className={`card border-l-4 ${color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-ff-dunkel-mid uppercase tracking-wide">{label}</p>
                  <p className="text-3xl font-bold text-ff-dunkel mt-1">{ps.length}</p>
                  <p className="text-sm font-medium text-ff-dunkel-mid mt-0.5">CHF {fmtCHF(total)}</p>
                </div>
                <div className={`${iconBg} p-2 rounded-lg`}>
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Offene Projekte Tabelle */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-ff-blau-hell flex items-center justify-between">
          <h2 className="font-semibold text-ff-dunkel">Offene Projekte</h2>
          <span className="text-xs text-ff-dunkel-mid">{openProjects.length} Projekte</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ff-dunkel-mid">Laden...</div>
        ) : openProjects.length === 0 ? (
          <div className="p-8 text-center text-ff-dunkel-mid">
            <p className="text-2xl mb-2">📭</p>
            <p>Keine offenen Projekte in {year}</p>
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
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {openProjects.map(p => (
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

      {/* Weitere Projekte nach Status */}
      {['rechnung_gestellt', 'bezahlt'].map(status => {
        const ps = byStatus(status)
        if (ps.length === 0) return null
        return (
          <div key={status} className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-ff-blau-hell flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="font-semibold text-ff-dunkel">
                  {status === 'rechnung_gestellt' ? 'Rechnung gestellt' : 'Bezahlt'}
                </span>
              </div>
              <span className="text-xs text-ff-dunkel-mid">
                {ps.length} Projekte · CHF {fmtCHF(sumAmount(ps))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-5 py-3 text-left">Kunde</th>
                    <th className="px-4 py-3 text-left">Thema</th>
                    <th className="px-4 py-3 text-right">Stunden</th>
                    <th className="px-4 py-3 text-right">Betrag CHF</th>
                    <th className="px-4 py-3 text-right">Rechnungsdatum</th>
                  </tr>
                </thead>
                <tbody>
                  {ps.map(p => (
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
                        {p.invoice_date
                          ? new Date(p.invoice_date).toLocaleDateString('de-CH')
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
