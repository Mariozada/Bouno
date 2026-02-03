import { getElementByRef, assignRef } from './elementRefs'

interface ModifierKeys {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

interface ComputerActionParams {
  action: string
  coordinate?: [number, number]
  ref?: string
  text?: string
  modifiers?: string
  scroll_direction?: string
  scroll_amount?: number
  start_coordinate?: [number, number]
  repeat?: number
}

interface ActionResult {
  success?: boolean
  action?: string
  target?: string
  text?: string
  keys?: string
  repeat?: number
  direction?: string
  ref?: string
  start?: [number, number]
  end?: [number, number]
  error?: string
}

function parseModifiers(modifiers?: string): ModifierKeys {
  const result: ModifierKeys = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false
  }

  if (modifiers) {
    const mods = modifiers.toLowerCase().split('+')
    result.ctrl = mods.includes('ctrl') || mods.includes('control')
    result.shift = mods.includes('shift')
    result.alt = mods.includes('alt')
    result.meta = mods.includes('cmd') || mods.includes('meta') || mods.includes('win') || mods.includes('windows')
  }

  return result
}

function getTarget(params: ComputerActionParams): {
  element: Element | null
  x: number
  y: number
} {
  if (params.ref) {
    const element = getElementByRef(params.ref)
    if (!element) {
      return { element: null, x: 0, y: 0 }
    }
    const rect = element.getBoundingClientRect()
    return {
      element,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    }
  }

  if (params.coordinate && params.coordinate.length === 2) {
    const [x, y] = params.coordinate
    const element = document.elementFromPoint(x, y)
    return { element, x, y }
  }

  return { element: null, x: 0, y: 0 }
}

function handleClick(
  action: string,
  target: Element,
  x: number,
  y: number,
  modifierKeys: ModifierKeys
): ActionResult {
  const button = action === 'right_click' ? 2 : 0
  const clickCount = action === 'double_click' ? 2 : action === 'triple_click' ? 3 : 1

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    button,
    buttons: action === 'right_click' ? 2 : 1,
    ctrlKey: modifierKeys.ctrl,
    shiftKey: modifierKeys.shift,
    altKey: modifierKeys.alt,
    metaKey: modifierKeys.meta
  }

  target.dispatchEvent(new MouseEvent('mousedown', eventInit))
  target.dispatchEvent(new MouseEvent('mouseup', eventInit))
  target.dispatchEvent(new MouseEvent('click', { ...eventInit, detail: clickCount }))

  if (action === 'right_click') {
    target.dispatchEvent(new MouseEvent('contextmenu', eventInit))
  }

  if (action === 'double_click') {
    target.dispatchEvent(new MouseEvent('dblclick', eventInit))
  }

  if ('focus' in target && typeof target.focus === 'function') {
    (target as HTMLElement).focus()
  }

  return { success: true, action, target: assignRef(target) }
}

function handleType(text: string, target: Element | null): ActionResult {
  const typeTarget = target || document.activeElement

  if (!typeTarget) {
    return { error: 'No target element for type action' }
  }

  if ('value' in typeTarget) {
    const inputEl = typeTarget as HTMLInputElement
    inputEl.value += text
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
  } else if ((typeTarget as HTMLElement).contentEditable === 'true') {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
    }
  }

  return { success: true, action: 'type', text }
}

function handleKey(
  text: string,
  repeat: number,
  target: Element | null,
  modifierKeys: ModifierKeys
): ActionResult {
  const keys = text.split(' ')
  const keyTarget = target || document.activeElement || document.body

  for (let i = 0; i < repeat; i++) {
    for (const keySpec of keys) {
      const parts = keySpec.split('+')
      const key = parts.pop() || ''
      const keyModifiers = {
        ctrlKey: parts.includes('ctrl') || parts.includes('control') || modifierKeys.ctrl,
        shiftKey: parts.includes('shift') || modifierKeys.shift,
        altKey: parts.includes('alt') || modifierKeys.alt,
        metaKey: parts.includes('cmd') || parts.includes('meta') || modifierKeys.meta
      }

      keyTarget.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
        ...keyModifiers
      }))

      keyTarget.dispatchEvent(new KeyboardEvent('keyup', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
        ...keyModifiers
      }))
    }
  }

  return { success: true, action: 'key', keys: text, repeat }
}

