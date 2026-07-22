const state = {
  tab: null,
  page: null,
  video: null,
  start: null,
  screenshots: [],
  cropDraft: null,
  cropRect: null,
  cropDrag: null,
  lastCapture: null,
  noteStatus: "pendiente",
  connectionStatus: "missing",
  titleTouched: false
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
  connectionDot: document.querySelector("#connectionDot"),
  videoTitle: document.querySelector("#videoTitle"),
  range: document.querySelector("#range"),
  noteTitle: document.querySelector("#noteTitle"),
  folderSelect: document.querySelector("#folderSelect"),
  userNote: document.querySelector("#userNote"),
  noteBtn: document.querySelector("#noteBtn"),
  clipBtn: document.querySelector("#clipBtn"),
  screenshotBtn: document.querySelector("#screenshotBtn"),
  statusPills: Array.from(document.querySelectorAll(".status-pill")),
  screenshotCount: document.querySelector("#screenshotCount"),
  screenshotStrip: document.querySelector("#screenshotStrip"),
  cropPanel: document.querySelector("#cropPanel"),
  cropStage: document.querySelector("#cropStage"),
  cropImage: document.querySelector("#cropImage"),
  cropSelection: document.querySelector("#cropSelection"),
  cropUseBtn: document.querySelector("#cropUseBtn"),
  cropCancelBtn: document.querySelector("#cropCancelBtn"),
  cropHint: document.querySelector("#cropHint"),
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
  elements.cropCancelBtn.addEventListener("click", closeCropper);
  elements.cropUseBtn.addEventListener("click", useCrop);
  elements.cropStage.addEventListener("pointerdown", startCropDrag);
  window.addEventListener("pointermove", moveCropDrag);
  window.addEventListener("pointerup", endCropDrag);
  elements.cropImage.addEventListener("load", seedDefaultCrop);
  elements.noteTitle.addEventListener("input", () => {
    state.titleTouched = true;
  });
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
  const settings = await getSettings();
  if (settings.obsidianToken) testConnection({ silent: true });

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
  setConnectionState(settings.obsidianToken ? "unknown" : "missing");
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
  setMessage("Configuración guardada.");
  await loadSettings();
  await testConnection({ silent: true });
}

async function testConnection(options = {}) {
  const settings = await getSettings();
  if (!settings.obsidianToken) {
    setConnectionState("missing");
    elements.connectionDetail.textContent = "Pega el token local";
    return false;
  }

  setConnectionState("testing");
  elements.connectionDetail.textContent = "Probando conexión...";

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
        setConnectionState("connected");
        elements.connectionDetail.textContent = `Conectado en ${url}`;
        if (!options.silent) setMessage("Obsidian conectado.", "saved");
        return true;
      }
    } catch {
    }
  }

  setConnectionState("error");
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
    setMessage("Selecciona el área en la página.");
    const region = await selectScreenRegion();
    if (!region) {
      setMessage("Recorte cancelado.");
      return;
    }

    const dataUrl = await captureVisibleDataUrl();
    const cropped = await cropImageDataUrlByViewportRect(dataUrl, region);
    addScreenshot(cropped, state.video?.currentTime ?? 0);
    setMessage("Recorte añadido.");
    render();
  } catch (error) {
    try {
      const dataUrl = await captureVisibleDataUrl();
      openCropper(dataUrl, state.video?.currentTime ?? 0);
      setMessage("Selecciona el área en el panel.");
      render();
    } catch {
      setMessage(error instanceof Error ? error.message : "No pude capturar la imagen.");
    }
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
    state.lastCapture = null;
    state.titleTouched = false;
    elements.noteTitle.value = "";
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
  const dataUrl = await captureVisibleDataUrl();
  addScreenshot(dataUrl, timestampOverride ?? state.video?.currentTime ?? 0);
}

async function captureVisibleDataUrl() {
  if (!state.tab?.windowId) throw new Error("No hay pestaña activa para capturar.");

  const response = await chrome.runtime.sendMessage({
    type: "CAPTURE_VISIBLE_TAB",
    windowId: state.tab.windowId
  });
  if (!response?.ok) {
    throw new Error(response?.error || "No pude capturar la pestaña visible.");
  }

  return response.dataUrl;
}

async function selectScreenRegion() {
  const response = await chrome.runtime.sendMessage({ type: "SELECT_SCREEN_REGION" });
  if (!response?.ok) {
    throw new Error(response?.error || "No pude abrir el recorte en la página.");
  }
  return response.region;
}

