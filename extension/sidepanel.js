const state = {
  tab: null,
  page: null,
  video: null,
  start: null,
  screenshots: [],
  lastCapture: null,
  noteStatus: "pendiente"
};

const OLD_DEFAULT_FOLDERS = "Inbox, Learning, Ideas, Frameworks, Examples";

const DEFAULT_SETTINGS = {
  backendUrl: "http://localhost:4177",
  obsidianUrl: "https://127.0.0.1:27124",
  obsidianToken: "",
  folders: "20 inbox, 10 second-brain/ideas, 10 second-brain/patterns, 30 projects, 90 archive",
  selectedFolder: "20 inbox"
};

const elements = {
  connection: document.querySelector("#connection"),
  videoTitle: document.querySelector("#videoTitle"),
  range: document.querySelector("#range"),
  folderSelect: document.querySelector("#folderSelect"),
  userNote: document.querySelector("#userNote"),
  noteBtn: document.querySelector("#noteBtn"),
  clipBtn: document.querySelector("#clipBtn"),
  screenshotBtn: document.querySelector("#screenshotBtn"),
  statusPills: Array.from(document.querySelectorAll(".status-pill")),
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

  elements.noteBtn.addEventListener("click", savePageNote);
  elements.clipBtn.addEventListener("click", toggleClip);
  elements.screenshotBtn.addEventListener("click", takeScreenshot);
  for (const pill of elements.statusPills) {
    pill.addEventListener("click", () => {
      state.noteStatus = pill.dataset.status || "pendiente";
      render();
    });
  }
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

  const migratedFolders =
    preferences.folders === OLD_DEFAULT_FOLDERS ? DEFAULT_SETTINGS.folders : preferences.folders;
  const migratedSelectedFolder =
    preferences.selectedFolder === "Inbox" ? DEFAULT_SETTINGS.selectedFolder : preferences.selectedFolder;

  if (migratedFolders !== preferences.folders || migratedSelectedFolder !== preferences.selectedFolder) {
    await chrome.storage.sync.set({
      folders: migratedFolders,
      selectedFolder: migratedSelectedFolder
    });
  }

  return {
    ...DEFAULT_SETTINGS,
    ...preferences,
    folders: migratedFolders,
    selectedFolder: migratedSelectedFolder,
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
    response = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_PAGE_STATE" });
  } catch (error) {
    state.page = null;
    state.video = null;
    if (!options.silent) setMessage(error instanceof Error ? error.message : "No pude leer la página.");
    return;
  }

  state.tab = response?.tab ?? null;
  state.page = response?.page ?? null;

  if (!response?.ok) {
    state.page = null;
    state.video = null;
    if (!options.silent) setMessage(response?.error || "Abre una página web.");
    return;
  }

  state.video = response.video ?? null;
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
    setMessage("Abre una página web primero.");
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

async function savePageNote() {
  await refreshVideo({ silent: true });
  if (!state.page || !state.tab) {
    setMessage("Abre una página web para guardar un apunte.");
    return;
  }

  const settings = await getSettings();
  const selectedFolder = elements.folderSelect.value || "Inbox";
  if (!settings.obsidianToken) {
    setMessage("Agrega tu token de Obsidian en Conectar.");
    openSettings();
    return;
  }

  const connected = await testConnection({ silent: true });
  if (!connected) {
    setMessage("Obsidian no responde. Abre Conectar y pruébalo.");
    openSettings();
    return;
  }

  setMessage("Guardando apunte...");
  render(true);

  try {
    await chrome.storage.sync.set({ selectedFolder });
    await writePageNoteToObsidian(settings, state.page, state.screenshots, selectedFolder);
    state.lastCapture = {
      range: null,
      summary: `Apunte ${state.noteStatus} guardado desde ${state.page.title}.`,
      transcriptMarkdown: elements.userNote.value.trim() || "Apunte guardado sin texto adicional."
    };
    elements.userNote.value = "";
    setMessage(`Apunte guardado en ${selectedFolder}.`, "saved");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No pude guardar el apunte.");
  } finally {
    render(false);
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
    openSettings();
    return;
  }

  const connected = await testConnection({ silent: true });
  if (!connected) {
    setMessage("Obsidian no responde. Abre Conectar y pruébalo.");
    openSettings();
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
  const capturedAt = new Date();

  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const filename = `${slug(video.title)}-${Math.round(capture.range.start)}-${index + 1}.png`;
    const path = `${attachmentFolder}/${filename}`;
    await putVaultFile(settings, path, dataUrlToBase64(screenshot.dataUrl), "image/png", "base64");
    screenshotLinks.push(`![[${path}]]`);
  }

  for (const note of capture.notes) {
    const destinationFolder = captureFolder(selectedFolder || note.folder || DEFAULT_SETTINGS.selectedFolder, capturedAt);
    const markdown = buildMarkdown(note, capture, video, screenshotLinks, destinationFolder, capturedAt);
    const path = `${destinationFolder}/${datedFilename(note.filename || note.title, capturedAt)}`;
    await putVaultFile(settings, path, markdown, "text/markdown", "text");
  }
}

async function writePageNoteToObsidian(settings, page, screenshots, selectedFolder) {
  const capturedAt = new Date();
  const destinationFolder = captureFolder(selectedFolder || DEFAULT_SETTINGS.selectedFolder, capturedAt);
  const attachmentFolder = "Attachments/obsync";
  const screenshotLinks = [];
  const noteSlug = slug(page.title);

  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const filename = `${noteSlug}-${capturedAt.getTime()}-${index + 1}.png`;
    const path = `${attachmentFolder}/${filename}`;
    await putVaultFile(settings, path, dataUrlToBase64(screenshot.dataUrl), "image/png", "base64");
    screenshotLinks.push(`![[${path}]]`);
  }

  const path = `${destinationFolder}/${datedFilename(noteSlug || "web-note", capturedAt)}`;
  const markdown = buildPageMarkdown(page, screenshotLinks, destinationFolder, capturedAt);
  await putVaultFile(settings, path, markdown, "text/markdown", "text");
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

function buildPageMarkdown(page, screenshotLinks, destinationFolder, capturedAt) {
  const note = elements.userNote.value.trim();
  const sourceType = sourceTypeForUrl(page.url);
  const review = reviewSchedule(state.noteStatus, capturedAt);

  return `---
obsync_id: ${obsyncId(capturedAt)}
obsync_kind: web_note
type: capture
source_type: ${sourceType}
source_title: ${yamlString(page.title)}
source: ${yamlString(page.url)}
captured_at: ${capturedAt.toISOString()}
status: ${state.noteStatus}
review_after: ${review.reviewAfter}
review_interval_days: ${review.intervalDays}
folder: ${yamlString(destinationFolder)}
tags: [obsync, capture, ${sourceType}, ${state.noteStatus}]
---

# ${page.title}

> [!source]
> ${page.url}

## Apunte

${note || "Apunte pendiente de completar."}

## Evidencia

${screenshotLinks.length ? screenshotLinks.join("\n") : "Sin capturas."}

## Fuente

${page.url}

## Revisión

- Estado: \`${state.noteStatus}\`
- Próxima revisión: \`${review.reviewAfter}\`
- [ ] Decidir si se queda como apunte, se convierte en idea, patrón o se archiva.

## Conexiones sugeridas

- [[20 inbox/Pendings]]
- [[10 second-brain/ideas]]
- [[10 second-brain/patterns]]
`;
}

function buildMarkdown(note, capture, video, screenshotLinks, destinationFolder, capturedAt) {
  const tags = note.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const backlinks = note.backlinks.map((link) => `[[${link}]]`).join(" ");
  const sourceTime = `${video.url}&t=${Math.floor(capture.range.start)}s`;
  const review = reviewSchedule(state.noteStatus, capturedAt);

  return `---
obsync_id: ${obsyncId(capturedAt)}
obsync_kind: video_extract
type: capture
source_type: youtube
source_title: ${yamlString(video.title)}
source: ${yamlString(video.url)}
source_time: ${yamlString(sourceTime)}
range: ${formatTime(capture.range.start)}-${formatTime(capture.range.end)}
captured_at: ${capturedAt.toISOString()}
status: ${state.noteStatus}
review_after: ${review.reviewAfter}
review_interval_days: ${review.intervalDays}
folder: ${yamlString(destinationFolder)}
suggested_folder: ${yamlString(note.folder)}
tags: [obsync, capture, youtube, ${state.noteStatus}, ${note.tags.map((tag) => tag.replace(/^#/, "")).join(", ")}]
---

# ${note.title}

> [!source]
> ${sourceTime}

## Apunte

${note.idea}

## Evidencia

${note.evidence}

## Capturas

${screenshotLinks.length ? screenshotLinks.join("\n") : "Sin capturas."}

## Conexiones

${backlinks}

## Tags

${tags}

## Contexto

${capture.summary}

## Transcripción

${capture.transcriptMarkdown || "Sin líneas de transcripción para este rango."}

## Revisión

- Estado: \`${state.noteStatus}\`
- Próxima revisión: \`${review.reviewAfter}\`
- [ ] Decidir si se queda como apunte, se convierte en idea, patrón o se archiva.
`;
}

function openSettings() {
  elements.settingsPanel.hidden = false;
  elements.settingsToggle.setAttribute("aria-expanded", "true");
}

function render(disabled = false) {
  elements.videoTitle.textContent = state.page?.title || state.video?.title || "Abre una página o video";
  elements.range.textContent = state.start === null ? sourceKindLabel() : `${formatTime(state.start)} -> ${state.video ? formatTime(state.video.currentTime) : "..."}`;
  elements.screenshotCount.textContent = String(state.screenshots.length);
  elements.clipBtn.textContent = state.start === null ? "Iniciar extracto" : "Cerrar y guardar";
  elements.noteBtn.disabled = disabled || !state.page;
  elements.screenshotBtn.disabled = disabled || !state.tab;
  elements.clipBtn.disabled = disabled || !state.video;
  for (const pill of elements.statusPills) {
    pill.classList.toggle("active", pill.dataset.status === state.noteStatus);
  }
  elements.screenshotStrip.innerHTML = "";
  for (const screenshot of state.screenshots) {
    const image = document.createElement("img");
    image.src = screenshot.dataUrl;
    image.alt = `Captura en ${formatTime(screenshot.timestamp)}`;
    elements.screenshotStrip.append(image);
  }

  if (state.lastCapture) {
    elements.transcriptPreview.hidden = false;
    elements.transcriptRange.textContent = state.lastCapture.range
      ? `${formatTime(state.lastCapture.range.start)} -> ${formatTime(state.lastCapture.range.end)}`
      : state.noteStatus;
    elements.captureSummary.textContent = state.lastCapture.summary;
    elements.transcriptText.textContent = state.lastCapture.transcriptMarkdown || "Sin líneas de transcripción para este rango.";
  } else {
    elements.transcriptPreview.hidden = true;
  }
}

function sourceKindLabel() {
  if (state.video) return "Video listo";
  if (state.page) return "Apunte web";
  return "Sin fuente";
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

function captureFolder(baseFolder, date) {
  return `${safeFolder(baseFolder || DEFAULT_SETTINGS.selectedFolder)}/obsync/${monthKey(date)}`;
}

function datedFilename(value, date) {
  const datePrefix = isoDate(date);
  const base = String(value || "obsync-note").replace(/\.md$/i, "");
  return safeFilename(`${datePrefix}-${base}`);
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

function sourceTypeForUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("linkedin.com")) return "linkedin";
    if (hostname.includes("github.com")) return "github";
    return "web";
  } catch {
    return "web";
  }
}

function reviewSchedule(status, date) {
  const intervalDays = status === "revisado" ? 14 : 2;
  const reviewDate = new Date(date.getTime());
  reviewDate.setDate(reviewDate.getDate() + intervalDays);
  return {
    intervalDays,
    reviewAfter: isoDate(reviewDate)
  };
}

function obsyncId(date) {
  return `obsync-${date.getTime()}`;
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
