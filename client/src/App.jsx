import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import Kunden from './pages/Kunden.jsx'
import ProjectModal from './components/ProjectModal.jsx'

// Globaler Context für Jahr-Filter und Stopwatch-State
export const AppContext = createContext(null)

export function useApp() {
  return useContext(AppContext)
}

export default function App() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [showNewProject, setShowNewProject] = useState(false)
  const [activeTimer, setActiveTimer] = useState(null) // { projectId, startTime }
  const [refreshTick, setRefreshTick] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  const refresh = () => setRefreshTick(t => t + 1)

  // Warnung wenn mit laufendem Timer navigiert wird
  useEffect(() => {
    const handler = (e) => {
      if (activeTimer) {
        e.preventDefault()
        e.returnValue = 'Stoppuhr läuft noch – wirklich verlassen?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [activeTimer])

  const years = Array.from({ length: 26 }, (_, i) => 2025 + i) // 2025–2050
  const isDetail = location.pathname.startsWith('/projekte/')

  return (
    <AppContext.Provider value={{ year, setYear, activeTimer, setActiveTimer, refresh, refreshTick }}>
      <div className="min-h-screen flex flex-col">
        {/* NAVBAR */}
        <nav className="bg-ff-dunkel shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* Logo / Titel */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-ff-blau flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-white font-semibold text-sm">Finanzfokus</span>
                <span className="text-ff-blau-mid font-light text-sm"> Zeiterfassung</span>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <NavLink to="/" end className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-ff-blau text-white'
                  : 'text-ff-dunkel-mid hover:text-white hover:bg-white/10'}`}>
                Dashboard
              </NavLink>
              <NavLink to="/projekte" className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive || isDetail
                  ? 'bg-ff-blau text-white'
                  : 'text-ff-dunkel-mid hover:text-white hover:bg-white/10'}`}>
                Projekte
              </NavLink>
              <NavLink to="/kunden" className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-ff-blau text-white'
                  : 'text-ff-dunkel-mid hover:text-white hover:bg-white/10'}`}>
                Kunden & Analyse
              </NavLink>
            </div>

            {/* Rechts: Jahr + Neues Projekt */}
            <div className="flex items-center gap-3">
              {activeTimer && (
                <div className="flex items-center gap-1.5 text-ff-orange text-xs font-medium animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-ff-orange"></div>
                  Stoppuhr läuft
                </div>
              )}
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ff-blau/50"
              >
                {years.map(y => <option key={y} value={y} className="text-ff-dunkel">{y}</option>)}
              </select>
              <button
                onClick={() => setShowNewProject(true)}
                className="bg-ff-blau hover:bg-ff-blau/80 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Neues Projekt
              </button>
            </div>
          </div>
        </nav>

        {/* CONTENT */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projekte" element={<Projects />} />
            <Route path="/projekte/:id" element={<ProjectDetail />} />
            <Route path="/kunden" element={<Kunden />} />
          </Routes>
        </main>
      </div>

      {showNewProject && (
        <ProjectModal
          onClose={() => setShowNewProject(false)}
          onSaved={(p) => {
            setShowNewProject(false)
            refresh()
            navigate(`/projekte/${p.id}`)
          }}
        />
      )}
    </AppContext.Provider>
  )
}
