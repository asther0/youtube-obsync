"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TranscriptSegment = {
  text: string;
  start: number;
  duration?: number;
};

type VaultMap = {
  folders: string[];
  notes: string[];
  tags: string[];
};

type AtomicNote = {
  title: string;
  folder: string;
  idea: string;
  evidence: string;
  tags: string[];
  backlinks: string[];
  filename: string;
};

type ObsyncResult = {
  rangeTitle: string;
  summary: string;
  notes: AtomicNote[];
  links: {
    from: string;
    to: string;
    label: string;
  }[];
};

type FileSystemDirectoryHandle = {
  name: string;
  kind: "directory";
  values?: () => AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
};

type FileSystemFileHandle = {
  name: string;
  kind: "file";
  createWritable: () => Promise<{ write: (content: string) => Promise<void>; close: () => Promise<void> }>;
};

type YouTubePlayer = {
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: () => void;
          };
        }
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function ObsyncPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [vaultMap, setVaultMap] = useState<VaultMap>({
    folders: ["Inbox", "Learning", "Ideas", "Frameworks", "Examples"],
    notes: ["Aprendizaje", "Productividad", "Preguntas abiertas"],
    tags: ["video", "aprendizaje", "idea"]
  });
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(180);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMarking, setIsMarking] = useState(false);
  const [result, setResult] = useState<ObsyncResult | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "analyzing" | "syncing" | "done" | "error">("idle");
  const [message, setMessage] = useState("Pega un video y conecta tu vault para empezar.");

  const duration = useMemo(() => {
    return transcript.reduce((latest, segment) => Math.max(latest, segment.start + (segment.duration ?? 0)), 0);
  }, [transcript]);
  const selectedNote = result?.notes.find((note) => note.title === selectedTitle) ?? result?.notes[0];
  const hasVideo = Boolean(extractVideoId(videoUrl));
  const canCapture = hasVideo && status !== "loading" && status !== "analyzing" && status !== "syncing";

  async function loadTranscript() {
    if (!videoUrl.trim()) {
      setStatus("error");
      setMessage("Pega una URL de YouTube.");
      return null;
    }

    setStatus("loading");
    setMessage("Leyendo transcripción del video...");

    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo traer la transcripción.");

      setTranscript(data.transcripts);
      const last = data.transcripts.reduce(
        (latest: number, segment: TranscriptSegment) => Math.max(latest, segment.start + (segment.duration ?? 0)),
        0
      );
      setStart(0);
      setEnd(Math.min(180, Math.round(last)));
      setStatus("idle");
      setMessage(`Transcripción cargada: ${data.transcripts.length} segmentos.`);
      return data.transcripts as TranscriptSegment[];
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo traer la transcripción.");
      return null;
    }
  }

  async function connectVault() {
    if (!window.showDirectoryPicker) {
      setStatus("error");
      setMessage("Tu navegador no soporta sync local. Usa Chrome o Edge desktop.");
      return;
    }

    const handle = await window.showDirectoryPicker();
    setVaultHandle(handle);
    setStatus("loading");
    setMessage(`Leyendo estructura de ${handle.name}...`);

    const map = await scanVault(handle);
    setVaultMap(map);
    setStatus("idle");
    setMessage(`Vault conectado: ${handle.name}. ${map.notes.length} notas detectadas.`);
  }

  async function generateNotes() {
    let sourceTranscript = transcript;
    if (sourceTranscript.length === 0) {
      const loaded = await loadTranscript();
      if (!loaded) return;
      sourceTranscript = loaded;
    }

    setStatus("analyzing");
    setMessage("Generando notas atómicas y conexiones...");

    try {
      const response = await fetch("/api/obsync-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, start, end, transcripts: sourceTranscript, vaultMap })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo generar notas.");

      setResult(data);
      setSelectedTitle(data.notes?.[0]?.title ?? "");
      setStatus("done");
      setMessage("Notas listas para revisar y sincronizar.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo generar notas.");
    }
  }

  async function captureClip(range = { start, end }) {
    let sourceTranscript = transcript;
    if (sourceTranscript.length === 0) {
      const loaded = await loadTranscript();
      if (!loaded) return;
      sourceTranscript = loaded;
    }

    setStatus("analyzing");
    setMessage("Capturando recorte...");

    try {
      const response = await fetch("/api/obsync-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, start: range.start, end: range.end, transcripts: sourceTranscript, vaultMap })
      });
      const data = (await response.json()) as ObsyncResult | { error?: string };
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "No se pudo capturar el recorte.");
      const notesResult = data as ObsyncResult;

      setResult(notesResult);
      setSelectedTitle(notesResult.notes?.[0]?.title ?? "");

      if (vaultHandle) {
        setStatus("syncing");
        setMessage("Guardando en Obsidian...");
        await writeNotesToVault(vaultHandle, notesResult, videoUrl, range.start, range.end, sourceTranscript);
        setStatus("done");
        setMessage(`Recorte guardado: ${notesResult.notes.length} notas en Obsidian.`);
      } else {
        setStatus("done");
        setMessage("Recorte listo. Conecta tu vault para guardarlo directo en Obsidian.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo capturar el recorte.");
    }
  }

  function startClip() {
    if (!canCapture) return;

    const mark = Math.max(0, Math.round(currentTime));
    setStart(mark);
    setEnd(mark);
    setIsMarking(true);
    setResult(null);
    setSelectedTitle("");
    setMessage(`Inicio marcado en ${formatTime(mark)}.`);
  }

  function finishClip() {
    if (!canCapture || !isMarking) return;

    const mark = Math.max(0, Math.round(currentTime));
    const nextRange =
      mark > start
        ? { start, end: mark }
        : {
            start: mark,
            end: Math.max(start, mark + 1)
          };
    setStart(nextRange.start);
    setEnd(nextRange.end);
    setIsMarking(false);
    void captureClip(nextRange);
  }

  async function syncToVault() {
    if (!vaultHandle || !result) {
      setStatus("error");
      setMessage("Conecta un vault y genera notas antes de sincronizar.");
      return;
    }

    setStatus("syncing");
    setMessage("Escribiendo Markdown en tu vault...");

    try {
      await writeNotesToVault(vaultHandle, result, videoUrl, start, end, transcript);
      setStatus("done");
      setMessage(`Sincronizadas ${result.notes.length} notas en Obsidian.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo escribir en el vault.");
    }
  }

  return (
    <main className="obsync-shell">
      <header className="obsync-top">
        <a href="/" className="route-link">
          Comedy Graph
        </a>
        <div>
          <h1>Obsync</h1>
          <p>Captura aprendizajes de YouTube directo en tu Obsidian.</p>
        </div>
      </header>

      <section className="obsync-command">
        <input
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
          placeholder="Pega un link de YouTube..."
        />
        <button onClick={connectVault} className="ghost">
          {vaultHandle ? vaultHandle.name : "Conectar vault"}
        </button>
        <p className={`status status-${status}`}>{message}</p>
      </section>

      <section className="obsync-grid">
        <section className="obsync-video">
          {hasVideo ? (
            <>
              <YouTubeCapturePlayer videoUrl={videoUrl} onTimeChange={setCurrentTime} />
              <div className={isMarking ? "clip-hud recording" : "clip-hud"}>
                <span>{isMarking ? "Marcando recorte" : "Listo para marcar"}</span>
                <strong>{isMarking ? `${formatTime(start)} -> ${formatTime(currentTime)}` : formatTime(currentTime)}</strong>
              </div>
            </>
          ) : (
            <div className="obsync-video-empty">Pega un video para comenzar</div>
          )}
        </section>

        <aside className="capture-panel">
          <div className="panel-title">
            <div>
              <span>Recorte</span>
              <p>Marca inicio y fin mientras ves el video.</p>
            </div>
            <strong>{formatTime(start)} - {formatTime(end)}</strong>
          </div>
          <div className={isMarking ? "clip-marker active" : "clip-marker"}>
            <div>
              <span>Inicio</span>
              <strong>{formatTime(start)}</strong>
            </div>
            <div>
              <span>{isMarking ? "Ahora" : "Fin"}</span>
              <strong>{formatTime(isMarking ? currentTime : end)}</strong>
            </div>
          </div>
          <div className="clip-progress">
            <span style={{ left: `${duration ? Math.min(100, (start / duration) * 100) : 0}%` }} />
            <span style={{ left: `${duration ? Math.min(100, ((isMarking ? currentTime : end) / duration) * 100) : 0}%` }} />
          </div>
          <div className="capture-actions">
            <button onClick={startClip} disabled={!canCapture || isMarking}>
              Iniciar recorte
            </button>
            <button onClick={finishClip} className="primary" disabled={!canCapture || !isMarking}>
              Guardar recorte
            </button>
          </div>
          <VaultMapPanel vaultMap={vaultMap} vaultName={vaultHandle?.name} />
        </aside>

        <section className="note-workbench">
          <section className="note-preview">
            {selectedNote ? (
              <>
                <div className="note-preview-head">
                  <span className="node-type pill-tema">{selectedNote.folder}</span>
                  <strong>{safeFilename(selectedNote.filename || selectedNote.title)}</strong>
                </div>
                <h2>{selectedNote.title}</h2>
                <p>{selectedNote.idea}</p>
                <blockquote>{selectedNote.evidence}</blockquote>
                <div className="note-links">
                  {selectedNote.backlinks.map((link) => (
                    <button key={link} type="button">
                      [[{link}]]
                    </button>
                  ))}
                </div>
                {result && result.notes.length > 1 ? (
                  <div className="compact-note-tabs">
                    {result.notes.map((note) => (
                      <button
                        key={note.title}
                        className={selectedNote.title === note.title ? "active" : ""}
                        onClick={() => setSelectedTitle(note.title)}
                        type="button"
                      >
                        {note.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <pre>{buildMarkdown(selectedNote, result, videoUrl, start, end, transcript)}</pre>
              </>
            ) : (
              <p className="empty-copy">Tu recorte aparecerá aquí después de capturarlo.</p>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function YouTubeCapturePlayer({ videoUrl, onTimeChange }: { videoUrl: string; onTimeChange: (time: number) => void }) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const videoId = extractVideoId(videoUrl);

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;
    let intervalId = 0;

    loadYouTubeApi().then(() => {
      if (!playerHostRef.current || !window.YT?.Player) return;
      playerRef.current?.destroy?.();
      playerRef.current = new window.YT.Player(playerHostRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(50);
            intervalId = window.setInterval(() => {
              onTimeChange(event.target.getCurrentTime());
            }, 300);
          }
        }
      });
    });

    return () => {
      window.clearInterval(intervalId);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [onTimeChange, videoId]);

  return <div className="youtube-player" ref={playerHostRef} />;
}

function VaultMapPanel({ vaultMap, vaultName }: { vaultMap: VaultMap; vaultName?: string }) {
  return (
    <div className="vault-map">
      <span>{vaultName ? `Vault: ${vaultName}` : "Vault map"}</span>
      <p>{vaultMap.folders.slice(0, 5).join(" / ")}</p>
      <p>{vaultMap.notes.slice(0, 6).map((note) => `[[${note}]]`).join(" ")}</p>
    </div>
  );
}

async function scanVault(root: FileSystemDirectoryHandle): Promise<VaultMap> {
  const folders = new Set<string>(["Inbox"]);
  const notes = new Set<string>();
  const tags = new Set<string>(["video", "aprendizaje"]);

  async function walk(dir: FileSystemDirectoryHandle, path = "", depth = 0) {
    if (!dir.values || depth > 2) return;

    for await (const entry of dir.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        folders.add(entryPath);
        await walk(entry, entryPath, depth + 1);
      }
      if (entry.kind === "file" && entry.name.endsWith(".md")) {
        notes.add(entry.name.replace(/\.md$/, ""));
      }
    }
  }

  await walk(root);

  return {
    folders: Array.from(folders).slice(0, 80),
    notes: Array.from(notes).slice(0, 160),
    tags: Array.from(tags)
  };
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[src='https://www.youtube.com/iframe_api']");
    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
  });
}

async function ensureFolder(root: FileSystemDirectoryHandle, path: string) {
  const parts = path.split("/").map((part) => part.trim()).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function writeNotesToVault(
  vaultHandle: FileSystemDirectoryHandle,
  result: ObsyncResult,
  videoUrl: string,
  start: number,
  end: number,
  transcript: TranscriptSegment[]
) {
  for (const note of result.notes) {
    const folder = await ensureFolder(vaultHandle, note.folder || "Inbox");
    const file = await folder.getFileHandle(safeFilename(note.filename || note.title), { create: true });
    const writable = await file.createWritable();
    await writable.write(buildMarkdown(note, result, videoUrl, start, end, transcript));
    await writable.close();
  }
}

function buildMarkdown(
  note: AtomicNote,
  result: ObsyncResult | null,
  videoUrl: string,
  start: number,
  end: number,
  transcript: TranscriptSegment[]
) {
  const tags = note.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const backlinks = note.backlinks.map((link) => `[[${link}]]`).join(" ");
  const sourceLink = youtubeTimestamp(videoUrl, start);
  const transcriptBlock = buildTranscriptMarkdown(transcript, start, end);

  return `---
source: ${videoUrl}
source_time: ${sourceLink}
range: ${formatTime(start)}-${formatTime(end)}
suggested_folder: ${note.folder}
tags: [${note.tags.map((tag) => tag.replace(/^#/, "")).join(", ")}]
---

# ${note.title}

${note.idea}

## Evidence

${note.evidence}

## Suggested folder

${note.folder}

## Links

${backlinks}

## Tags

${tags}

${result ? `## Context\n\n${result.summary}\n` : ""}
## Transcript

${transcriptBlock || "No transcript lines found for this range."}
`;
}

function buildTranscriptMarkdown(transcript: TranscriptSegment[], start: number, end: number) {
  return transcript
    .filter((segment) => {
      const segmentStart = Number(segment.start) || 0;
      const segmentEnd = segmentStart + (segment.duration ?? 0);
      return segmentEnd >= start && segmentStart <= end;
    })
    .map((segment) => `- [${formatTime(segment.start)}] ${segment.text}`)
    .join("\n");
}

function safeFilename(value: string) {
  const base = value
    .replace(/\.md$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${base || "obsync-note"}.md`;
}

function extractVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    return parsed.searchParams.get("v");
  } catch {
    return "";
  }
}

function youtubeTimestamp(url: string, seconds: number) {
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Math.floor(seconds)}s`;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
