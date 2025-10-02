export function formatDuration(start?: string | null, end?: string | null) {
  if (!start) return '—'
  const startDate = new Date(start)
  const startMs = startDate.getTime()
  if (Number.isNaN(startMs)) return '—'

  const endDate = end ? new Date(end) : new Date()
  const endMs = endDate.getTime()
  if (Number.isNaN(endMs)) return '—'

  const diff = Math.max(0, endMs - startMs)
  const totalSeconds = Math.round(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (!hours && !minutes) {
    parts.push(`${seconds}s`)
  } else if (!hours && minutes && seconds >= 30) {
    parts.push(`${seconds}s`)
  }

  return parts.slice(0, 2).join(' ') || '0s'
}
