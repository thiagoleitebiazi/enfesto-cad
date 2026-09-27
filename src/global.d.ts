import type { EnfestoCadApi } from '../electron/preload';

declare global {
  interface Window {
    readonly enfestoCad?: EnfestoCadApi;
  }
}

export {};
