import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rangeTitle", "summary", "notes", "links"],
  properties: {
    rangeTitle: { type: "string", maxLength: 90 },
    summary: { type: "string", maxLength: 320 },
    notes: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "folder", "idea", "evidence", "tags", "backlinks", "filename"],
        properties: {
          title: { type: "string", maxLength: 80 },
          folder: { type: "string", maxLength: 120 },
          idea: { type: "string", maxLength: 420 },
          evidence: { type: "string", maxLength: 240 },
          tags: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string", maxLength: 32 }
          },
          backlinks: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string", maxLength: 80 }
          },
          filename: { type: "string", maxLength: 96 }
        }
      }
    },
    links: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label"],
        properties: {
          from: { type: "string", maxLength: 80 },
          to: { type: "string", maxLength: 80 },
          label: { type: "string", maxLength: 40 }
        }
      }
    }
  }
};

const fallback = {
  rangeTitle: "Aprendizaje del video",
  summary: "Este rango contiene ideas que pueden convertirse en notas atómicas conectadas con tu vault.",
  notes: [
    {
      title: "Idea principal del clip",
      folder: "Inbox",
      idea: "Convierte este bloque en una nota pequeña y reutilizable, no en un resumen largo.",
      evidence: "Bloque seleccionado del video.",
      tags: ["video", "aprendizaje"],
      backlinks: ["Aprendizaje"],
      filename: "idea-principal-del-clip.md"
    },
    {
      title: "Pregunta pendiente",
      folder: "Inbox",
      idea: "Una buena nota debe dejar clara la pregunta que abre para futuras conexiones.",
      evidence: "Bloque seleccionado del video.",
      tags: ["preguntas"],
      backlinks: ["Aprendizaje"],
      filename: "pregunta-pendiente.md"
    }
  ],
  links: [{ from: "Idea principal del clip", to: "Pregunta pendiente", label: "abre" }]
};

export async function POST(request: NextRequest) {
  const { videoUrl, start, end, transcripts, vaultMap } = (await request.json()) as {
    videoUrl?: string;
    start?: number;
    end?: number;
    transcripts?: TranscriptSegment[];
    vaultMap?: VaultMap;
  };
  const apiKey = process.env.OPENAI_API_KEY;

  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    return NextResponse.json({ error: "No hay transcripción para analizar." }, { status: 400 });
  }

  const rangeStart = Math.max(0, Number(start) || 0);
  const rangeEnd = Math.max(rangeStart + 1, Number(end) || rangeStart + 180);
  const selectedTranscript = transcripts
    .filter((segment) => {
      const segmentStart = Number(segment.start) || 0;
      const segmentEnd = segmentStart + (segment.duration ?? 0);
      return segmentEnd >= rangeStart && segmentStart <= rangeEnd;
    })
    .map((segment) => `[${formatTime(segment.start)}] ${segment.text}`)
    .join("\n")
    .slice(0, 14000);

  if (!selectedTranscript.trim()) {
    return NextResponse.json({ error: "El rango seleccionado no contiene transcripción." }, { status: 400 });
  }

  if (!apiKey) return NextResponse.json(fallback);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Eres un asistente de conocimiento personal para Obsidian. Convierte rangos de video en notas atomicas utiles, conectadas y verificables. Tu trabajo no es resumir: es decidir que conocimiento vale guardar, donde deberia vivir en el vault y con que notas existentes deberia conectarse. Extrae conceptos reutilizables, practicas, preguntas, frameworks, ejemplos, decisiones, recomendaciones y errores evitables. Usa espanol claro."
        },
        {
          role: "user",
          content: JSON.stringify({
            videoUrl,
            range: { start: rangeStart, end: rangeEnd },
            vaultMap: {
              folders: vaultMap?.folders?.slice(0, 80) ?? [],
              notes: vaultMap?.notes?.slice(0, 160) ?? [],
              tags: vaultMap?.tags?.slice(0, 80) ?? []
            },
            instruction:
              "Genera notas atomicas para Obsidian. Cada nota debe guardar una sola idea, no un resumen del clip. Sugiere folder usando las carpetas reales del vaultMap cuando encajen; si ninguna encaja, usa Inbox. Usa backlinks a notas existentes del vaultMap cuando sean relevantes, y crea nuevos backlinks solo si ayudan a que el conocimiento quede conectado. Evidence debe ser breve y basada en el rango, no una cita larga. Filename debe ser seguro para archivo markdown. Prioriza que el usuario pueda encontrar esta nota despues por tema, practica, framework o pregunta.",
            transcript: selectedTranscript
          })
        }
      ],
      max_output_tokens: 5000,
      text: {
        format: {
          type: "json_schema",
          name: "obsync_notes",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) return NextResponse.json(fallback);

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text ?? "")
      ?.join("");

  if (!text) return NextResponse.json(fallback);

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(fallback);
  }
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
