"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TranscriptSegment = {
  text: string;
  start: number;
  duration?: number;
};

type GraphNode = {
  id: string;
  label: string;
  type: "tema" | "persona" | "setup" | "callback" | "contradiccion" | "escalada" | "remate" | "pregunta";
  timestamp: number;
  summary: string;
  evidence: string;
};

type GraphEdge = {
  from: string;
  to: string;
  type: "vuelve" | "contradice" | "escala" | "responde" | "reformula" | "prepara";
  label: string;
};

type ComedyGraph = {
  title: string;
  thesis: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeline: {
    timestamp: number;
    label: string;
    description: string;
    nodeIds: string[];
  }[];
  insights: string[];
};

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [manualTranscript, setManualTranscript] = useState("");
  const [graph, setGraph] = useState<ComedyGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeKey, setSelectedEdgeKey] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [seekOnNodeClick, setSeekOnNodeClick] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "analyzing" | "done" | "error">("idle");
  const [message, setMessage] = useState("Pega un video de YouTube para comenzar.");
  const playerRef = useRef<YouTubePlayer | null>(null);

  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? graph?.nodes[0];
  const selectedEdge = graph?.edges.find((edge) => edgeKey(edge) === selectedEdgeKey);
  const selectedTranscript = useMemo(() => {
    if (!selectedNode) return [];
    return transcript
      .filter((segment) => Math.abs(segment.start - selectedNode.timestamp) < 35)
      .slice(0, 4);
  }, [selectedNode, transcript]);

  async function fetchTranscript() {
    setStatus("loading");
    setMessage("Buscando transcripción en YouTube...");

    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo traer la transcripción");

      setTranscript(data.transcripts);
      setManualTranscript("");
      setGraph(null);
      setSelectedNodeId("");
      setSelectedEdgeKey("");
      setStatus("idle");
      setMessage(`Transcripción cargada: ${data.transcripts.length} segmentos.`);
      return data.transcripts as TranscriptSegment[];
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo traer la transcripción.");
      return null;
    }
  }

  async function analyzeGraph() {
    if (!videoUrl.trim() && !manualTranscript.trim()) {
      setStatus("error");
      setMessage("Pega una URL de YouTube o una transcripción manual.");
      return;
    }

    let sourceTranscript = manualTranscript.trim()
      ? manualTranscript
          .split(/\n+/)
          .filter(Boolean)
          .map((text, index) => ({ text, start: index * 15, duration: 15 }))
      : transcript;

    if (sourceTranscript.length === 0 && !manualTranscript.trim()) {
      const fetchedTranscript = await fetchTranscript();
      if (!fetchedTranscript) return;
      sourceTranscript = fetchedTranscript;
    }

    if (sourceTranscript.length === 0) {
      setStatus("error");
      setMessage("Necesito una transcripción para analizar.");
      return;
    }

    setStatus("analyzing");
    setMessage(`Transcripción lista (${sourceTranscript.length} segmentos). Generando grafo...`);

    try {
      const response = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          transcripts: sourceTranscript
        })
      });

      const rawData = await response.json();
      if (!response.ok) throw new Error(rawData.error || "No se pudo analizar el video");
      const data = normalizeGraph(rawData as ComedyGraph);

      setTranscript(sourceTranscript);
      setGraph(data);
      setSelectedNodeId(data.nodes[0]?.id ?? "");
      setSelectedEdgeKey("");
      setStatus("done");
      setCurrentTime(0);
      setMessage("Grafo generado. Reproduce el video para ver aparecer conexiones.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? `La transcripción cargó, pero falló el grafo: ${error.message}`
          : "La transcripción cargó, pero no se pudo generar el grafo."
      );
    }
  }

  function exportMarkdown() {
    if (!graph) {
      setMessage("Genera un grafo antes de exportar.");
      return;
    }
    const markdown = buildObsidianMarkdown(graph);
    navigator.clipboard?.writeText(markdown);
    setMessage("Markdown estilo Obsidian copiado al portapapeles.");
  }

  return (
    <main className="app-shell">
      <section className="top-panel">
        <div className="brand">
          <h1>Comedy Graph</h1>
        </div>

        <div className="url-bar">
          <label className="url-input">
            <input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") analyzeGraph();
              }}
              placeholder="Pega un link de YouTube..."
            />
          </label>
          <div className="button-row">
            <button className="primary" onClick={analyzeGraph} disabled={status === "loading" || status === "analyzing"}>
              {status === "loading" ? "Transcribiendo..." : status === "analyzing" ? "Analizando..." : "Generar grafo"}
            </button>
            <button className="ghost" onClick={exportMarkdown}>
              Exportar
            </button>
          </div>
          <p className={`status status-${status}`}>{message}</p>
        </div>

        <details className="manual-box">
          <summary>Transcripción manual</summary>
          <label>
            <textarea
              value={manualTranscript}
              onChange={(event) => setManualTranscript(event.target.value)}
              placeholder="Pega aquí una transcripción si no hay SearchAPI key todavía. Cada línea será tratada como un bloque del timeline."
            />
          </label>
        </details>
      </section>

      <section className="video-transcript-layout">
        <VideoPanel videoUrl={videoUrl} onTimeChange={setCurrentTime} onPlayerReady={(player) => (playerRef.current = player)} />
        <section className="graph-card">
          {graph ? (
            <>
              <div className="panel-title">
                <div>
                  <span>{graph.title}</span>
                  <p>{graph.thesis}</p>
                </div>
                <strong>{formatTime(currentTime)}</strong>
              </div>
              <ComedyGraphView
                graph={graph}
                selectedNodeId={selectedNodeId}
                selectedEdgeKey={selectedEdgeKey}
                currentTime={currentTime}
                seekOnNodeClick={seekOnNodeClick}
                onSeekModeChange={setSeekOnNodeClick}
                onNodeSelect={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setSelectedEdgeKey("");
                  const node = graph.nodes.find((item) => item.id === nodeId);
                  if (node && seekOnNodeClick) {
                    playerRef.current?.seekTo?.(node.timestamp, true);
                    setCurrentTime(node.timestamp);
                  }
                }}
                onEdgeSelect={(edge) => {
                  setSelectedEdgeKey(edgeKey(edge));
                  setSelectedNodeId("");
                }}
                onClearSelection={() => {
                  setSelectedNodeId("");
                  setSelectedEdgeKey("");
                }}
              />
            </>
          ) : (
            <section className="empty-graph">
              <span>Sin grafo todavía</span>
              <p>Genera el grafo y reproduce el video para ver aparecer conexiones.</p>
            </section>
          )}
        </section>
      </section>

      {graph ? (
        <section className="detail-strip">
          {selectedEdge ? (
            <ConnectionDetail graph={graph} edge={selectedEdge} />
          ) : selectedNode ? (
            <div className="node-card compact">
              <span className={`node-type pill-${selectedNode.type}`}>{selectedNode.type}</span>
              <strong>{selectedNode.label}</strong>
              <p>{selectedNode.summary}</p>
            </div>
          ) : null}
          <TranscriptPanel transcript={transcript} videoUrl={videoUrl} currentTime={currentTime} />
        </section>
      ) : (
        <TranscriptPanel transcript={transcript} videoUrl={videoUrl} currentTime={currentTime} />
      )}
    </main>
  );
}

