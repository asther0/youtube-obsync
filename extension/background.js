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
  if (message?.type !== "GET_ACTIVE_YOUTUBE_STATE") return false;

  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id || !tab.url?.includes("youtube.com/watch")) {
      sendResponse({ ok: false, error: "Abre un video de YouTube." });
      return;
    }

    try {
      const response = await sendVideoStateMessage(tab.id);
      sendResponse({ ...response, tab });
    } catch {
      sendResponse({
        ok: false,
        error: "Recarga la pestaña de YouTube para activar Obsync en este video."
      });
    }
  });

  return true;
});

async function sendVideoStateMessage(tabId) {
  return await chrome.tabs.sendMessage(tabId, { type: "GET_YOUTUBE_VIDEO_STATE" });
}
