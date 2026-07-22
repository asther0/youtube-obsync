const state = {
  tab: null,
  video: null,
  start: null,
  screenshots: [],
  lastCapture: null
};

const DEFAULT_SETTINGS = {
  backendUrl: "http://localhost:4177",
  obsidianUrl: "https://127.0.0.1:27124",
  obsidianToken: "",
  folders: "Inbox, Learning, Ideas, Frameworks, Examples",
  selectedFolder: "Inbox"
};

const elements = {
  connection: document.querySelector("#connection"),
  videoTitle: document.querySelector("#videoTitle"),
  range: document.querySelector("#range"),
  folderSelect: document.querySelector("#folderSelect"),
  userNote: document.querySelector("#userNote"),
  clipBtn: document.querySelector("#clipBtn"),
  screenshotBtn: document.querySelector("#screenshotBtn"),
  screenshotCount: document.querySelector("#screenshotCount"),
  screenshotStrip: document.querySelector("#screenshotStrip"),
  transcriptPreview: document.querySelector("#transcriptPreview"),
  transcriptRange: document.querySelector("#transcriptRange"),
  captureSummary: document.querySelector("#captureSummary"),
  transcriptText: document.querySelector("#transcriptText"),
  settingsToggle: document.querySelector("#settingsToggle"),
  settingsPanel: document.querySelector("#settingsPanel"),
  testConnectionBtn: document.querySelector("#testConnectionBtn"),
  connectionDetail: document.querySelector("#connectionDetail"),
  backendUrl: document.querySelector("#backendUrl"),
  obsidianUrl: document.querySelector("#obsidianUrl"),
  obsidianToken: document.querySelector("#obsidianToken"),
  folders: document.querySelector("#folders"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  message: document.querySelector("#message")
};

init().catch((error) => {
  setMessage(error instanceof Error ? error.message : "No pude iniciar Obsync.");
  render();
});

async function init() {
  await loadSettings();
  await refreshVideo();
  render();

  elements.clipBtn.addEventListener("click", toggleClip);
  elements.screenshotBtn.addEventListener("click", takeScreenshot);
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
  elements.testConnectionBtn.addEventListener("click", testConnection);
  elements.folderSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ selectedFolder: elements.folderSelect.value });
  });
  elements.settingsToggle.addEventListener("click", () => {
    elements.settingsPanel.hidden = !elements.settingsPanel.hidden;
    elements.settingsToggle.setAttribute("aria-expanded", String(!elements.settingsPanel.hidden));
  });

  window.setInterval(async () => {
    try {
      await refreshVideo({ silent: true });
      render();
    } catch {
    }
  }, 1200);
}

async function loadSettings() {
  const settings = await getSettings();

  elements.backendUrl.value = settings.backendUrl;
  elements.obsidianUrl.value = settings.obsidianUrl;
  elements.obsidianToken.value = settings.obsidianToken;
  elements.folders.value = settings.folders;
  renderFolders(splitList(settings.folders), settings.selectedFolder);
  elements.connection.textContent = settings.obsidianToken ? "Obsidian listo" : "Falta token";
}

async function saveSettings() {
  await chrome.storage.sync.set({
    backendUrl: elements.backendUrl.value.trim(),
    obsidianUrl: elements.obsidianUrl.value.trim(),
    folders: elements.folders.value.trim(),
    selectedFolder: elements.folderSelect.value
  });
  await chrome.storage.local.set({
    obsidianToken: normalizeToken(elements.obsidianToken.value)
  });
  setMessage("Conexión guardada.");
  await loadSettings();
  await testConnection({ silent: true });
}

async function testConnection(options = {}) {
  const settings = await getSettings();
  if (!settings.obsidianToken) {
    elements.connection.textContent = "Falta token";
    elements.connectionDetail.textContent = "Pega el token local";
    return false;
  }

  const candidates = unique([
    settings.obsidianUrl || "https://127.0.0.1:27124",
    "https://127.0.0.1:27124",
    "https://127.0.0.1:27123",
    "http://127.0.0.1:27123",
    "http://127.0.0.1:27124",
    "https://localhost:27124",
    "https://localhost:27123",
    "http://localhost:27123",
    "http://localhost:27124"
  ]);

  for (const url of candidates) {
    try {
      const response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/obsync-vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          obsidianUrl: url,
          obsidianToken: settings.obsidianToken
        })
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        await chrome.storage.sync.set({ obsidianUrl: url });
        elements.obsidianUrl.value = url;
        elements.connection.textContent = "Obsidian listo";
        elements.connectionDetail.textContent = `Conectado en ${url}`;
        if (!options.silent) setMessage("Obsidian conectado.", "saved");
        return true;
      }
    } catch {
    }
  }

  elements.connection.textContent = "Sin conexión";
  elements.connectionDetail.textContent = "Revisa plugin, puerto o token";
  if (!options.silent) setMessage("No pude llegar a Obsidian. Déjalo abierto y pega el token sin Bearer.");
  return false;
}

