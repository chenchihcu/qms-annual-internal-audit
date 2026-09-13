const HUD_TEXT = 'Powered by Netlify'
const HIDDEN_ATTR = 'data-qms-netlify-hud-hidden'

function isInsideAppRoot(el: Element): boolean {
  return el.closest('#root') !== null
}

/** 供測試：是否為 Netlify nf-* 自訂元素 */
export function isNetlifyCustomElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  return tag.startsWith('nf-') || tag.startsWith('netlify-')
}

function readAccessibleText(el: Element): string {
  const parts: string[] = []
  if (el instanceof HTMLElement) {
    const aria = el.getAttribute('aria-label')
    if (aria) parts.push(aria)
    const title = el.getAttribute('title')
    if (title) parts.push(title)
  }
  parts.push(el.textContent ?? '')
  return parts.join(' ')
}

/** 供測試：遞迴收集元素及其 open shadow root 內文字 */
export function collectShadowText(el: Element, depth = 0): string {
  if (depth > 10) return ''

  const parts: string[] = [readAccessibleText(el)]

  if (el.shadowRoot) {
    for (const child of el.shadowRoot.querySelectorAll('*')) {
      parts.push(collectShadowText(child, depth + 1))
    }
  }

  for (const child of el.children) {
    parts.push(collectShadowText(child, depth + 1))
  }

  return parts.join(' ')
}

function isNetlifyIframe(el: Element): boolean {
  if (el.tagName !== 'IFRAME' || !(el instanceof HTMLIFrameElement)) return false
  if (isInsideAppRoot(el)) return false

  const src = el.src || el.getAttribute('src') || ''
  if (/netlify/i.test(src)) return true

  if (typeof window === 'undefined') return false

  const style = window.getComputedStyle(el)
  if (style.position !== 'fixed') return false

  const rect = el.getBoundingClientRect()
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= window.innerHeight - 120 &&
    rect.right >= window.innerWidth - 40 &&
    rect.width <= 480
  )
}

function isFixedBottomRightNetlifyHud(el: Element): boolean {
  if (typeof window === 'undefined' || !(el instanceof HTMLElement)) return false
  if (isInsideAppRoot(el)) return false

  const style = window.getComputedStyle(el)
  if (style.position !== 'fixed') return false

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const nearBottomRight =
    rect.bottom >= window.innerHeight - 80 && rect.right >= window.innerWidth - 40
  if (!nearBottomRight) return false

  const combined = collectShadowText(el).toLowerCase()
  return combined.includes('netlify') || isNetlifyCustomElement(el)
}

/** 供測試：是否為 Netlify HUD 注入節點（含 shadow root / nf-* / iframe） */
export function isNetlifyHudElement(el: Element): boolean {
  if (isInsideAppRoot(el)) return false
  if (el.id === 'root') return false

  if (el.id === 'netlify-badge' || el.classList.contains('netlify-badge')) return true
  if (isNetlifyCustomElement(el)) return true
  if (isNetlifyIframe(el)) return true

  if (collectShadowText(el).includes(HUD_TEXT)) return true

  const accessible = readAccessibleText(el).toLowerCase()
  if (accessible.includes(HUD_TEXT.toLowerCase())) return true

  if (isFixedBottomRightNetlifyHud(el)) return true

  return false
}

function hideElement(el: HTMLElement): void {
  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('pointer-events', 'none', 'important')
  el.style.setProperty('visibility', 'hidden', 'important')
  el.setAttribute(HIDDEN_ATTR, 'true')
}

/** 向上解析應隱藏的最外層 HUD 宿主（nf-* 或 body 直屬子節點） */
export function resolveHudHideTarget(el: Element): HTMLElement | null {
  if (isInsideAppRoot(el)) return null

  let bodyChild: HTMLElement | null = null
  let current: Element | null = el

  while (current && current !== document.body) {
    if (current instanceof HTMLElement) {
      if (isNetlifyCustomElement(current)) return current
      if (current.parentElement === document.body) bodyChild = current
    }
    current = current.parentElement
  }

  if (bodyChild && isNetlifyHudElement(bodyChild)) return bodyChild
  return el instanceof HTMLElement && isNetlifyHudElement(el) ? el : null
}

function walkElementTree(root: Element | ShadowRoot, visit: (el: Element) => void): void {
  const elements =
    root instanceof ShadowRoot
      ? Array.from(root.querySelectorAll('*'))
      : [root, ...Array.from(root.querySelectorAll('*'))]

  for (const el of elements) {
    visit(el)
    if (el.shadowRoot) walkElementTree(el.shadowRoot, visit)
  }
}

function hideHudIfMatch(el: Element): void {
  if (!isNetlifyHudElement(el)) return
  const target = resolveHudHideTarget(el)
  if (target) hideElement(target)
}

function scanAndHide(root: ParentNode = document.body): void {
  if (root === document.body) {
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && child.id !== 'root') {
        hideHudIfMatch(child)
        walkElementTree(child, hideHudIfMatch)
      }
    }
    return
  }

  if (root instanceof HTMLElement) {
    hideHudIfMatch(root)
    walkElementTree(root, hideHudIfMatch)
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
          hideHudIfMatch(node)
          walkElementTree(node, hideHudIfMatch)
          if (node.shadowRoot) walkElementTree(node.shadowRoot, hideHudIfMatch)
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
