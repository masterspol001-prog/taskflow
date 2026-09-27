import '@testing-library/jest-dom'

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
