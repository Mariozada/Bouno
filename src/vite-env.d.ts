/// <reference types="vite/client" />

declare module '*.jinja' {
  export function render(context: Record<string, unknown>): string
  export default render
}
