const state = {
  tab: null,
  video: null,
  start: null,
  screenshots: []
};

const elements = {
  connection: document.querySelector("#connection"),
  videoTitle: document.querySelector("#videoTitle"),
  range: document.querySelector("#range"),
  userNote: document.querySelector("#userNote"),
  startBtn: document.querySelector("#startBtn"),
  screenshotBtn: document.querySelector("#screenshotBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  screenshotCount: document.querySelector("#screenshotCount"),
  backendUrl: document.querySelector("#backendUrl"),
  obsidianUrl: document.querySelector("#obsidianUrl"),
  obsidianToken: document.querySelector("#obsidianToken"),
  folders: document.querySelector("#folders"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  message: document.querySelector("#message")
};

init();

async function init() {
  await loadSettings();
  await refreshVideo();
  render();

  elements.startBtn.addEventListener("click", startClip);
  elements.screenshotBtn.addEventListener("click", takeScreenshot);
  elements.saveBtn.addEventListener("click", saveClip);
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    backendUrl: "http://localhost:4177",
    obsidianUrl: "http://127.0.0.1:27123",
    obsidianToken: "",
    folders: "Inbox, Learning, Ideas, Frameworks, Examples"
  });

  elements.backendUrl.value = settings.backendUrl;
  elements.obsidianUrl.value = settings.obsidianUrl;
  elements.obsidianToken.value = settings.obsidianToken;
  elements.folders.value = settings.folders;
  elements.connection.textContent = settings.obsidianToken ? "Obsidian ready" : "Set token";
}

async function saveSettings() {
  await chrome.storage.sync.set({
    backendUrl: elements.backendUrl.value.trim(),
    obsidianUrl: elements.obsidianUrl.value.trim(),
    obsidianToken: elements.obsidianToken.value.trim(),
    folders: elements.folders.value.trim()
  });
  setMessage("Settings saved.");
  await loadSettings();
}

async function refreshVideo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;

  if (!tab?.id || !tab.url?.includes("youtube.com/watch")) {
    state.video = null;
    return;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const video = document.querySelector("video");
      return {
        url: location.href,
        title: document.title.replace(/ - YouTube$/, ""),
        currentTime: video ? Math.round(video.currentTime) : 0
      };
    }
  });

  state.video = result;
}

async function startClip() {
  await refreshVideo();
  if (!state.video) {
    setMessage("Open a YouTube video first.");
    return;
  }

  state.start = state.video.currentTime;
  state.screenshots = [];
  setMessage(`Started at ${formatTime(state.start)}.`);
  render();
}

async function takeScreenshot() {
  if (!state.tab?.windowId) {
    setMessage("Open a YouTube video first.");
    return;
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(state.tab.windowId, { format: "png" });
  state.screenshots.push({
    dataUrl,
    timestamp: state.video?.currentTime ?? 0
  });
  setMessage("Screenshot captured.");
  render();
}

async function saveClip() {
  await refreshVideo();
  if (!state.video || state.start === null) {
    setMessage("Start a clip first.");
    return;
  }

  const settings = await chrome.storage.sync.get(["backendUrl", "obsidianUrl", "obsidianToken", "folders"]);
  if (!settings.obsidianToken) {
    setMessage("Add your Obsidian Local REST API token in Settings.");
    return;
  }

  const end = Math.max(state.start + 1, state.video.currentTime);
  setMessage("Generating note...");
  render(true);

  try {
    const captureResponse = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/obsync-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: state.video.url,
        start: state.start,
        end,
        userNote: elements.userNote.value,
        vaultMap: {
          folders: splitList(settings.folders),
          notes: [],
          tags: ["video", "youtube", "learning"]
        }
      })
    });

    const capture = await captureResponse.json();
    if (!captureResponse.ok) throw new Error(capture.error || "Capture failed.");

    await writeCaptureToObsidian(capture, settings, state.video, state.screenshots);
    state.start = null;
    state.screenshots = [];
    elements.userNote.value = "";
    setMessage("Saved to Obsidian.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not save clip.");
  } finally {
    render(false);
  }
}

async function writeCaptureToObsidian(capture, settings, video, screenshots) {
  const attachmentFolder = "Attachments/youtube-obsync";
  const screenshotLinks = [];

  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const filename = `${slug(video.title)}-${Math.round(capture.range.start)}-${index + 1}.png`;
    const path = `${attachmentFolder}/${filename}`;
    await putVaultFile(settings, path, dataUrlToBlob(screenshot.dataUrl), "image/png");
    screenshotLinks.push(`![[${path}]]`);
  }

  for (const note of capture.notes) {
    const markdown = buildMarkdown(note, capture, video, screenshotLinks);
    const path = `${note.folder || "Inbox"}/${safeFilename(note.filename || note.title)}`;
    await putVaultFile(settings, path, markdown, "text/markdown");
  }
}

async function putVaultFile(settings, path, body, contentType) {
  const response = await fetch(`${settings.obsidianUrl.replace(/\/$/, "")}/vault/${encodeVaultPath(path)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.obsidianToken}`,
      "Content-Type": contentType
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Obsidian write failed: ${response.status}`);
  }
}

function buildMarkdown(note, capture, video, screenshotLinks) {
  const tags = note.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const backlinks = note.backlinks.map((link) => `[[${link}]]`).join(" ");
  const sourceTime = `${video.url}&t=${Math.floor(capture.range.start)}s`;

  return `---
source: ${video.url}
source_time: ${sourceTime}
range: ${formatTime(capture.range.start)}-${formatTime(capture.range.end)}
suggested_folder: ${note.folder}
tags: [${note.tags.map((tag) => tag.replace(/^#/, "")).join(", ")}]
---

# ${note.title}

${note.idea}

## Evidence

${note.evidence}

## Screenshots

${screenshotLinks.length ? screenshotLinks.join("\n") : "No screenshots captured."}

## Links

${backlinks}

## Tags

${tags}

## Context

${capture.summary}

## Transcript

${capture.transcriptMarkdown || "No transcript lines found for this range."}
`;
}

function render(disabled = false) {
  elements.videoTitle.textContent = state.video?.title || "Open a YouTube video";
  elements.range.textContent =
    state.start === null
      ? "No clip"
      : `${formatTime(state.start)} -> ${state.video ? formatTime(state.video.currentTime) : "..."}`;
  elements.screenshotCount.textContent = String(state.screenshots.length);
  elements.startBtn.disabled = disabled || !state.video;
  elements.screenshotBtn.disabled = disabled || !state.video;
  elements.saveBtn.disabled = disabled || !state.video || state.start === null;
}

function setMessage(message) {
  elements.message.textContent = message;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function encodeVaultPath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function safeFilename(value) {
  const filename = String(value || "obsync-note").endsWith(".md") ? value : `${value}.md`;
  return filename.replace(/[\\:*?"<>|]/g, "-");
}

function slug(value) {
  return String(value || "youtube")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
