/**
 * Tools Module
 * Re-exports all tool-related functionality
 */

export { registerTool, executeTool, getRegisteredTools, hasTool } from './registry'
export { registerTabTools } from './tabs'
export { registerPageReadingTools, detachCDP } from './pageReading'
export { registerInteractionTools, getScreenshot } from './interaction'
export { registerDebuggingTools, addConsoleMessage, addNetworkRequest, clearTabData } from './debugging'
export { registerMediaTools, addFrame } from './media'
export { registerUiTools, getCurrentPlan, clearPlan } from './ui'
export { registerShortcutsTools } from './shortcuts'

/**
 * Register all tools
 *
 * Call this function to register all tool handlers.
 * The background script already does this individually.
 */
export function registerAllTools(): void {
  registerTabTools()
  registerPageReadingTools()
  registerInteractionTools()
  registerDebuggingTools()
  registerMediaTools()
  registerUiTools()
  registerShortcutsTools()
}