function ConnectionDetail({ graph, edge }: { graph: ComedyGraph; edge: GraphEdge }) {
  const from = graph.nodes.find((node) => node.id === edge.from);
  const to = graph.nodes.find((node) => node.id === edge.to);

  return (
    <div className="node-card compact connection-detail">
      <span className="node-type connection-type">{edge.type}</span>
      <strong>
        {from?.label ?? edge.from} → {to?.label ?? edge.to}
      </strong>
      <p>{edge.label}</p>
    </div>
  );
}

function VideoPanel({
  videoUrl,
  onTimeChange,
  onPlayerReady
}: {
  videoUrl: string;
  onTimeChange: (seconds: number) => void;
  onPlayerReady: (player: YouTubePlayer) => void;
}) {
  const videoId = extractVideoId(videoUrl);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return;

    let intervalId = 0;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !playerHostRef.current || !window.YT?.Player) return;
      playerHostRef.current.innerHTML = "";
      const mount = document.createElement("div");
      playerHostRef.current.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(50);
            onPlayerReady(event.target);
            onTimeChange(0);
          },
          onStateChange: () => {
            window.clearInterval(intervalId);
            intervalId = window.setInterval(() => {
              const seconds = playerRef.current?.getCurrentTime?.() ?? 0;
              onTimeChange(seconds);
            }, 350);
          }
        }
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [onTimeChange, videoId]);

  return (
    <section className="video-card">
      {videoId ? (
        <div ref={playerHostRef} className="youtube-player" />
      ) : (
        <div className="video-empty">El video aparecerá aquí</div>
      )}
    </section>
  );
}

