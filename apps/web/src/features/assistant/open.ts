export const OPEN_EVENT = 'bm:assistant';

/** Open the assistant from anywhere, optionally asking a question straight away. */
export function openAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: question }));
}
