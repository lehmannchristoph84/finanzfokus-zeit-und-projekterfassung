import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function fmtCHF(n) {
  return Number(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function JahresVergleich({ clients }) {
  const [jahresDaten, setJahresDaten] = useState([])
  useEffect(() => {
    fetch('/api/analytics/yearly')
      .then(r => r.json())
      .then(setJahresDaten)
      .catch(() => {})
  }, [clients])

  if (!jahresDaten.length) return null

  const maxUmsatz = Math.max(...jahresDaten.map(j => j.umsatz), 1)

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-ff-blau-hell">
        <h2 className="font-semibold text-ff-dunkel">Jahresvergleich</h2>
        <p className="text-xs text-ff-dunkel-mid mt-0.5">Stunden & Umsatz pro Jahr</p>
      </div>
      <div className="p-5">
        {/* Balken */}
        <div className="flex items-end gap-4 h-24 mb-3">
          {jahresDaten.map(j => (
            <div key={j.year} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-ff-dunkel text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {j.stunden.toFixed(2)} h · CHF {Number(j.umsatz).toLocaleString('de-CH', {minimumFractionDigits:2})}
              </div>
              <div
                className="w-full rounded-t bg-ff-blau hover:bg-ff-blau/80 transition-all"
                style={{ height: `${Math.max((j.umsatz / maxUmsatz) * 100, 4)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-4 mb-4">
          {jahresDaten.map(j => (
            <div key={j.year} className="flex-1 text-center text-xs font-semibold text-ff-dunkel-mid">{j.year}</div>
          ))}
        </div>
        {/* Tabelle */}
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-2 text-left">Jahr</th>
              <th className="px-4 py-2 text-right">Stunden</th>
              <th className="px-4 py-2 text-right">Umsatz CHF</th>
              <th className="px-4 py-2 text-right">Projekte</th>
              <th className="px-4 py-2 text-right">Kunden</th>
            </tr>
          </thead>
          <tbody>
            {jahresDaten.map((j, i) => (
              <tr key={j.year} className="table-row">
                <td className="px-4 py-2 font-bold text-ff-blau">{j.year}</td>
                <td className="px-4 py-2 text-right font-mono">{parseFloat(j.stunden).toFixed(2)} h</td>
                <td className="px-4 py-2 text-right font-semibold">CHF {Number(j.umsatz).toLocaleString('de-CH', {minimumFractionDigits:2})}</td>
                <td className="px-4 py-2 text-right text-ff-dunkel-mid">{j.projekte}</td>
                <td className="px-4 py-2 text-right text-ff-dunkel-mid">{j.kunden}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Kunden() {
  const { year } = useApp()
  const navigate = useNavigate()

  const [clients, setClients] = useState([])
  const [monthly, setMonthly] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientDetail, setClientDetail] = useState(null)
  const [viewYear, setViewYear] = useState(year)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/clients')
      .then(r => r.json())
      .then(data => { setClients(data); setLoading(false) })
  }, [])

  useEffect(() => {
    fetch(`/api/analytics/monthly/${viewYear}`)
      .then(r => r.json())
      .then(setMonthly)
  }, [viewYear])

  useEffect(() => {
    if (!selectedClient) { setClientDetail(null); return }
    fetch(`/api/analytics/client/${encodeURIComponent(selectedClient)}`)
      .then(r => r.json())
      .then(setClientDetail)
  }, [selectedClient])

  const maxStunden = Math.max(...monthly.map(m => m.stunden), 1)
  const maxUmsatz  = Math.max(...monthly.map(m => m.umsatz), 1)

  const totalUmsatz  = clients.reduce((s, c) => s + (c.total_umsatz || 0), 0)
  const totalStunden = clients.reduce((s, c) => s + (c.total_hours || 0), 0)
  const totalMonthlyUmsatz  = monthly.reduce((s, m) => s + m.umsatz, 0)
  const totalMonthlyStunden = monthly.reduce((s, m) => s + m.stunden, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ff-dunkel">Kunden & Analyse</h1>
          <p className="text-ff-dunkel-mid text-sm mt-0.5">Gesamtübersicht aller Jahre</p>
        </div>
        {/* PDF Kundenübersicht */}
        <button
          onClick={() => window.open('/api/analytics/clients/pdf', '_blank')}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Kundenübersicht PDF
        </button>
      </div>

      {/* Summary-Karten */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card border-l-4 border-ff-blau">
          <p className="text-xs font-semibold text-ff-dunkel-mid uppercase tracking-wide">Kunden total</p>
          <p className="text-3xl font-bold text-ff-dunkel mt-1">{clients.length}</p>
        </div>
        <div className="card border-l-4 border-ff-orange">
          <p className="text-xs font-semibold text-ff-dunkel-mid uppercase tracking-wide">Stunden total</p>
          <p className="text-3xl font-bold text-ff-dunkel mt-1">{totalStunden.toFixed(1)} h</p>
        </div>
        <div className="card border-l-4 border-green-500">
          <p className="text-xs font-semibold text-ff-dunkel-mid uppercase tracking-wide">Umsatz total</p>
          <p className="text-3xl font-bold text-ff-dunkel mt-1">CHF {fmtCHF(totalUmsatz)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* KUNDENLISTE */}
        <div className="flex-1 card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-ff-blau-hell">
            <h2 className="font-semibold text-ff-dunkel">Alle Kunden</h2>
            <p className="text-xs text-ff-dunkel-mid mt-0.5">Klick auf Kunde → Jahresdetail + PDF</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-ff-dunkel-mid">Laden...</div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-ff-dunkel-mid">Noch keine Kunden erfasst.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-5 py-3 text-left">Kunde</th>
                    <th className="px-4 py-3 text-left">Themen</th>
                    <th className="px-4 py-3 text-center">Proj.</th>
                    <th className="px-4 py-3 text-right">Stunden</th>
                    <th className="px-4 py-3 text-right">Umsatz CHF</th>
                    <th className="px-4 py-3 text-center">Jahre</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr
                      key={c.client_name}
                      className={`table-row cursor-pointer ${selectedClient === c.client_name ? 'bg-ff-blau-hell' : ''}`}
                      onClick={() => setSelectedClient(
                        selectedClient === c.client_name ? null : c.client_name
                      )}
                    >
                      <td className="px-5 py-3 font-semibold text-ff-dunkel">
                        <div className="flex items-center gap-2">
                          {selectedClient === c.client_name && (
                            <span className="w-2 h-2 rounded-full bg-ff-blau flex-shrink-0" />
                          )}
                          {c.client_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ff-dunkel-mid max-w-[150px] truncate">
                        {c.themen || '–'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{c.project_count}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono">
                        {parseFloat(c.total_hours).toFixed(2)} h
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {fmtCHF(c.total_umsatz)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-ff-dunkel-mid">
                        {c.jahre || c.first_year}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-ff-dunkel text-white">
                    <td className="px-5 py-3 font-bold text-sm">Total</td>
                    <td />
                    <td className="px-4 py-3 text-center text-sm font-bold">
                      {clients.reduce((s, c) => s + c.project_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold font-mono">
                      {totalStunden.toFixed(2)} h
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold">
                      {fmtCHF(totalUmsatz)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* KUNDEN-DETAIL (rechts, erscheint bei Klick) */}
        {selectedClient && clientDetail && (
          <div className="w-full lg:w-80 space-y-4">
            <div className="card p-0 overflow-hidden">
              <div className="bg-ff-dunkel px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{selectedClient}</h3>
                  <p className="text-ff-dunkel-mid text-xs mt-0.5">Jahresübersicht</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* PDF pro Kunde */}
                  <button
                    onClick={() => window.open(`/api/analytics/client/${encodeURIComponent(selectedClient)}/pdf`, '_blank')}
                    title="Kundenprojekte PDF"
                    className="text-ff-blau-mid hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button onClick={() => setSelectedClient(null)}
                    className="text-ff-dunkel-mid hover:text-white transition-colors text-lg leading-none">✕</button>
                </div>
              </div>

              {/* Jahres-Kacheln */}
              <div className="divide-y divide-ff-blau-hell">
                {clientDetail.jahresDaten.map(j => (
                  <div key={j.year} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ff-blau text-lg">{j.year}</span>
                      <span className="text-sm font-bold text-ff-dunkel">
                        CHF {fmtCHF(j.umsatz)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-ff-dunkel-mid">
                      <span>{j.stunden.toFixed(2)} h · {j.projekte} Projekt{j.projekte !== 1 ? 'e' : ''}</span>
                    </div>
                    {j.themen && (
                      <p className="text-xs text-ff-dunkel-mid mt-0.5 italic truncate">{j.themen}</p>
                    )}
                  </div>
                ))}
                {/* Total */}
                <div className="px-5 py-3 bg-ff-blau-hell">
                  <div className="flex justify-between">
                    <span className="font-bold text-ff-dunkel text-sm">Total alle Jahre</span>
                    <span className="font-bold text-ff-blau">
                      CHF {fmtCHF(clientDetail.jahresDaten.reduce((s, j) => s + j.umsatz, 0))}
                    </span>
                  </div>
                  <p className="text-xs text-ff-dunkel-mid mt-0.5">
                    {clientDetail.jahresDaten.reduce((s, j) => s + j.stunden, 0).toFixed(2)} h total
                  </p>
                </div>
              </div>
            </div>

            {/* Projekte des Kunden */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-ff-blau-hell">
                <h4 className="font-semibold text-ff-dunkel text-sm">Alle Projekte</h4>
              </div>
              <div className="divide-y divide-ff-blau-hell">
                {clientDetail.projekte.map(p => (
                  <div
                    key={p.id}
                    className="px-5 py-3 hover:bg-ff-blau-hell/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projekte/${p.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ff-dunkel">{p.topic || '–'}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-ff-dunkel-mid">
                      <span>{p.year} · {parseFloat(p.all_hours).toFixed(2)} h</span>
                      <span className="font-semibold text-ff-dunkel">CHF {fmtCHF(p.umsatz)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JAHRESVERGLEICH */}
      <JahresVergleich clients={clients} />

      {/* MONATLICHE ANALYSE */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-ff-blau-hell flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ff-dunkel">Monat für Monat</h2>
            <p className="text-xs text-ff-dunkel-mid mt-0.5">Stunden & Umsatz pro Monat</p>
          </div>
          <select
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="input w-auto text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="p-5">
          {/* Doppeltes Balkendiagramm: Stunden (blau) + Umsatz (orange, sekundär) */}
          <div className="flex items-end gap-1.5 h-32 mb-2">
            {monthly.map((m, i) => {
              const pctH = maxStunden > 0 ? (m.stunden / maxStunden) * 100 : 0
              const pctU = maxUmsatz  > 0 ? (m.umsatz  / maxUmsatz)  * 100 : 0
              return (
                <div key={m.monat} className="flex-1 flex items-end justify-center gap-px group relative">
                  {/* Tooltip */}
                  {(m.stunden > 0 || m.umsatz > 0) && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-ff-dunkel text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {m.stunden.toFixed(2)} h · CHF {fmtCHF(m.umsatz)}
                    </div>
                  )}
                  {/* Stunden-Balken */}
                  <div
                    className={`w-5/12 rounded-t transition-all ${m.stunden > 0 ? 'bg-ff-blau hover:bg-ff-blau/80' : 'bg-ff-blau-hell'}`}
                    style={{ height: `${Math.max(pctH, m.stunden > 0 ? 4 : 1)}%` }}
                  />
                  {/* Umsatz-Balken */}
                  <div
                    className={`w-5/12 rounded-t transition-all ${m.umsatz > 0 ? 'bg-ff-orange hover:bg-ff-orange/80' : 'bg-ff-orange-hell'}`}
                    style={{ height: `${Math.max(pctU, m.umsatz > 0 ? 4 : 1)}%` }}
                  />
                </div>
              )
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-4 mb-3 text-xs text-ff-dunkel-mid">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-ff-blau inline-block" /> Stunden
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-ff-orange inline-block" /> Umsatz (stundenbasiert)
            </span>
          </div>

          {/* Monatsbezeichnungen */}
          <div className="flex gap-1.5 mb-4">
            {MONATE.map((name, i) => (
              <div key={i} className="flex-1 text-center text-xs text-ff-dunkel-mid">{name}</div>
            ))}
          </div>

          {/* Monatstabelle */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Monat</th>
                  <th className="px-4 py-2 text-right">Stunden</th>
                  <th className="px-4 py-2 text-right">Umsatz CHF</th>
                  <th className="px-4 py-2 text-right">Projekte</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr key={m.monat} className={`table-row ${m.stunden === 0 ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2 font-medium">{MONATE[i]} {viewYear}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {m.stunden > 0 ? `${parseFloat(m.stunden).toFixed(2)} h` : '–'}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {m.umsatz > 0 ? `CHF ${fmtCHF(m.umsatz)}` : '–'}
                    </td>
                    <td className="px-4 py-2 text-right text-ff-dunkel-mid">
                      {m.projekte > 0 ? m.projekte : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ff-dunkel text-white">
                  <td className="px-4 py-2 font-bold">Total {viewYear}</td>
                  <td className="px-4 py-2 text-right font-bold font-mono">
                    {totalMonthlyStunden.toFixed(2)} h
                  </td>
                  <td className="px-4 py-2 text-right font-bold">
                    CHF {fmtCHF(totalMonthlyUmsatz)}
                  </td>
                  <td className="px-4 py-2 text-right font-bold">
                    {monthly.reduce((s, m) => s + m.projekte, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