function TranscriptPanel({
  transcript,
  videoUrl,
  currentTime
}: {
  transcript: TranscriptSegment[];
  videoUrl: string;
  currentTime: number;
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentTime]);

  return (
    <section className="full-transcript">
      <div className="panel-title">
        <span>Transcripción completa</span>
        <strong>{formatTime(currentTime)}</strong>
      </div>
      <div className="transcript-scroll">
        {transcript.length === 0 ? (
          <p className="empty-copy">Carga un transcript para ver todo el texto del video.</p>
        ) : (
          transcript.map((segment) => (
            <a
              key={`${segment.start}-${segment.text}`}
              ref={isTranscriptActive(segment, currentTime) ? activeRef : null}
              className={isTranscriptActive(segment, currentTime) ? "active" : ""}
              href={youtubeTimestamp(videoUrl, segment.start)}
              target="_blank"
              rel="noreferrer"
            >
              <time>{formatTime(segment.start)}</time>
              <span>{segment.text}</span>
            </a>
          ))
        )}
      </div>
    </section>
  );
}

function isTranscriptActive(segment: TranscriptSegment, currentTime: number) {
  const end = segment.start + (segment.duration || 4);
  return currentTime >= segment.start && currentTime <= end;
}

function extractVideoId(input: string) {
  if (!input) return "";

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || "";
  } catch {
    return "";
  }

  return "";
}

