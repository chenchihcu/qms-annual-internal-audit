const HUD_TEXT = 'Powered by Netlify'
const HIDDEN_ATTR = 'data-qms-netlify-hud-hidden'

/** 供測試：是否為 Netlify HUD 注入節點（非 #netlify-badge 時以文字與位置判斷） */
export function isNetlifyHudElement(el: Element): boolean {
  if (el.closest('#root')) return false
  if (el.id === 'netlify-badge' || el.classList.contains('netlify-badge')) return true

  const text = el.textContent?.trim() ?? ''
  if (text.includes(HUD_TEXT)) return true

  if (typeof window !== 'undefined' && el instanceof HTMLElement) {
    const style = window.getComputedStyle(el)
    if (style.position === 'fixed' && /netlify/i.test(text)) return true
  }

  return false
}

function hideElement(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('pointer-events', 'none', 'important')
  el.style.setProperty('visibility', 'hidden', 'important')
  el.setAttribute(HIDDEN_ATTR, 'true')
}

function scanAndHide(root: ParentNode = document.body): void {
  if (!(root instanceof HTMLElement) && root !== document.body) return

  const nodes: Element[] =
    root === document.body
      ? Array.from(document.body.children)
      : root instanceof Element
        ? [root, ...Array.from(root.querySelectorAll('*'))]
        : []

  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue
    if (el.id === 'root') continue
    if (isNetlifyHudElement(el)) hideElement(el)
  }
}

/** 隱藏 Netlify /.netlify/scripts/hud 注入的浮動徽章，不影響 #root 內應用 */
export function initNetlifyHudHide(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  scanAndHide()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (isNetlifyHudElement(node)) hideElement(node)
          scanAndHide(node)
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
