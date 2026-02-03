import { getElementByRef } from './elementRefs'

interface FormInputResult {
  success?: boolean
  ref?: string
  value?: string | boolean | number
  error?: string
}

export function handleFormInput(params: {
  ref: string
  value: string | boolean | number
}): FormInputResult {
  const { ref, value } = params

  const element = getElementByRef(ref)
  if (!element) {
    return { error: `Element not found: ${ref}` }
  }

  const tagName = element.tagName.toLowerCase()
  const inputType = (element as HTMLInputElement).type?.toLowerCase()

  try {
    if (tagName === 'select') {
      const selectEl = element as HTMLSelectElement
      const option = Array.from(selectEl.options).find(
        opt => opt.value === value || opt.text === value
      )
      if (option) {
        selectEl.value = option.value
      } else {
        selectEl.value = String(value)
      }
      selectEl.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (inputType === 'checkbox' || inputType === 'radio') {
      const inputEl = element as HTMLInputElement
      inputEl.checked = Boolean(value)
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (tagName === 'input' || tagName === 'textarea') {
      const inputEl = element as HTMLInputElement | HTMLTextAreaElement
      inputEl.focus()
      inputEl.value = String(value)
      inputEl.dispatchEvent(new Event('input', { bubbles: true }))
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
    } else if ((element as HTMLElement).contentEditable === 'true') {
      const editableEl = element as HTMLElement
      editableEl.focus()
      editableEl.textContent = String(value)
      editableEl.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      return { error: `Element is not a form input: ${tagName}` }
    }

    return { success: true, ref, value }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
