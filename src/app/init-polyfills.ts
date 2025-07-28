// This file polyfills `crypto.randomUUID` for environments that don't support it.
// It should be imported at the very top of the main application file (e.g., layout.tsx or App.tsx).

if (typeof window !== 'undefined' && typeof window.crypto === 'undefined') {
  // @ts-ignore
  window.crypto = {};
}

if (typeof window !== 'undefined' && typeof window.crypto.randomUUID !== 'function') {
  // A simple, non-cryptographically secure UUID v4 polyfill.
  // This is sufficient for the client-side needs of the OpenAI library.
  // @ts-ignore
  window.crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

export {}; // Ensures this file is treated as a module. 