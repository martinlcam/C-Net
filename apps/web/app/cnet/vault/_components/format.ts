export function formatBytes(n: number | null): string {
  if (n === null) return "∞"
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

export const VAULT_COLORS: { key: string; hex: string; label: string }[] = [
  { key: "red", hex: "#ef4444", label: "Red" },
  { key: "orange", hex: "#f97316", label: "Orange" },
  { key: "yellow", hex: "#eab308", label: "Yellow" },
  { key: "green", hex: "#22c55e", label: "Green" },
  { key: "blue", hex: "#3b82f6", label: "Blue" },
  { key: "purple", hex: "#a855f7", label: "Purple" },
]

export function colorHex(key: string | null): string | undefined {
  return VAULT_COLORS.find((c) => c.key === key)?.hex
}