function renderFolders(folders, selectedFolder) {
  elements.folderSelect.innerHTML = "";
  for (const folder of folders.length ? folders : ["Inbox"]) {
    const option = document.createElement("option");
    option.value = folder;
    option.textContent = folder;
    option.selected = folder === selectedFolder;
    elements.folderSelect.append(option);
  }
}

async function getSettings() {
  const preferences = await chrome.storage.sync.get({
    backendUrl: DEFAULT_SETTINGS.backendUrl,
    obsidianUrl: DEFAULT_SETTINGS.obsidianUrl,
    folders: DEFAULT_SETTINGS.folders,
    selectedFolder: DEFAULT_SETTINGS.selectedFolder,
    obsidianToken: ""
  });
  const secrets = await chrome.storage.local.get({
    obsidianToken: DEFAULT_SETTINGS.obsidianToken
  });
  const migratedToken = normalizeToken(secrets.obsidianToken || preferences.obsidianToken);

  if (!secrets.obsidianToken && preferences.obsidianToken) {
    await chrome.storage.local.set({ obsidianToken: migratedToken });
    await chrome.storage.sync.remove("obsidianToken");
  }

  return {
    ...DEFAULT_SETTINGS,
    ...preferences,
    obsidianToken: migratedToken
  };
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
}

async function refreshVideo(options = {}) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_YOUTUBE_STATE" });
  } catch (error) {
    state.video = null;
    if (!options.silent) setMessage(error instanceof Error ? error.message : "No pude leer el video.");
    return;
  }

  state.tab = response?.tab ?? null;

  if (!response?.ok || !response.video) {
    state.video = null;
    if (!options.silent) setMessage(response?.error || "Abre un video de YouTube.");
    return;
  }

  state.video = response.video;
}

async function startClip() {
  await refreshVideo();
  if (!state.video) return;

  state.start = state.video.currentTime;
  setMessage(`Extracto iniciado en ${formatTime(state.start)}.`);
  render();
}

async function toggleClip() {
  if (state.start === null) {
    await startClip();
    return;
  }
  await saveClip();
}

async function takeScreenshot() {
  await refreshVideo({ silent: true });
  if (!state.tab?.windowId) {
    setMessage("Abre un video de YouTube primero.");
    return;
  }

  try {
    await appendScreenshot();
    setMessage("Imagen añadida.");
    render();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No pude capturar la imagen.");
  }
}

async function appendFinalScreenshot(end) {
  const alreadyCapturedFinalFrame = state.screenshots.some((screenshot) => Math.abs(screenshot.timestamp - end) <= 1);
  if (alreadyCapturedFinalFrame) return;

  try {
    await appendScreenshot(end);
  } catch {
    // The note should still be saved when Chrome blocks visible-tab capture.
  }
}

async function appendScreenshot(timestampOverride) {
  if (!state.tab?.windowId) throw new Error("No hay pestaña activa para capturar.");

  const response = await chrome.runtime.sendMessage({
    type: "CAPTURE_VISIBLE_TAB",
    windowId: state.tab.windowId
  });
  if (!response?.ok) {
    throw new Error(response?.error || "No pude capturar la pestaña visible.");
  }

  state.screenshots.push({
    dataUrl: response.dataUrl,
    timestamp: timestampOverride ?? state.video?.currentTime ?? 0
  });
}

async function saveClip() {
  await refreshVideo();
  if (!state.video || state.start === null) {
    setMessage("Marca el inicio del recorte primero.");
    return;
  }

  const settings = await getSettings();
  const selectedFolder = elements.folderSelect.value || "Inbox";
  if (!settings.obsidianToken) {
    setMessage("Agrega tu token de Obsidian en Conectar.");
    elements.settingsPanel.hidden = false;
    return;
  }

  const connected = await testConnection({ silent: true });
  if (!connected) {
    setMessage("Obsidian no responde. Abre Conectar y pruébalo.");
    elements.settingsPanel.hidden = false;
    return;
  }

  const end = Math.max(state.start + 1, state.video.currentTime);
  await appendFinalScreenshot(end);
  setMessage("Leyendo transcripción y guardando...");
  render(true);

  try {
    const freshSettings = await getSettings();
    const capture = await generateCapture(freshSettings, selectedFolder, end);

    await chrome.storage.sync.set({ selectedFolder });
    await writeCaptureToObsidian(capture, freshSettings, state.video, state.screenshots, selectedFolder);
    state.lastCapture = {
      range: capture.range,
      summary: capture.summary,
      transcriptMarkdown: capture.transcriptMarkdown
    };
    state.start = null;
    elements.userNote.value = "";
    setMessage(`Extracto guardado en ${selectedFolder}.`, "saved");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No pude guardar el recorte.");
  } finally {
    render(false);
  }
}