function addScreenshot(dataUrl, timestamp) {
  state.screenshots.push({
    dataUrl,
    timestamp
  });
}

function openCropper(dataUrl, timestamp) {
  state.cropDraft = { dataUrl, timestamp };
  state.cropRect = null;
  state.cropDrag = null;
  elements.cropImage.src = dataUrl;
  elements.cropPanel.hidden = false;
  elements.cropUseBtn.disabled = true;
  elements.cropSelection.hidden = true;
  elements.cropHint.textContent = "Arrastra sobre la imagen.";
}

function closeCropper() {
  state.cropDraft = null;
  state.cropRect = null;
  state.cropDrag = null;
  elements.cropImage.removeAttribute("src");
  elements.cropPanel.hidden = true;
  elements.cropSelection.hidden = true;
  elements.cropUseBtn.disabled = true;
}

function seedDefaultCrop() {
  if (!state.cropDraft) return;
  const imageBox = elements.cropImage.getBoundingClientRect();
  if (!imageBox.width || !imageBox.height) return;
  const width = imageBox.width * 0.72;
  const height = imageBox.height * 0.58;
  state.cropRect = {
    x: (imageBox.width - width) / 2,
    y: (imageBox.height - height) / 2,
    width,
    height
  };
  drawCropSelection();
}

function startCropDrag(event) {
  if (!state.cropDraft) return;
  event.preventDefault();
  const point = cropPoint(event);
  state.cropDrag = { startX: point.x, startY: point.y };
  state.cropRect = { x: point.x, y: point.y, width: 0, height: 0 };
  drawCropSelection();
}

function moveCropDrag(event) {
  if (!state.cropDrag) return;
  const point = cropPoint(event);
  const x = Math.min(state.cropDrag.startX, point.x);
  const y = Math.min(state.cropDrag.startY, point.y);
  state.cropRect = {
    x,
    y,
    width: Math.abs(point.x - state.cropDrag.startX),
    height: Math.abs(point.y - state.cropDrag.startY)
  };
  drawCropSelection();
}

function endCropDrag() {
  if (!state.cropDrag) return;
  state.cropDrag = null;
  drawCropSelection();
}

function cropPoint(event) {
  const imageBox = elements.cropImage.getBoundingClientRect();
  return {
    x: clamp(event.clientX - imageBox.left, 0, imageBox.width),
    y: clamp(event.clientY - imageBox.top, 0, imageBox.height)
  };
}

function drawCropSelection() {
  const rect = normalizedCropRect();
  if (!rect) {
    elements.cropSelection.hidden = true;
    elements.cropUseBtn.disabled = true;
    return;
  }

  elements.cropSelection.hidden = false;
  elements.cropSelection.style.left = `${rect.x}px`;
  elements.cropSelection.style.top = `${rect.y}px`;
  elements.cropSelection.style.width = `${rect.width}px`;
  elements.cropSelection.style.height = `${rect.height}px`;
  elements.cropUseBtn.disabled = false;
  elements.cropHint.textContent = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
}

function normalizedCropRect() {
  if (!state.cropRect) return null;
  const width = Math.abs(state.cropRect.width);
  const height = Math.abs(state.cropRect.height);
  if (width < 12 || height < 12) return null;
  return {
    x: state.cropRect.x,
    y: state.cropRect.y,
    width,
    height
  };
}

async function useCrop() {
  const rect = normalizedCropRect();
  if (!state.cropDraft || !rect) return;

  try {
    const cropped = await cropImageDataUrl(state.cropDraft.dataUrl, rect);
    addScreenshot(cropped, state.cropDraft.timestamp);
    closeCropper();
    setMessage("Recorte añadido.");
    render();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No pude recortar la imagen.");
  }
}

