/**
 * Clipboard helpers that prefer the Tauri plugin and gracefully fall back to browser APIs.
 */

let tauriInvoke:
  | ((command: string, args?: Record<string, any>) => Promise<any>)
  | null
  | undefined = undefined;

/**
 * Detect whether we are running inside a Tauri environment.
 */
const isTauriEnvironment = (): boolean => {
  return (
    typeof window !== "undefined" &&
    // Tauri global is injected on the window object.
    Boolean((window as any)?.__TAURI_INTERNALS__)
  );
};

/**
 * Load the Tauri clipboard plugin lazily.
 */
const getTauriInvoke = async () => {
  if (tauriInvoke === null) {
    return null;
  }

  if (typeof tauriInvoke === "function") {
    return tauriInvoke;
  }

  try {
    const module = await import("@tauri-apps/api/core");
    tauriInvoke = module.invoke;
    return tauriInvoke;
  } catch (error) {
    console.error("[Clipboard] Failed to load Tauri core invoke:", error);
    tauriInvoke = null;
    return null;
  }
};

/**
 * Copy plain text to the system clipboard.
 * Prefers the Tauri clipboard plugin, then Navigator clipboard API, finally a legacy execCommand fallback.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  const normalizedText = text ?? "";

  // Try the Tauri clipboard plugin first when running in the desktop app.
  if (isTauriEnvironment()) {
    const invoke = await getTauriInvoke();
    if (invoke) {
      try {
        await invoke("plugin:clipboard-manager|write_text", { text: normalizedText });
        return;
      } catch (error) {
        console.error("[Clipboard] Tauri invoke write failed:", error);
      }
    }
  }

  // Fall back to the modern Navigator clipboard API.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalizedText);
      return;
    } catch (error) {
      console.error("[Clipboard] Navigator clipboard write failed:", error);
    }
  }

  // Final fallback – use a hidden textarea with execCommand.
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = normalizedText;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.select();
    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
      if (!successful) {
        throw new Error("execCommand returned false");
      }
      return;
    } catch (error) {
      document.body.removeChild(textarea);
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
      console.error("[Clipboard] Legacy execCommand copy failed:", error);
    }
  }

  throw new Error("Unable to copy text using any available clipboard method");
}
