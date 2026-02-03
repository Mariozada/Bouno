/**
 * Configuration constants for BrowseRun
 */

// Accessibility tree
export const DEFAULT_TREE_DEPTH = 15
export const MAX_OUTPUT_CHARS = 50000
export const MAX_FIND_RESULTS = 20

// Console capture
export const MAX_CONSOLE_MESSAGES = 500

// Network capture
export const MAX_NETWORK_REQUESTS = 500

// Screenshots
export const MAX_SCREENSHOTS = 50

// GIF recording
export const MAX_GIF_FRAMES = 200

// Interactive element tags
export const INTERACTIVE_TAGS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']

// Interactive ARIA roles
export const INTERACTIVE_ROLES = [
  'button',
  'link',
  'checkbox',
  'radio',
  'textbox',
  'combobox',
  'slider',
  'switch',
  'tab',
  'menuitem'
]

// Tags to skip when building accessibility tree
export const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT']

// Role mapping from HTML tags
export const TAG_TO_ROLE: Record<string, string | ((el: Element) => string)> = {
  'a': (el) => el.hasAttribute('href') ? 'link' : 'generic',
  'button': 'button',
  'select': 'combobox',
  'textarea': 'textbox',
  'img': 'img',
  'h1': 'heading',
  'h2': 'heading',
  'h3': 'heading',
  'h4': 'heading',
  'h5': 'heading',
  'h6': 'heading',
  'ul': 'list',
  'ol': 'list',
  'li': 'listitem',
  'nav': 'navigation',
  'main': 'main',
  'header': 'banner',
  'footer': 'contentinfo',
  'form': 'form',
  'table': 'table',
  'tr': 'row',
  'td': 'cell',
  'th': 'columnheader',
  'article': 'article',
  'section': 'region',
  'dialog': 'dialog'
}

// Input type to role mapping
export const INPUT_TYPE_TO_ROLE: Record<string, string> = {
  'button': 'button',
  'submit': 'button',
  'reset': 'button',
  'checkbox': 'checkbox',
  'radio': 'radio',
  'range': 'slider',
  'search': 'searchbox',
  'text': 'textbox',
  'email': 'textbox',
  'password': 'textbox',
  'tel': 'textbox',
  'url': 'textbox',
  'number': 'spinbutton'
}
