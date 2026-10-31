import '@testing-library/jest-dom'

if (typeof sessionStorage !== 'undefined') {
  sessionStorage.clear()
}

// jsdom does not implement matchMedia.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom does not implement Notification.
if (typeof window !== 'undefined' && !('Notification' in window)) {
  ;(window as unknown as { Notification: unknown }).Notification = {
    permission: 'denied',
    requestPermission: () => Promise.resolve('denied' as NotificationPermission),
  }
}

// jsdom lacks URL.createObjectURL used by CSV/JSON export.
if (typeof URL.createObjectURL === 'undefined') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: () => 'blob:mock',
  })
}
if (typeof URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: () => {},
  })
}

// Element.prototype.scrollIntoView is not implemented in jsdom.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

class ResizeObserverMock {
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    this.callback([{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this)
  }
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock })
}
if (typeof globalThis !== 'undefined') {
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock
}

if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 400, height: 220, top: 0, left: 0, bottom: 220, right: 400, x: 0, y: 0, toJSON: () => {} }) as DOMRect
}
