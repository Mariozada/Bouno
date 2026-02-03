/**
 * UI Signaling Tools
 * Handles: update_plan
 */

import { registerTool } from './registry'

// Current plan storage
let currentPlan: {
  approach: string
  domains: string[]
  createdAt: number
} | null = null

/**
 * update_plan - Present plan to user for approval
 */
async function updatePlan(params: {
  approach: string
  domains: string[]
}): Promise<unknown> {
  const { approach, domains } = params

  if (!approach || typeof approach !== 'string') {
    throw new Error('approach (string description) is required')
  }

  if (!domains || !Array.isArray(domains)) {
    throw new Error('domains (array of domains) is required')
  }

  currentPlan = {
    approach,
    domains,
    createdAt: Date.now()
  }

  return {
    status: 'plan_created',
    plan: currentPlan,
    message: 'Plan created and ready for user approval.'
  }
}

/**
 * Get current plan
 */
export function getCurrentPlan() {
  return currentPlan
}

/**
 * Clear current plan
 */
export function clearPlan(): void {
  currentPlan = null
}

/**
 * Register UI signaling tools
 */
export function registerUiTools(): void {
  registerTool('update_plan', updatePlan as (params: Record<string, unknown>) => Promise<unknown>)
}
