export { registerTool, executeTool, getRegisteredTools, hasTool } from './registry'
export { registerTabTools } from './tabs'
export { registerPageReadingTools } from './pageReading'
export { registerInteractionTools, getScreenshot } from './interaction'
export { registerDebuggingTools, addConsoleMessage, addNetworkRequest, clearTabData } from './debugging'
export { registerMediaTools, addFrame } from './media'
export { registerUiTools, getCurrentPlan, clearPlan } from './ui'

// Import for use within this module
import { registerTabTools } from './tabs'
import { registerPageReadingTools } from './pageReading'
import { registerInteractionTools } from './interaction'
import { registerDebuggingTools } from './debugging'
import { registerMediaTools } from './media'
import { registerUiTools } from './ui'

export function registerAllTools(): void {
  registerTabTools()
  registerPageReadingTools()
  registerInteractionTools()
  registerDebuggingTools()
  registerMediaTools()
  registerUiTools()
}
