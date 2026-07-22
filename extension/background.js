chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CAPTURE_VISIBLE_TAB") return false;

  chrome.tabs.captureVisibleTab(message.windowId, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError?.message || "No pude capturar la pestaña visible."
      });
      return;
    }

    sendResponse({ ok: true, dataUrl });
  });

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GET_ACTIVE_PAGE_STATE") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id || !isCapturablePage(tab.url)) {
      sendResponse({ ok: false, error: "Abre una página web capturable." });
      return;
    }

    const page = {
      url: tab.url,
      title: tab.title || "Página sin título",
      isYouTube: tab.url.includes("youtube.com/watch")
    };

    if (!page.isYouTube) {
      sendResponse({ ok: true, page, tab });
      return;
    }

    try {
      const response = await sendVideoStateMessage(tab.id);
      sendResponse({ ...response, page, tab });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["youtube-content.js"]
        });
        const response = await sendVideoStateMessage(tab.id);
        sendResponse({ ...response, page, tab });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Recarga la pestaña de YouTube para activar Obsync."
        });
      }
    }
  });

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SELECT_SCREEN_REGION") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id || !isCapturablePage(tab.url)) {
      sendResponse({ ok: false, error: "Abre una página web capturable." });
      return;
    }

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: selectScreenRegion
      });
      sendResponse({ ok: true, region: result?.result ?? null });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "No pude iniciar el recorte en la página."
      });
    }
  });

  return true;
});

async function sendVideoStateMessage(tabId) {
  return await chrome.tabs.sendMessage(tabId, { type: "GET_YOUTUBE_VIDEO_STATE" });
}

function isCapturablePage(url = "") {
  return /^https?:\/\//.test(url);
}

function selectScreenRegion() {
  return new Promise((resolve) => {
    const existing = document.querySelector("[data-obsync-region-picker]");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.dataset.obsyncRegionPicker = "true";
    overlay.style.cssText = [
      "position: fixed",
      "inset: 0",
      "z-index: 2147483647",
      "background: rgba(0, 0, 0, 0.12)",
      "cursor: crosshair",
      "user-select: none"
    ].join(";");

    const selection = document.createElement("div");
    selection.style.cssText = [
      "position: fixed",
      "display: none",
      "border: 1px solid white",
      "border-radius: 4px",
      "background: rgba(124, 92, 255, 0.08)",
      "box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.22)",
      "pointer-events: none"
    ].join(";");

    const hint = document.createElement("div");
    hint.textContent = "Arrastra · Esc";
    hint.style.cssText = [
      "position: fixed",
      "top: 10px",
      "left: 50%",
      "transform: translateX(-50%)",
      "padding: 5px 9px",
      "border-radius: 999px",
      "background: rgba(20, 20, 24, 0.8)",
      "color: white",
      "font: 700 11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2)",
      "pointer-events: none"
    ].join(";");

    let start = null;
    let latest = null;

    function cleanup(result) {
      window.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      resolve(result);
    }

    function point(event) {
      return {
        x: Math.min(window.innerWidth, Math.max(0, event.clientX)),
        y: Math.min(window.innerHeight, Math.max(0, event.clientY))
      };
    }

    function draw() {
      if (!start || !latest) return;
      const x = Math.min(start.x, latest.x);
      const y = Math.min(start.y, latest.y);
      const width = Math.abs(latest.x - start.x);
      const height = Math.abs(latest.y - start.y);
      selection.style.display = "block";
      selection.style.left = `${x}px`;
      selection.style.top = `${y}px`;
      selection.style.width = `${width}px`;
      selection.style.height = `${height}px`;
    }

    function onKeyDown(event) {
      if (event.key === "Escape") cleanup(null);
    }

    overlay.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      start = point(event);
      latest = start;
      overlay.setPointerCapture(event.pointerId);
      draw();
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!start) return;
      latest = point(event);
      draw();
    });

    overlay.addEventListener("pointerup", (event) => {
      if (!start) return;
      latest = point(event);
      const x = Math.min(start.x, latest.x);
      const y = Math.min(start.y, latest.y);
      const width = Math.abs(latest.x - start.x);
      const height = Math.abs(latest.y - start.y);
      if (width < 12 || height < 12) {
        cleanup(null);
        return;
      }
      cleanup({
        x,
        y,
        width,
        height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });
    });

    overlay.append(selection, hint);
    document.documentElement.append(overlay);
    window.addEventListener("keydown", onKeyDown, true);
  });
}
