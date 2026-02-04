// Generate random hex string of specified length
function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Generate W3C trace ID (32 hex chars = 16 bytes)
export function generateTraceId(): string {
  return randomHex(32)
}

// Generate span ID (16 hex chars = 8 bytes)
export function generateSpanId(): string {
  return randomHex(16)
}

// Convert milliseconds timestamp to nanoseconds string (OTLP format)
export function msToNano(ms: number): string {
  return (BigInt(ms) * BigInt(1_000_000)).toString()
}

// Get current time in nanoseconds
export function nowNano(): string {
  return msToNano(Date.now())
}
