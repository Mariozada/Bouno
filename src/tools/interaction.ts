/**
 * Element Interaction Tools
 * Handles: form_input, computer, upload_image
 */

import { registerTool } from './registry'
import { MessageTypes } from '@shared/messages'
import type { Screenshot } from '@shared/types'
import { MAX_SCREENSHOTS } from '@shared/constants'

// In-memory storage for screenshots
const screenshotStore = new Map<string, Screenshot>()
let screenshotCounter = 0

/**
 * Send message to content script
 */
async function sendToContentScript<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T & { error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (response && response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * form_input - Set values in form elements
 */
async function formInput(params: {
  ref: string
  value: string | boolean | number
  tabId: number
}): Promise<unknown> {
  const { ref, value, tabId } = params

  if (!tabId) throw new Error('tabId is required')
  if (!ref) throw new Error('ref is required')
  if (value === undefined) throw new Error('value is required')

  return sendToContentScript(tabId, {
    type: MessageTypes.FORM_INPUT,
    ref,
    value
  })
}

/**
 * Take a screenshot of the visible tab
 */
async function takeScreenshot(tabId: number): Promise<{
  imageId: string
  dataUrl: string
  width: number
  height: number
}> {
  const tab = await chrome.tabs.get(tabId)
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })

  // Generate unique ID
  const imageId = `screenshot_${++screenshotCounter}_${Date.now()}`

  // Store the screenshot
  screenshotStore.set(imageId, {
    imageId,
    dataUrl,
    timestamp: Date.now(),
    tabId,
    width: tab.width,
    height: tab.height
  })

  // Clean up old screenshots
  if (screenshotStore.size > MAX_SCREENSHOTS) {
    const oldestKey = screenshotStore.keys().next().value
    if (oldestKey) screenshotStore.delete(oldestKey)
  }

  return {
    imageId,
    dataUrl,
    width: tab.width || 0,
    height: tab.height || 0
  }
}

/**
 * Get stored screenshot by ID
 */
export function getScreenshot(imageId: string): Screenshot | undefined {
  return screenshotStore.get(imageId)
}

/**
 * computer - Mouse, keyboard, and screenshot actions
 */
async function computer(params: {
  action: string
  tabId: number
  coordinate?: [number, number]
  ref?: string
  text?: string
  modifiers?: string
  scroll_direction?: string
  scroll_amount?: number
  start_coordinate?: [number, number]
  repeat?: number
  duration?: number
  region?: [number, number, number, number]
}): Promise<unknown> {
  const { action, tabId } = params

  if (!tabId) throw new Error('tabId is required')
  if (!action) throw new Error('action is required')

  // Actions handled by background script
  switch (action) {
    case 'screenshot': {
      return takeScreenshot(tabId)
    }

    case 'zoom': {
      const { region } = params
      if (!region || region.length !== 4) {
        throw new Error('region [x0, y0, x1, y1] is required for zoom action')
      }

      const screenshot = await takeScreenshot(tabId)
      return {
        imageId: screenshot.imageId,
        dataUrl: screenshot.dataUrl,
        region: {
          x: region[0],
          y: region[1],
          width: region[2] - region[0],
          height: region[3] - region[1]
        }
      }
    }

    case 'wait': {
      const { duration = 1 } = params
      const waitTime = Math.min(Math.max(duration, 0), 30) * 1000
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return { waited: waitTime / 1000 }
    }

    // Actions delegated to content script
    default: {
      return sendToContentScript(tabId, {
        type: MessageTypes.COMPUTER_ACTION,
        action,
        coordinate: params.coordinate,
        ref: params.ref,
        text: params.text,
        modifiers: params.modifiers,
        scroll_direction: params.scroll_direction,
        scroll_amount: params.scroll_amount,
        start_coordinate: params.start_coordinate,
        repeat: params.repeat
      })
    }
  }
}

/**
 * upload_image - Upload image to file input or drag target
 */
async function uploadImage(params: {
  imageId: string
  tabId: number
  ref?: string
  coordinate?: [number, number]
  filename?: string
}): Promise<unknown> {
  const { imageId, tabId, ref, coordinate, filename = 'image.png' } = params

  if (!tabId) throw new Error('tabId is required')
  if (!imageId) throw new Error('imageId is required')

  const screenshot = screenshotStore.get(imageId)
  if (!screenshot) {
    throw new Error(`Screenshot not found: ${imageId}`)
  }

  return sendToContentScript(tabId, {
    type: MessageTypes.UPLOAD_IMAGE,
    dataUrl: screenshot.dataUrl,
    ref,
    coordinate,
    filename
  })
}

/**
 * Register interaction tools
 */
export function registerInteractionTools(): void {
  registerTool('form_input', formInput as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('computer', computer as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('upload_image', uploadImage as (params: Record<string, unknown>) => Promise<unknown>)
}
