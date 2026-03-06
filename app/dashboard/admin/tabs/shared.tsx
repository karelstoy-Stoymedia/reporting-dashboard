export function AdminCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      {children}
    </div>
  )
}

export function AdminTable({ headers, children }: { headers: string[], children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {headers.map((h) => (
              <th key={h} className="text-left text-slate-400 font-medium pb-3 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      active ? 'bg-green-900/50 text-green-400' : 'bg-slate-800 text-slate-400'
    }`}>
      {active ? 'Active' : 'Archived'}
    </span>
  )
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}


