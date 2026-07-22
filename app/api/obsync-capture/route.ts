import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TranscriptSegment = {
  text: string;
  start: number;
  duration?: number;
};

type SearchApiTranscript = {
  text: string;
  start: number;
  duration?: number;
};

export async function OPTIONS() {
  return corsResponse(null);
}

export async function POST(request: NextRequest) {
  const { videoUrl, start, end, vaultMap, userNote } = await request.json();
  const rangeStart = Math.max(0, Number(start) || 0);
  const rangeEnd = Math.max(rangeStart + 1, Number(end) || rangeStart + 90);

  if (!videoUrl) {
    return corsResponse({ error: "Falta videoUrl." }, 400);
  }

  const transcriptResponse = await fetchTranscript(videoUrl);
  if ("error" in transcriptResponse) {
    return corsResponse(transcriptResponse, 400);
  }

  const notesResponse = await fetch(new URL("/api/obsync-notes", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoUrl,
      start: rangeStart,
      end: rangeEnd,
      transcripts: transcriptResponse.transcripts,
      vaultMap,
      userNote
    })
  });

  const notes = await notesResponse.json();
  if (!notesResponse.ok) {
    return corsResponse(notes, notesResponse.status);
  }

  return corsResponse({
    ...notes,
    range: {
      start: rangeStart,
      end: rangeEnd
    },
    transcriptMarkdown: buildTranscriptMarkdown(transcriptResponse.transcripts, rangeStart, rangeEnd)
  });
}

async function fetchTranscript(videoUrl: string): Promise<{ transcripts: TranscriptSegment[] } | { error: string }> {
  const apiKey = process.env.SEARCHAPI_KEY;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) return { error: "URL de YouTube inválida." };
  if (!apiKey) return { error: "Falta SEARCHAPI_KEY." };

  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", "youtube_transcripts");
  url.searchParams.set("video_id", videoId);
  url.searchParams.set("lang", "es");
  url.searchParams.set("only_available", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  const data = await response.json();

  if (!response.ok || data.error) {
    return { error: data.error || "No se pudo traer la transcripción." };
  }

  return {
    transcripts: (data.transcripts ?? [])
      .map((segment: SearchApiTranscript) => ({
        text: segment.text,
        start: Number(segment.start) || 0,
        duration: Number(segment.duration) || 0
      }))
      .filter((segment: TranscriptSegment) => segment.text)
  };
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

function extractVideoId(input: string) {
  if (!input) return "";

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || "";
  } catch {
    return input.trim();
  }

  return input.trim();
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function corsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
