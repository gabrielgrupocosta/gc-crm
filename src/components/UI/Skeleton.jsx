function Skeleton({ className = '' }) {
  return (
    <div className={`bg-[#EDEDED] animate-skeleton rounded ${className}`} />
  )
}

// Linha de texto genérica
Skeleton.Line = function SkeletonLine({ width = 'w-full', height = 'h-3.5' }) {
  return <Skeleton className={`${width} ${height}`} />
}

// Bloco (card, área grande)
Skeleton.Block = function SkeletonBlock({ className = '' }) {
  return <Skeleton className={`w-full h-20 ${className}`} />
}

// Card KPI
Skeleton.KPI = function SkeletonKPI() {
  return (
    <div className="card-kpi flex flex-col gap-3">
      <Skeleton.Line width="w-24" height="h-2.5" />
      <Skeleton.Line width="w-16" height="h-7" />
    </div>
  )
}

// Linha de tabela
Skeleton.TableRow = function SkeletonTableRow({ cols = 4 }) {
  return (
    <div className="flex items-center gap-4 h-12 border-b border-border px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton.Line
          key={i}
          width={i === 0 ? 'w-40' : 'w-24'}
          height="h-3"
        />
      ))}
    </div>
  )
}

// Tabela completa
Skeleton.Table = function SkeletonTable({ rows = 6, cols = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton.TableRow key={i} cols={cols} />
      ))}
    </div>
  )
}

export default Skeleton