function ComedyGraphView({
  graph,
  selectedNodeId,
  selectedEdgeKey,
  currentTime,
  seekOnNodeClick,
  onSeekModeChange,
  onNodeSelect,
  onEdgeSelect,
  onClearSelection
}: {
  graph: ComedyGraph;
  selectedNodeId: string;
  selectedEdgeKey: string;
  currentTime: number;
  seekOnNodeClick: boolean;
  onSeekModeChange: (enabled: boolean) => void;
  onNodeSelect: (nodeId: string) => void;
  onEdgeSelect: (edge: GraphEdge) => void;
  onClearSelection: () => void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState("");
  const [autoFocusNodeId, setAutoFocusNodeId] = useState("");
  const previousVisibleNodeIdsRef = useRef<Set<string>>(new Set());
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState("");
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(0.82);
  const [camera, setCamera] = useState({ x: 2450, y: 1700 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const velocitiesRef = useRef<Record<string, { x: number; y: number }>>({});
  const panPointerIdRef = useRef<number | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasWidth = 6400;
  const canvasHeight = 4400;
  const baseViewWidth = 1600;
  const baseViewHeight = 1000;
  const viewWidth = baseViewWidth / zoom;
  const viewHeight = baseViewHeight / zoom;
  const maxViewX = Math.max(0, canvasWidth - viewWidth);
  const maxViewY = Math.max(0, canvasHeight - viewHeight);
  const viewX = Math.min(maxViewX, Math.max(0, camera.x));
  const viewY = Math.min(maxViewY, Math.max(0, camera.y));

  useEffect(() => {
    setPositions(
      Object.fromEntries(
        positionNodes(graph.nodes, canvasWidth, canvasHeight).map((node) => [
          node.id,
          {
            x: node.x,
            y: node.y
          }
        ])
      )
    );
    velocitiesRef.current = {};
    setCamera({
      x: (canvasWidth - viewWidth) / 2,
      y: (canvasHeight - viewHeight) / 2
    });
  }, [graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventPageZoom = (event: WheelEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener("wheel", preventPageZoom, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", preventPageZoom);
    };
  }, []);

  const visibleNodeIds = useMemo(
    () => new Set(graph.nodes.filter((node) => node.timestamp <= currentTime + 1.5).map((node) => node.id)),
    [currentTime, graph.nodes]
  );

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const dt = Math.min(32, time - lastTime) / 16.67;
      lastTime = time;

      if (!panning) {
        setPositions((current) => {
          const next = { ...current };
          const visibleNodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id) && current[node.id]);
          const velocities = velocitiesRef.current;

          for (const node of visibleNodes) {
            velocities[node.id] ||= { x: 0, y: 0 };
          }

          for (let i = 0; i < visibleNodes.length; i += 1) {
            for (let j = i + 1; j < visibleNodes.length; j += 1) {
              const a = visibleNodes[i];
              const b = visibleNodes[j];
              const pa = current[a.id];
              const pb = current[b.id];
              const dx = pa.x - pb.x;
              const dy = pa.y - pb.y;
              const distSq = Math.max(1200, dx * dx + dy * dy);
              const dist = Math.sqrt(distSq);
              const force = Math.min(1.8, 5200 / distSq) * dt;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (a.id !== draggingNodeId) {
                velocities[a.id].x += fx;
                velocities[a.id].y += fy;
              }
              if (b.id !== draggingNodeId) {
                velocities[b.id].x -= fx;
                velocities[b.id].y -= fy;
              }
            }
          }

          for (const edge of graph.edges) {
            if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) continue;
            const from = current[edge.from];
            const to = current[edge.to];
            if (!from || !to) continue;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const target = 190;
            const force = (dist - target) * 0.0008 * dt;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            velocities[edge.from] ||= { x: 0, y: 0 };
            velocities[edge.to] ||= { x: 0, y: 0 };

            if (edge.from !== draggingNodeId) {
              velocities[edge.from].x += fx;
              velocities[edge.from].y += fy;
            }
            if (edge.to !== draggingNodeId) {
              velocities[edge.to].x -= fx;
              velocities[edge.to].y -= fy;
            }
          }

          for (const node of visibleNodes) {
            if (node.id === draggingNodeId) continue;
            const position = current[node.id];
            const velocity = velocities[node.id];
            const floatX = Math.sin(time / 1400 + node.timestamp * 0.03) * 0.018 * dt;
            const floatY = Math.cos(time / 1600 + node.timestamp * 0.02) * 0.018 * dt;

            velocity.x = (velocity.x + floatX) * 0.86;
            velocity.y = (velocity.y + floatY) * 0.86;

            next[node.id] = {
              x: Math.min(canvasWidth - 70, Math.max(70, position.x + velocity.x * dt)),
              y: Math.min(canvasHeight - 60, Math.max(60, position.y + velocity.y * dt))
            };
          }

          return next;
        });
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [canvasHeight, canvasWidth, draggingNodeId, graph.edges, graph.nodes, panning, visibleNodeIds]);

  useEffect(() => {
    const previous = previousVisibleNodeIdsRef.current;
    const newlyVisible = graph.nodes
      .filter((node) => visibleNodeIds.has(node.id) && !previous.has(node.id))
      .sort((a, b) => b.timestamp - a.timestamp);

    previousVisibleNodeIdsRef.current = new Set(visibleNodeIds);

    if (newlyVisible.length === 0 || hoveredNodeId || draggingNodeId) return;

    setAutoFocusNodeId(newlyVisible[0].id);
    const timeoutId = window.setTimeout(() => {
      setAutoFocusNodeId((current) => (current === newlyVisible[0].id ? "" : current));
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [currentTime, draggingNodeId, graph.nodes, hoveredNodeId, visibleNodeIds]);

  const positionedNodes = graph.nodes
    .map((node) => ({
      ...node,
      ...(positions[node.id] ?? { x: 450, y: 280 })
    }))
    .filter((node) => visibleNodeIds.has(node.id));
  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  const selectedNodePosition = selectedNode ? positions[selectedNode.id] : null;
  const selectedNodeScreenX = selectedNodePosition ? ((selectedNodePosition.x - viewX) / viewWidth) * 100 : 0;
  const selectedNodeScreenY = selectedNodePosition ? ((selectedNodePosition.y - viewY) / viewHeight) * 100 : 0;
  const activeNodeId = hoveredNodeId || autoFocusNodeId || selectedNodeId;
  const relatedIds = new Set(
    graph.edges
      .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
      .filter((edge) => edge.from === activeNodeId || edge.to === activeNodeId)
      .flatMap((edge) => [edge.from, edge.to])
  );
  if (activeNodeId) relatedIds.add(activeNodeId);

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: viewX + ((event.clientX - rect.left) / rect.width) * viewWidth,
      y: viewY + ((event.clientY - rect.top) / rect.height) * viewHeight
    };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (draggingNodeId) {
      const point = pointFromEvent(event);
      setPositions((current) => ({
        ...current,
        [draggingNodeId]: {
          x: Math.min(canvasWidth - 70, Math.max(70, point.x)),
          y: Math.min(canvasHeight - 60, Math.max(60, point.y))
        }
      }));
      return;
    }

    if (panning) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((event.clientX - panning.x) / rect.width) * viewWidth;
      const dy = ((event.clientY - panning.y) / rect.height) * viewHeight;
      setCamera((current) => ({
        x: Math.min(maxViewX, Math.max(0, current.x - dx)),
        y: Math.min(maxViewY, Math.max(0, current.y - dy))
      }));
      setPanning({ x: event.clientX, y: event.clientY });
    }
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerRatioX = (event.clientX - rect.left) / rect.width;
    const pointerRatioY = (event.clientY - rect.top) / rect.height;
    const pointerCanvasX = viewX + pointerRatioX * viewWidth;
    const pointerCanvasY = viewY + pointerRatioY * viewHeight;
    const delta = Math.max(-90, Math.min(90, event.deltaY));
    const nextZoom = Math.min(1.9, Math.max(0.46, zoom * Math.exp(-delta * 0.0018)));
    const nextViewWidth = baseViewWidth / nextZoom;
    const nextViewHeight = baseViewHeight / nextZoom;

    setZoom(nextZoom);
    setCamera({
      x: Math.min(Math.max(0, canvasWidth - nextViewWidth), Math.max(0, pointerCanvasX - pointerRatioX * nextViewWidth)),
      y: Math.min(Math.max(0, canvasHeight - nextViewHeight), Math.max(0, pointerCanvasY - pointerRatioY * nextViewHeight))
    });
  }

  return (
    <div className="graph-canvas" ref={canvasRef}>
      <div className="graph-toolbar">
        <button
          className={!seekOnNodeClick ? "tool-chip active" : "tool-chip"}
          onClick={() => onSeekModeChange(false)}
          type="button"
          title="Organizar nodos"
        >
          Organizar
        </button>
        <button
          className={seekOnNodeClick ? "tool-chip active" : "tool-chip"}
          onClick={() => onSeekModeChange(true)}
          type="button"
          title="Click en nodo salta al video"
        >
          Sync
        </button>
        <button
          type="button"
          className="zoom-chip"
          aria-label="Zoom out"
          onClick={() => setZoom((current) => Math.max(0.46, current - 0.12))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="zoom-chip"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => Math.min(1.9, current + 0.12))}
        >
          +
        </button>
      </div>
      <svg
        ref={svgRef}
        className={hoveredNodeId ? "obsidian-graph graph-hovering" : "obsidian-graph"}
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Grafo de ideas de comedia"
        onMouseLeave={() => setHoveredNodeId("")}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          if (panning && panStartRef.current) {
            const dx = Math.abs(panning.x - panStartRef.current.x);
            const dy = Math.abs(panning.y - panStartRef.current.y);
            if (!seekOnNodeClick && dx < 4 && dy < 4) {
              onClearSelection();
            }
          }
          setDraggingNodeId("");
          setPanning(null);
          panStartRef.current = null;
          if (panPointerIdRef.current !== null) {
            try {
              svgRef.current?.releasePointerCapture?.(panPointerIdRef.current);
            } catch {
            }
            panPointerIdRef.current = null;
          }
        }}
        onPointerCancel={() => {
          setDraggingNodeId("");
          setPanning(null);
          panStartRef.current = null;
          if (panPointerIdRef.current !== null) {
            try {
              svgRef.current?.releasePointerCapture?.(panPointerIdRef.current);
            } catch {
            }
            panPointerIdRef.current = null;
          }
        }}
        onWheel={handleWheel}
      >
      <defs>
        <pattern id="canvasGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(238, 242, 255, 0.055)" strokeWidth="1" />
        </pattern>
        <radialGradient id="canvasGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(139, 156, 255, 0.13)" />
          <stop offset="65%" stopColor="rgba(139, 156, 255, 0.035)" />
          <stop offset="100%" stopColor="rgba(139, 156, 255, 0)" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        className="graph-hit-area"
        x="0"
        y="0"
        width={canvasWidth}
        height={canvasHeight}
        onPointerDown={(event) => {
          event.preventDefault();
          svgRef.current?.setPointerCapture?.(event.pointerId);
          panPointerIdRef.current = event.pointerId;
          panStartRef.current = { x: event.clientX, y: event.clientY };
          setPanning({ x: event.clientX, y: event.clientY });
        }}
      />
      <rect className="graph-grid" x="0" y="0" width={canvasWidth} height={canvasHeight} />
      <rect className="graph-glow" x="0" y="0" width={canvasWidth} height={canvasHeight} />
      {graph.edges
        .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
        .map((edge, index) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) return null;
        const active = edge.from === activeNodeId || edge.to === activeNodeId;

        const selected = edgeKey(edge) === selectedEdgeKey;

        return (
          <g
            key={renderEdgeKey(edge, index)}
            className={`${active ? "graph-edge active" : "graph-edge"} ${selected ? "selected" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onEdgeSelect(edge);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onEdgeSelect(edge);
            }}
          >
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <rect
              x={(from.x + to.x) / 2 - Math.min(120, edge.label.length * 4.5)}
              y={(from.y + to.y) / 2 - 22}
              width={Math.min(240, edge.label.length * 9)}
              height="24"
              rx="6"
            />
            <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>
              {edge.label}
            </text>
          </g>
        );
      })}
      {positionedNodes.map((node) => (
        <g
          key={node.id}
          className={`idea-node node-${node.type} ${node.id === selectedNodeId ? "selected" : ""} ${
            node.id === autoFocusNodeId ? "auto-focus" : ""
          } ${
            hoveredNodeId && !relatedIds.has(node.id) ? "dimmed" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onNodeSelect(node.id);
          }}
          onMouseEnter={() => setHoveredNodeId(node.id)}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDraggingNodeId(node.id);
            onNodeSelect(node.id);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onNodeSelect(node.id);
          }}
        >
          <circle cx={node.x} cy={node.y} r={node.id === selectedNodeId ? 44 : 34} />
          <text x={node.x} y={node.y + 5}>
            {node.label}
          </text>
        </g>
      ))}
      </svg>
      {selectedNode && selectedNodePosition ? (
        <aside
          className="canvas-note"
          style={{
            left: `${Math.min(68, Math.max(6, selectedNodeScreenX))}%`,
            top: `${Math.min(62, Math.max(10, selectedNodeScreenY))}%`
          }}
        >
          <span className={`node-type pill-${selectedNode.type}`}>{selectedNode.type}</span>
          <strong>{selectedNode.label}</strong>
          <p>{selectedNode.summary}</p>
          <blockquote>{selectedNode.evidence}</blockquote>
          <small>{formatTime(selectedNode.timestamp)}</small>
        </aside>
      ) : null}
    </div>
  );
}

