import { describe, expect, it } from 'vitest'
import { isNetlifyHudElement } from '../netlifyHud'

describe('isNetlifyHudElement', () => {
  it('detects Powered by Netlify pill outside #root', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)

    const hud = document.createElement('div')
    hud.textContent = 'Powered by Netlify'
    document.body.appendChild(hud)

    expect(isNetlifyHudElement(hud)).toBe(true)
    expect(isNetlifyHudElement(root)).toBe(false)

    document.body.removeChild(hud)
    document.body.removeChild(root)
  })

  it('does not hide in-app content mentioning Netlify', () => {
    const root = document.createElement('div')
    root.id = 'root'
    const inner = document.createElement('p')
    inner.textContent = 'Powered by Netlify'
    root.appendChild(inner)
    document.body.appendChild(root)

    expect(isNetlifyHudElement(inner)).toBe(false)

    document.body.removeChild(root)
  })
})
