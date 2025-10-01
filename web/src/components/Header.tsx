import { Link } from 'react-router-dom'

export default function Header({ onRescan, lastRun }: { onRescan: () => void, lastRun?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight">China Compass</h1>
          <p className="text-xs text-gray-500">Daily Chinese headlines at a glance</p>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/" className="underline">Today</Link>
          <Link to="/log" className="underline">Log</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            className="px-3 py-1 border rounded hover:bg-gray-50"
            onClick={onRescan}
            title="Trigger a manual rescan"
          >
            Rescan
          </button>
          {lastRun && <span className="text-xs text-gray-500">Last run: {new Date(lastRun).toLocaleString()}</span>}
        </div>
      </div>
    </header>
  )
}