function positionNodes(nodes: GraphNode[], canvasWidth = 1400, canvasHeight = 900) {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const density = Math.min(1, Math.max(0.45, nodes.length / 32));
  const radiusX = Math.min(1550, canvasWidth * 0.34) * density;
  const radiusY = Math.min(980, canvasHeight * 0.3) * density;

  return nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const ring = index % 3 === 0 ? 0.58 : index % 3 === 1 ? 0.82 : 1;
    const pull = (node.type === "callback" || node.type === "remate" ? 0.78 : 1) * ring;

    return {
      ...node,
      x: centerX + Math.cos(angle) * radiusX * pull,
      y: centerY + Math.sin(angle) * radiusY * pull
    };
  });
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

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function youtubeTimestamp(url: string, seconds: number) {
  if (!url || !url.includes("youtube")) return "#";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Math.floor(seconds)}s`;
}

function buildObsidianMarkdown(graph: ComedyGraph) {
  const nodeNotes = graph.nodes
    .map(
      (node) => `## [[${node.label}]]

Tipo: ${node.type}
Timestamp: ${formatTime(node.timestamp)}

${node.summary}

> ${node.evidence}
`
    )
    .join("\n");

  const connections = graph.edges
    .map((edge) => {
      const from = graph.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
      const to = graph.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
      return `- [[${from}]] ${edge.label} [[${to}]]`;
    })
    .join("\n");

  return `# ${graph.title}