async function generateCapture(settings, selectedFolder, end) {
  let captureResponse;
  try {
    captureResponse = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/obsync-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: state.video.url,
        start: state.start,
        end,
        userNote: elements.userNote.value,
        vaultMap: {
          folders: [selectedFolder, ...splitList(settings.folders).filter((folder) => folder !== selectedFolder)],
          notes: [],
          tags: ["video", "youtube", "learning"]
        }
      })
    });
  } catch {
    throw new Error("No pude leer la transcripción. Revisa que el backend esté corriendo en 4177.");
  }

  const capture = await captureResponse.json();
  if (!captureResponse.ok) {
    throw new Error(capture.error || "No pude generar el extracto.");
  }
  return capture;
}

async function writeCaptureToObsidian(capture, settings, video, screenshots, selectedFolder) {
  const attachmentFolder = "Attachments/youtube-obsync";
  const screenshotLinks = [];

  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const filename = `${slug(video.title)}-${Math.round(capture.range.start)}-${index + 1}.png`;
    const path = `${attachmentFolder}/${filename}`;
    await putVaultFile(settings, path, dataUrlToBase64(screenshot.dataUrl), "image/png", "base64");
    screenshotLinks.push(`![[${path}]]`);
  }

  for (const note of capture.notes) {
    const destinationFolder = safeFolder(selectedFolder || note.folder || "Inbox");
    const markdown = buildMarkdown(note, capture, video, screenshotLinks, destinationFolder);
    const path = `${destinationFolder}/${safeFilename(note.filename || note.title)}`;
    await putVaultFile(settings, path, markdown, "text/markdown", "text");
  }
}

async function putVaultFile(settings, path, body, contentType, encoding) {
  let response;
  let data;
  try {
    response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/obsync-vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "put",
        obsidianUrl: settings.obsidianUrl,
        obsidianToken: settings.obsidianToken,
        path,
        contentType,
        body,
        encoding
      })
    });
    data = await response.json();
  } catch {
    throw new Error("El backend no responde. Corre bun run dev -- -p 4177.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "No pude escribir en Obsidian.");
  }
}

function buildMarkdown(note, capture, video, screenshotLinks, destinationFolder) {
  const tags = note.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const backlinks = note.backlinks.map((link) => `[[${link}]]`).join(" ");
  const sourceTime = `${video.url}&t=${Math.floor(capture.range.start)}s`;

  return `---
source: ${video.url}
source_time: ${sourceTime}
range: ${formatTime(capture.range.start)}-${formatTime(capture.range.end)}
folder: ${destinationFolder}
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
  elements.videoTitle.textContent = state.video?.title || "Abre un video de YouTube";
  elements.range.textContent =
    state.start === null
      ? "Sin recorte"
      : `${formatTime(state.start)} -> ${state.video ? formatTime(state.video.currentTime) : "..."}`;
  elements.screenshotCount.textContent = String(state.screenshots.length);
  elements.clipBtn.textContent = state.start === null ? "Iniciar extracto" : "Cerrar y guardar";
  elements.clipBtn.disabled = disabled || !state.video;
  elements.screenshotBtn.disabled = disabled || !state.video;
  elements.screenshotStrip.innerHTML = "";
  for (const screenshot of state.screenshots) {
    const image = document.createElement("img");
    image.src = screenshot.dataUrl;
    image.alt = `Captura en ${formatTime(screenshot.timestamp)}`;
    elements.screenshotStrip.append(image);
  }

  if (state.lastCapture) {
    elements.transcriptPreview.hidden = false;
    elements.transcriptRange.textContent = `${formatTime(state.lastCapture.range.start)} -> ${formatTime(
      state.lastCapture.range.end
    )}`;
    elements.captureSummary.textContent = state.lastCapture.summary;
    elements.transcriptText.textContent = state.lastCapture.transcriptMarkdown || "Sin líneas de transcripción para este rango.";
  } else {
    elements.transcriptPreview.hidden = true;
  }
}

function setMessage(message, className = "") {
  elements.message.textContent = message;
  elements.message.className = className;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.split(",")[1] || "";
}

function safeFilename(value) {
  const withoutExtension = String(value || "obsync-note").replace(/\.md$/i, "");
  return `${safePathSegment(withoutExtension) || "obsync-note"}.md`;
}

function safeFolder(value) {
  const segments = String(value || "Inbox")
    .split("/")
    .map(safePathSegment)
    .filter(Boolean);
  return segments.length ? segments.join("/") : "Inbox";
}

function safePathSegment(value) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\.+/g, ".")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  return cleaned.slice(0, 80);
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
