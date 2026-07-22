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

async function sendVideoStateMessage(tabId) {
  return await chrome.tabs.sendMessage(tabId, { type: "GET_YOUTUBE_VIDEO_STATE" });
}

function isCapturablePage(url = "") {
  return /^https?:\/\//.test(url);
}