${graph.thesis}

## Conexiones

${connections}

${nodeNotes}
`;
}

function clipLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) return label;
  const clipped = label.slice(0, maxLength - 1);
  return `${clipped.slice(0, clipped.lastIndexOf(" ") > 8 ? clipped.lastIndexOf(" ") : clipped.length)}…`;
}

function normalizeGraph(graph: ComedyGraph): ComedyGraph {
  const seenNodes = new Set<string>();
  const nodes = graph.nodes.filter((node) => {
    if (!node.id || seenNodes.has(node.id)) return false;
    seenNodes.add(node.id);
    return true;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenEdges = new Set<string>();
  const edges = graph.edges.filter((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return false;
    const key = `${edge.from}->${edge.to}:${edge.type}:${edge.label}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });

  return {
    ...graph,
    nodes,
    edges,
    timeline: graph.timeline.map((event) => ({
      ...event,
      nodeIds: event.nodeIds.filter((nodeId) => nodeIds.has(nodeId))
    }))
  };
}

function edgeKey(edge: GraphEdge, index = 0) {
  return `${edge.from}->${edge.to}:${edge.type}:${edge.label}`;
}

function renderEdgeKey(edge: GraphEdge, index: number) {
  return `${edgeKey(edge)}:${index}`;
}

type YouTubePlayer = {
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

declare global {
  interface Window {
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
