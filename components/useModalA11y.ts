"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Dialog accessibility for the modal overlays (COM audit 2026-07-07):
 * moves focus into the dialog on open (preferring an [autofocus] element),
 * traps Tab/Shift+Tab inside it, closes on Escape, and restores focus to the
 * opener on unmount. Attach the returned ref to the overlay element and give
 * it tabIndex={-1} so it can take focus when nothing inside is focusable.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Keep the latest onClose without re-running the mount effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0
      );

    const preferred = node.querySelector<HTMLElement>("[autofocus]");
    (preferred ?? focusables()[0] ?? node).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, []);

  return ref;
}
