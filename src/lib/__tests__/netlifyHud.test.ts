import { describe, expect, it, afterEach } from 'vitest'
import {
  collectShadowText,
  isNetlifyCustomElement,
  isNetlifyHudElement,
  resolveHudHideTarget,
} from '../netlifyHud'

describe('isNetlifyHudElement', () => {
  const appended: Element[] = []

  afterEach(() => {
    while (appended.length > 0) {
      const node = appended.pop()
      node?.remove()
    }
  })

  function mount(el: Element): Element {
    document.body.appendChild(el)
    appended.push(el)
    return el
  }

  it('detects Powered by Netlify pill outside #root', () => {
    mount(Object.assign(document.createElement('div'), { id: 'root' }))

    const hud = mount(document.createElement('div'))
    hud.textContent = 'Powered by Netlify'

    expect(isNetlifyHudElement(hud)).toBe(true)
    expect(isNetlifyHudElement(document.getElementById('root')!)).toBe(false)
  })

  it('detects custom element host with shadow text Powered by Netlify', () => {
    class NfHudTest extends HTMLElement {
      connectedCallback(): void {
        if (this.shadowRoot) return
        const shadow = this.attachShadow({ mode: 'open' })
        const pill = document.createElement('span')
        pill.textContent = 'Powered by Netlify'
        shadow.appendChild(pill)
      }
    }

    if (!customElements.get('nf-hud-test')) {
      customElements.define('nf-hud-test', NfHudTest)
    }

    mount(Object.assign(document.createElement('div'), { id: 'root' }))

    const hud = mount(document.createElement('nf-hud-test'))
    expect(hud.textContent?.trim()).toBe('')
    expect(collectShadowText(hud)).toContain('Powered by Netlify')
    expect(isNetlifyHudElement(hud)).toBe(true)
    expect(resolveHudHideTarget(hud)?.tagName.toLowerCase()).toBe('nf-hud-test')
  })

  it('detects nf-* custom element host when host textContent is empty', () => {
    mount(Object.assign(document.createElement('div'), { id: 'root' }))

    const hud = mount(document.createElement('nf-badge'))
    expect(hud.textContent?.trim()).toBe('')
    expect(isNetlifyCustomElement(hud)).toBe(true)
    expect(isNetlifyHudElement(hud)).toBe(true)
  })

  it('does not hide in-app content mentioning Netlify', () => {
    const root = mount(Object.assign(document.createElement('div'), { id: 'root' }))
    const inner = document.createElement('p')
    inner.textContent = 'Powered by Netlify'
    root.appendChild(inner)

    expect(isNetlifyHudElement(inner)).toBe(false)
  })
})
