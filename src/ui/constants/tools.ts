import type { ToolDef } from '../types'

export const TOOLS: ToolDef[] = [
  // Page Reading Tools
  {
    name: 'read_page',
    description: 'Get accessibility tree of the page',
    params: [
      { name: 'tabId', type: 'number', required: true, description: 'Tab ID' },
      { name: 'filter', type: 'select', options: ['all', 'interactive'], default: 'all' },
      { name: 'depth', type: 'number', default: 15 },
      { name: 'ref_id', type: 'string', description: 'Focus on specific element' },
    ],
  },
  {
    name: 'get_page_text',
    description: 'Extract raw text content (title, url, source, text)',
    params: [
      { name: 'tabId', type: 'number', required: true },
    ],
  },
  {
    name: 'find',
    description: 'Find elements by natural language query',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'query', type: 'string', required: true, description: 'Search query' },
    ],
  },

  // Interaction Tools
  {
    name: 'computer',
    description: 'Mouse/keyboard actions and screenshots',
    params: [
      { name: 'tabId', type: 'number', required: true },
      {
        name: 'action',
        type: 'select',
        required: true,
        options: [
          'left_click', 'right_click', 'double_click', 'triple_click',
          'type', 'key', 'scroll', 'scroll_to', 'hover',
          'left_click_drag', 'screenshot', 'zoom', 'wait',
        ],
      },
      { name: 'ref', type: 'string', description: 'Element ref (e.g., ref_1)' },
      { name: 'coordinate', type: 'string', description: 'x,y coordinates (e.g., 100,200)' },
      { name: 'text', type: 'string', description: 'Text to type or key to press' },
      { name: 'modifiers', type: 'string', description: 'Modifier keys (ctrl, shift, alt, cmd)' },
      { name: 'scroll_direction', type: 'select', options: ['up', 'down', 'left', 'right'] },
      { name: 'scroll_amount', type: 'number', default: 3 },
      { name: 'start_coordinate', type: 'string', description: 'Start x,y for drag (e.g., 100,200)' },
      { name: 'repeat', type: 'number', default: 1, description: 'Times to repeat key' },
      { name: 'duration', type: 'number', description: 'Seconds to wait (for wait action)' },
      { name: 'region', type: 'string', description: 'x0,y0,x1,y1 for zoom (e.g., 0,0,500,500)' },
    ],
  },
  {
    name: 'form_input',
    description: 'Set form input values',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'ref', type: 'string', required: true, description: 'Element ref' },
      { name: 'value', type: 'string', required: true, description: 'Value to set' },
    ],
  },
  {
    name: 'upload_image',
    description: 'Upload image to file input or drag target',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'imageId', type: 'string', required: true, description: 'Screenshot ID from computer tool' },
      { name: 'ref', type: 'string', description: 'File input element ref' },
      { name: 'coordinate', type: 'string', description: 'x,y for drag & drop' },
      { name: 'filename', type: 'string', default: 'image.png' },
    ],
  },

  // Navigation Tools
  {
    name: 'navigate',
    description: 'Navigate to URL or back/forward',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'url', type: 'string', required: true, description: "URL or 'back'/'forward'" },
    ],
  },
  {
    name: 'tabs_context',
    description: 'List all open tabs',
    params: [],
  },
  {
    name: 'tabs_create',
    description: 'Create a new tab',
    params: [
      { name: 'url', type: 'string', description: 'URL to open' },
    ],
  },
  {
    name: 'resize_window',
    description: 'Resize the browser window',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'width', type: 'number', required: true, description: 'Window width in pixels' },
      { name: 'height', type: 'number', required: true, description: 'Window height in pixels' },
    ],
  },
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL',
    params: [
      { name: 'url', type: 'string', required: true, description: 'URL to fetch' },
    ],
  },

  // Debugging Tools
  {
    name: 'read_console_messages',
    description: 'Read browser console messages',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'pattern', type: 'string', description: 'Filter pattern' },
      { name: 'limit', type: 'number', default: 100 },
      { name: 'onlyErrors', type: 'boolean', default: false },
      { name: 'clear', type: 'boolean', default: false, description: 'Clear after reading' },
    ],
  },
  {
    name: 'read_network_requests',
    description: 'Read HTTP network requests',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'pattern', type: 'string', description: 'URL pattern to filter' },
      { name: 'limit', type: 'number', default: 100 },
      { name: 'clear', type: 'boolean', default: false },
    ],
  },
  {
    name: 'javascript_tool',
    description: 'Execute JavaScript in page context',
    params: [
      { name: 'tabId', type: 'number', required: true },
      { name: 'code', type: 'string', required: true, description: 'JavaScript code' },
    ],
  },

  // Media Tools
  {
    name: 'gif_creator',
    description: 'Record and export GIF animations',
    params: [
      { name: 'tabId', type: 'number', required: true },
      {
        name: 'action',
        type: 'select',
        required: true,
        options: ['start_recording', 'stop_recording', 'export', 'clear'],
      },
      { name: 'download', type: 'boolean', default: false, description: 'Download the GIF' },
      { name: 'filename', type: 'string', description: 'Filename for download' },
      { name: 'coordinate', type: 'string', description: 'x,y for drag & drop upload' },
    ],
  },

  // UI Tools
  {
    name: 'update_plan',
    description: 'Present a plan for user approval',
    params: [
      { name: 'approach', type: 'string', required: true, description: 'High-level description of steps' },
      { name: 'domains', type: 'string', required: true, description: 'Comma-separated domains to visit' },
    ],
  },
]

export const getToolByName = (name: string): ToolDef | undefined => {
  return TOOLS.find(tool => tool.name === name)
}
