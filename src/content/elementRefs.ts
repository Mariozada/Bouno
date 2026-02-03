/**
 * Element Reference System
 *
 * Re-exports the WeakRef-based element tracking from accessibilityTree.
 * This module is kept for backward compatibility with other content scripts.
 */

export { getElementByRef, clearRefs, getRefCount, assignRef } from './accessibilityTree'
