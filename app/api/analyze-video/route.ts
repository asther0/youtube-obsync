import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TranscriptSegment = {
  text: string;
  start: number;
  duration?: number;
};

const fallbackGraph = {
  title: "Mapa demo de crowdwork",
  thesis: "La comedia aparece cuando una contradicción inicial se guarda como semilla y vuelve como callback.",
  nodes: [
    {
      id: "n1",
      label: "Contabilidad",
      type: "tema",
      timestamp: 0,
      summary: "Dato inicial de oficio.",
      evidence: "trabaja en contabilidad"
    },
    {
      id: "n2",
      label: "Odia números",
      type: "contradiccion",
      timestamp: 0,
      summary: "Choque entre identidad laboral y preferencia personal.",
      evidence: "aunque odia los números"
    },
    {
      id: "n3",
      label: "Callback",
      type: "callback",
      timestamp: 74,
      summary: "La idea vuelve con otro contexto.",
      evidence: "no escapó de los números"
    }
  ],
  edges: [
    { from: "n1", to: "n2", type: "contradice", label: "choque" },
    { from: "n2", to: "n3", type: "vuelve", label: "regresa" }
  ],
  timeline: [
    {
      timestamp: 0,
      label: "Setup",
      description: "Aparece una contradicción base.",
      nodeIds: ["n1", "n2"]
    },
    {
      timestamp: 74,
      label: "Callback",
      description: "La contradicción vuelve como remate.",
      nodeIds: ["n3"]
    }
  ],
  insights: ["El valor del video está en ver qué detalles se guardan y cuándo regresan."]
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "thesis", "nodes", "edges", "timeline", "insights"],
  properties: {
    title: { type: "string", maxLength: 80 },
    thesis: { type: "string", maxLength: 240 },
    nodes: {
      type: "array",
      minItems: 24,
      maxItems: 72,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type", "timestamp", "summary", "evidence"],
        properties: {
          id: { type: "string", maxLength: 24 },
          label: { type: "string", maxLength: 28 },
          type: {
            type: "string",
            enum: ["tema", "persona", "setup", "callback", "contradiccion", "escalada", "remate", "pregunta"]
          },
          timestamp: { type: "number", minimum: 0 },
          summary: { type: "string", maxLength: 220 },
          evidence: { type: "string", maxLength: 180 }
        }
      }
    },
    edges: {
      type: "array",
      minItems: 34,
      maxItems: 160,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "type", "label"],
        properties: {
          from: { type: "string", maxLength: 24 },
          to: { type: "string", maxLength: 24 },
          type: {
            type: "string",
            enum: ["vuelve", "contradice", "escala", "responde", "reformula", "prepara"]
          },
          label: { type: "string", maxLength: 32 }
        }
      }
    },
    timeline: {
      type: "array",
      minItems: 8,
      maxItems: 32,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["timestamp", "label", "description", "nodeIds"],
        properties: {
          timestamp: { type: "number", minimum: 0 },
          label: { type: "string", maxLength: 40 },
          description: { type: "string", maxLength: 160 },
          nodeIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string", maxLength: 24 }
          }
        }
      }
    },
    insights: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", maxLength: 220 }
    }
  }
};

export async function POST(request: NextRequest) {
  const { videoUrl, transcripts } = await request.json();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    return NextResponse.json({ error: "No hay transcripción para analizar." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(fallbackGraph);
  }

  const storyBlocks = buildStoryBlocks(transcripts);
  const lastTranscriptTime = transcripts.reduce((latest, segment) => {
    const start = Number(segment.start) || 0;
    return Math.max(latest, start + (segment.duration ?? 0));
  }, 0);

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
            "Eres un analista de estructura comica y conversacional. Convierte una transcripcion de standup/crowdwork en un grafo denso de ideas atomicas. No hagas solo temas generales. Modela la conversacion: pregunta del comediante, respuesta del publico, reinterpretacion, etiqueta, contradiccion, cambio de marco, referencia, callback y remate. Divide en microideas: objetos, personas, parentescos, premisas, frases repetidas, lugares, miedos, deseos, objeciones, reglas implicitas e imagenes mentales. No copies material extenso. Responde JSON en espanol."
        },
        {
          role: "user",
          content: JSON.stringify({
            videoUrl,
            coverage: {
              total_blocks: storyBlocks.length,
              last_transcript_second: Math.round(lastTranscriptTime)
            },
            instruction:
              "Crea un grafo denso estilo Obsidian para entender todas las conexiones del show completo. Recibes todos los bloques de 45-60 segundos, no frases sueltas. No te concentres solo al inicio: distribuye nodos y eventos a lo largo de todo el video, incluyendo inicio, mitad y final. El mayor timestamp de algun nodo debe acercarse al final real del transcript si hay material comico alli. Primero identifica arcos conversacionales dentro de cada bloque: quien plantea el problema, que dato raro aparece, que pregunta abre material, que reinterpretacion hace el comediante, que contradiccion explota y que remate/callback surge. Luego conecta microideas entre bloques. Los nodos NO deben ser solo temas: incluye subtemas y microdetalles concretos como objetos, parentescos, decisiones, objeciones, frases clave, roles, reglas implicitas, contradicciones, imagenes mentales, preguntas, setups, callbacks, escaladas y remates. Cada nodo importante debe tener varias conexiones si el transcript lo permite. Crea edges entre detalles pequenos, no solo entre temas grandes. Prefiere conexiones como 'pregunta abre', 'respuesta revela', 'reformula', 'contradice', 'vuelve como callback', 'escala a imagen', 'remata', 'contrasta con', 'reencuadra', 'resuelve'. Nodos de 1 a 3 palabras. Edges con labels breves y completos. Usa timestamps reales del bloque donde aparece la idea. Evidencia breve, no citas largas.",
            transcript_blocks: storyBlocks
          })
        }
      ],
      max_output_tokens: 10000,
      text: {
        format: {
          type: "json_schema",
          name: "comedy_graph",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    return NextResponse.json(fallbackGraph);
  }

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text ?? "")
      ?.join("");

  if (!text) return NextResponse.json(fallbackGraph);

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(fallbackGraph);
  }
}

function buildStoryBlocks(segments: TranscriptSegment[]) {
  const blocks: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;
  const targetDuration = 55;
  const maxChars = 1150;

  for (const segment of segments) {
    if (!current) {
      current = { text: segment.text, start: Number(segment.start) || 0, duration: segment.duration ?? 0 };
      continue;
    }

    const segmentStart = Number(segment.start) || 0;
    const segmentEnd = segmentStart + (segment.duration ?? 0);
    const currentEnd = current.start + (current.duration || 0);
    const wouldStayInBeat = segmentEnd - current.start <= targetDuration;
    const hasRoom = current.text.length + segment.text.length < maxChars;

    if (wouldStayInBeat && hasRoom) {
      current.text = `${current.text} ${segment.text}`.trim();
      current.duration = Math.max(segmentEnd - current.start, current.duration ?? 0);
    } else {
      blocks.push(current);
      current = { text: segment.text, start: segmentStart, duration: segment.duration ?? 0 };
    }
  }

  if (current) blocks.push(current);
  return blocks;
}