function handleScroll(
  direction: string,
  amount: number,
  target: Element | null
): ActionResult {
  const scrollTarget = target || document.documentElement
  const scrollAmount = amount * 100

  const deltaMap: Record<string, { x: number; y: number }> = {
    'up': { x: 0, y: -scrollAmount },
    'down': { x: 0, y: scrollAmount },
    'left': { x: -scrollAmount, y: 0 },
    'right': { x: scrollAmount, y: 0 }
  }

  const delta = deltaMap[direction]
  if (!delta) {
    return { error: `Invalid scroll direction: ${direction}` }
  }

  scrollTarget.scrollBy({
    left: delta.x,
    top: delta.y,
    behavior: 'smooth'
  })

  return { success: true, action: 'scroll', direction }
}

function handleScrollTo(target: Element, ref: string): ActionResult {
  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  })

  return { success: true, action: 'scroll_to', ref }
}

function handleHover(target: Element, x: number, y: number): ActionResult {
  target.dispatchEvent(new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y
  }))

  target.dispatchEvent(new MouseEvent('mouseenter', {
    bubbles: false,
    cancelable: false,
    view: window,
    clientX: x,
    clientY: y
  }))

  return { success: true, action: 'hover', target: assignRef(target) }
}

function handleDrag(
  startCoord: [number, number],
  endCoord: [number, number]
): ActionResult {
  const startElement = document.elementFromPoint(startCoord[0], startCoord[1])
  const endElement = document.elementFromPoint(endCoord[0], endCoord[1])

  if (startElement) {
    startElement.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      clientX: startCoord[0],
      clientY: startCoord[1],
      button: 0
    }))

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: endCoord[0],
      clientY: endCoord[1]
    }))

    const upTarget = endElement || document
    upTarget.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      clientX: endCoord[0],
      clientY: endCoord[1],
      button: 0
    }))
  }

  return {
    success: true,
    action: 'left_click_drag',
    start: startCoord,
    end: endCoord
  }
}

export function handleComputerAction(params: ComputerActionParams): ActionResult {
  const { action, text, scroll_direction, scroll_amount = 3, start_coordinate, repeat = 1 } = params

  const { element: targetElement, x: targetX, y: targetY } = getTarget(params)
  const modifierKeys = parseModifiers(params.modifiers)

  try {
    switch (action) {
      case 'left_click':
      case 'right_click':
      case 'double_click':
      case 'triple_click': {
        if (!targetElement) {
          return { error: 'No target element found at coordinates' }
        }
        return handleClick(action, targetElement, targetX, targetY, modifierKeys)
      }

      case 'type': {
        if (!text) {
          return { error: 'text is required for type action' }
        }
        return handleType(text, targetElement)
      }

      case 'key': {
        if (!text) {
          return { error: 'text (key sequence) is required for key action' }
        }
        return handleKey(text, repeat, targetElement, modifierKeys)
      }

      case 'scroll': {
        if (!scroll_direction) {
          return { error: 'scroll_direction is required for scroll action' }
        }
        return handleScroll(scroll_direction, scroll_amount, targetElement)
      }

      case 'scroll_to': {
        if (!targetElement) {
          return { error: 'ref is required for scroll_to action' }
        }
        return handleScrollTo(targetElement, params.ref || '')
      }

      case 'hover': {
        if (!targetElement) {
          return { error: 'target element required for hover action' }
        }
        return handleHover(targetElement, targetX, targetY)
      }

      case 'left_click_drag': {
        if (!start_coordinate || start_coordinate.length !== 2) {
          return { error: 'start_coordinate is required for left_click_drag' }
        }
        if (!params.coordinate || params.coordinate.length !== 2) {
          return { error: 'coordinate (end position) is required for left_click_drag' }
        }
        return handleDrag(start_coordinate, params.coordinate)
      }

      default:
        return { error: `Unknown action: ${action}` }
    }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
