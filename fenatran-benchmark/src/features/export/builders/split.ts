// Greedy first-fit decreasing: biggest items first, each into the first part with room.
// An item bigger than the capacity gets a part of its own. Always returns at least one part;
// items keep their original order inside each part.
export function splitBySize<T>(items: T[], size: (item: T) => number, capacity: number): T[][] {
  const order = items.map((item, index) => ({ item, index, size: size(item) }))
  order.sort((a, b) => b.size - a.size || a.index - b.index)
  const parts: { used: number; members: typeof order }[] = []
  for (const entry of order) {
    const part = parts.find((p) => p.used + entry.size <= capacity)
    if (part) {
      part.used += entry.size
      part.members.push(entry)
    } else {
      parts.push({ used: entry.size, members: [entry] })
    }
  }
  if (parts.length === 0) return [[]]
  return parts.map((p) => p.members.sort((a, b) => a.index - b.index).map((m) => m.item))
}
