/**
 * Image Upload Handler
 * Handles uploading images to file inputs and drag targets
 */

import { getElementByRef } from './elementRefs'

interface UploadResult {
  success?: boolean
  method?: 'file_input' | 'drag_drop'
  filename?: string
  error?: string
}

/**
 * Convert data URL to File object
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }

  const blob = new Blob([array], { type: mime })
  return new File([blob], filename, { type: mime })
}

/**
 * Handle UPLOAD_IMAGE request
 */
export function handleUploadImage(params: {
  dataUrl: string
  ref?: string
  coordinate?: [number, number]
  filename?: string
}): UploadResult {
  const { dataUrl, ref, coordinate, filename = 'image.png' } = params

  try {
    const file = dataUrlToFile(dataUrl, filename)

    let targetElement: Element | null = null

    if (ref) {
      targetElement = getElementByRef(ref)
    } else if (coordinate && coordinate.length === 2) {
      targetElement = document.elementFromPoint(coordinate[0], coordinate[1])
    }

    if (!targetElement) {
      return { error: 'Target element not found' }
    }

    // If it's a file input, set files directly
    if (targetElement.tagName === 'INPUT' && (targetElement as HTMLInputElement).type === 'file') {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      ;(targetElement as HTMLInputElement).files = dataTransfer.files
      targetElement.dispatchEvent(new Event('change', { bubbles: true }))
      return { success: true, method: 'file_input', filename }
    }

    // Otherwise, simulate drag and drop
    const dropDataTransfer = new DataTransfer()
    dropDataTransfer.items.add(file)

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dropDataTransfer
    })

    targetElement.dispatchEvent(new DragEvent('dragenter', { bubbles: true }))
    targetElement.dispatchEvent(new DragEvent('dragover', { bubbles: true }))
    targetElement.dispatchEvent(dropEvent)

    return { success: true, method: 'drag_drop', filename }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
