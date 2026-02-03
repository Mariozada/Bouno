/**
 * Message type constants for communication between
 * background script, content script, and side panel
 */

export const MessageTypes = {
  // Content script messages
  READ_PAGE: 'READ_PAGE',
  GET_PAGE_TEXT: 'GET_PAGE_TEXT',
  FIND_ELEMENTS: 'FIND_ELEMENTS',
  FORM_INPUT: 'FORM_INPUT',
  COMPUTER_ACTION: 'COMPUTER_ACTION',
  UPLOAD_IMAGE: 'UPLOAD_IMAGE',
  GET_CONSOLE_MESSAGES: 'GET_CONSOLE_MESSAGES',
  CLEAR_CONSOLE_MESSAGES: 'CLEAR_CONSOLE_MESSAGES',

  // Legacy content script messages (for side panel)
  GET_PAGE_INFO: 'GET_PAGE_INFO',
  HIGHLIGHT_TEXT: 'HIGHLIGHT_TEXT',
  GET_LINKS: 'GET_LINKS',
  GET_IMAGES: 'GET_IMAGES',

  // Background script messages
  GET_TAB_INFO: 'GET_TAB_INFO',
  EXECUTE_SCRIPT: 'EXECUTE_SCRIPT',
  EXECUTE_TOOL: 'EXECUTE_TOOL',
  CONSOLE_MESSAGE: 'CONSOLE_MESSAGE',
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
} as const

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes]

// Message interfaces
export interface BaseMessage {
  type: MessageType
}

export interface ReadPageMessage extends BaseMessage {
  type: typeof MessageTypes.READ_PAGE
  depth?: number
  filter?: 'all' | 'interactive'
  ref_id?: string
}

export interface FindElementsMessage extends BaseMessage {
  type: typeof MessageTypes.FIND_ELEMENTS
  query: string
}

export interface FormInputMessage extends BaseMessage {
  type: typeof MessageTypes.FORM_INPUT
  ref: string
  value: string | boolean | number
}

export interface ComputerActionMessage extends BaseMessage {
  type: typeof MessageTypes.COMPUTER_ACTION
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

export interface ExecuteToolMessage extends BaseMessage {
  type: typeof MessageTypes.EXECUTE_TOOL
  tool: string
  params: Record<string, unknown>
}

export interface ConsoleMessageData extends BaseMessage {
  type: typeof MessageTypes.CONSOLE_MESSAGE
  data: {
    type: string
    text: string
    timestamp: number
  }
}

// Helper to create typed messages
export function createMessage<T extends BaseMessage>(message: T): T {
  return message
}
