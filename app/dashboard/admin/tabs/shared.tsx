export function AdminCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {children}
    </div>
  )
}

export function AdminTable({ headers, children }: { headers: string[], children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {headers.map((h) => (
              <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-100 text-gray-500 border-gray-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {active ? 'Active' : 'Archived'}
    </span>
  )
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}