async function cropImageDataUrl(dataUrl, displayRect) {
  const image = await loadImage(dataUrl);
  const imageBox = elements.cropImage.getBoundingClientRect();
  const scaleX = image.naturalWidth / imageBox.width;
  const scaleY = image.naturalHeight / imageBox.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(displayRect.width * scaleX));
  canvas.height = Math.max(1, Math.round(displayRect.height * scaleY));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pude preparar el recorte.");

  context.drawImage(
    image,
    Math.round(displayRect.x * scaleX),
    Math.round(displayRect.y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL("image/png");
}

async function cropImageDataUrlByViewportRect(dataUrl, region) {
  const image = await loadImage(dataUrl);
  const scaleX = image.naturalWidth / region.viewportWidth;
  const scaleY = image.naturalHeight / region.viewportHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scaleX));
  canvas.height = Math.max(1, Math.round(region.height * scaleY));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No pude preparar el recorte.");

  context.drawImage(
    image,
    Math.round(region.x * scaleX),
    Math.round(region.y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("La captura no se pudo cargar."));
    image.src = dataUrl;
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
      kind: "video_extract",
      range: capture.range,
      summary: capture.summary,
      transcriptMarkdown: capture.transcriptMarkdown
    };
    state.start = null;
    state.titleTouched = false;
    elements.noteTitle.value = "";
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
    const path = `${destinationFolder}/${datedFilename(currentNoteTitle(note.title), capturedAt)}`;
    await putVaultFile(settings, path, markdown, "text/markdown", "text");
  }
}

async function writePageNoteToObsidian(settings, page, screenshots, selectedFolder) {
  const capturedAt = new Date();
  const destinationFolder = captureFolder(selectedFolder || DEFAULT_SETTINGS.selectedFolder, capturedAt);
  const attachmentFolder = "Attachments/obsync";
  const screenshotLinks = [];
  const noteSlug = slug(currentNoteTitle(page.title));

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
  const title = currentNoteTitle(page.title);
  const description = elements.userNote.value.trim();
  const sourceType = sourceTypeForUrl(page.url);
  const review = reviewSchedule(state.noteStatus, capturedAt);

  return `---
obsync_id: ${obsyncId(capturedAt)}
obsync_kind: web_note
type: capture
source_type: ${sourceType}
source_title: ${yamlString(page.title)}
title: ${yamlString(title)}
source: ${yamlString(page.url)}
captured_at: ${capturedAt.toISOString()}
status: ${state.noteStatus}
review_after: ${review.reviewAfter}
review_interval_days: ${review.intervalDays}
folder: ${yamlString(destinationFolder)}
tags: [obsync, capture, ${sourceType}, ${state.noteStatus}]
---

# ${title}

> [!source]
> ${page.url}

## Descripción

${description || "Pendiente de describir."}

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
  const title = currentNoteTitle(note.title);
  const description = elements.userNote.value.trim();
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
title: ${yamlString(title)}
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

# ${title}

> [!source]
> ${sourceTime}

## Apunte

${note.idea}

## Descripción

${description || "Sin descripción manual."}

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
  if (!state.titleTouched) {
    elements.noteTitle.value = defaultNoteTitle();
  }
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

  if (state.lastCapture?.kind === "video_extract" && state.lastCapture.range) {
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

function defaultNoteTitle() {
  if (state.video) return prettyTitle(state.video.title, state.video.url);
  if (state.page) return prettyTitle(state.page.title, state.page.url);
  return "";
}

function currentNoteTitle(fallback) {
  return elements.noteTitle.value.trim() || String(fallback || "Apunte").trim() || "Apunte";
}

function prettyTitle(title, url) {
  const rawTitle = cleanTitle(title);
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return rawTitle;
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, "");
  if (hostname === "github.com") {
    const [owner, repo] = parsedUrl.pathname.split("/").filter(Boolean);
    if (owner && repo) return `${startCase(repo)} - ${owner}`;
  }

  if (hostname.includes("linkedin.com")) {
    return `LinkedIn - ${rawTitle || isoDate(new Date())}`;
  }

  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return rawTitle.replace(/\s+-\s+YouTube$/i, "");
  }

  if (!rawTitle) return hostname;
  return rawTitle.includes(hostname) ? rawTitle : `${rawTitle} - ${hostname}`;
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\s+-\s+GitHub$/i, "")
    .replace(/^GitHub\s+-\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function startCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setMessage(message, className = "") {
  elements.message.textContent = message;
  elements.message.className = className;
}

function setConnectionState(status) {
  state.connectionStatus = status;
  const labels = {
    connected: "Conectado",
    testing: "Probando",
    unknown: "Sin probar",
    missing: "Falta token",
    error: "Sin conexión"
  };

  elements.connection.textContent = labels[status] || labels.error;
  elements.connectionDot.className = `connection-dot ${status}`;
  elements.connectionDot.parentElement?.setAttribute("title", `Obsidian: ${elements.connection.textContent}`);
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
