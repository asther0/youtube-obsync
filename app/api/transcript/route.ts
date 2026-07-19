import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SearchApiTranscript = {
  text: string;
  start: number;
  duration?: number;
};

export async function POST(request: NextRequest) {
  const { videoUrl } = await request.json();
  const apiKey = process.env.SEARCHAPI_KEY;
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return NextResponse.json({ error: "Pega una URL válida de YouTube." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta SEARCHAPI_KEY en .env.local. Puedes pegar una transcripción manual mientras la habilitamos."
      },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      {
        error: data.error || "SearchAPI no pudo traer la transcripción.",
        availableLanguages: data.available_languages ?? []
      },
      { status: 400 }
    );
  }

  const transcripts = (data.transcripts ?? [])
    .map((segment: SearchApiTranscript) => ({
      text: segment.text,
      start: Number(segment.start) || 0,
      duration: Number(segment.duration) || 0
    }))
    .filter((segment: SearchApiTranscript) => segment.text);

  return NextResponse.json({
    videoId,
    transcripts,
    availableLanguages: data.available_languages ?? []
  });
}

function extractVideoId(input: string) {
  if (!input) return "";

  try {
    const url = new URL(input);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") || "";
    }
  } catch {
    return input.trim();
  }

  return input.trim();
}
