import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const fallback = {
  headline: "Ruta fuerte de callback: identidad laboral contra resistencia personal",
  cues: [
    { label: "callback disponible", tone: "gold" },
    { label: "contradicción", tone: "coral" },
    { label: "pregunta más", tone: "mint" }
  ],
  nodes: [
    { id: "speaker", label: "persona", x: 72, y: 78, tone: "gold" },
    { id: "identity", label: "identidad", x: 205, y: 58, tone: "blue" },
    { id: "clash", label: "choque", x: 330, y: 118, tone: "coral" },
    { id: "future", label: "detalle futuro", x: 214, y: 214, tone: "mint" },
    { id: "route", label: "ruta de riff", x: 402, y: 220, tone: "violet" }
  ],
  edges: [
    { from: "speaker", to: "identity", label: "detalle" },
    { from: "identity", to: "clash", label: "contradicción" },
    { from: "clash", to: "future", label: "semilla" },
    { from: "future", to: "route", label: "ruta" }
  ],
  scores: {
    memory: 68,
    specificity: 72,
    tension: 80,
    brevity: 66,
    followUp: 70,
    ownership: 78
  },
  opportunities: [
    {
      title: "Minería de contradicción",
      why: "El movimiento de entrenamiento más fuerte es encontrar el choque entre identidad y comportamiento.",
      routes: [
        "Convertir el choque en una etiqueta juguetona para la persona del público.",
        "Hacer una pregunta más filosa que abra un detalle personal.",
        "Guardar el detalle como semilla de callback para el siguiente beat."
      ],
      example: "Eso no es una carrera, es una pelea con tu propia configuración."
    }
  ]
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "cues", "nodes", "edges", "scores", "opportunities"],
  properties: {
    headline: { type: "string" },
    cues: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "tone"],
        properties: {
          label: { type: "string", maxLength: 24 },
          tone: { type: "string", enum: ["gold", "mint", "coral", "violet", "blue"] }
        }
      }
    },
    nodes: {
      type: "array",
      minItems: 4,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "x", "y", "tone"],
        properties: {
          id: { type: "string" },
          label: { type: "string", maxLength: 22 },
          x: { type: "number", minimum: 40, maximum: 440 },
          y: { type: "number", minimum: 40, maximum: 240 },
          tone: { type: "string", enum: ["gold", "mint", "coral", "violet", "blue"] }
        }
      }
    },
    edges: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string", maxLength: 18 }
        }
      }
    },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["memory", "specificity", "tension", "brevity", "followUp", "ownership"],
      properties: {
        memory: { type: "number", minimum: 0, maximum: 100 },
        specificity: { type: "number", minimum: 0, maximum: 100 },
        tension: { type: "number", minimum: 0, maximum: 100 },
        brevity: { type: "number", minimum: 0, maximum: 100 },
        followUp: { type: "number", minimum: 0, maximum: 100 },
        ownership: { type: "number", minimum: 0, maximum: 100 }
      }
    },
    opportunities: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "routes", "example"],
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          routes: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" }
          },
          example: { type: "string" }
        }
      }
    }
  }
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(fallback);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Eres Fast Crowdwork Mentor. Analiza una ronda breve de crowdwork. Devuelve JSON conciso en espanol. Ensena tecnica, no escribas un show ni imites comediantes vivos."
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "Detecta callbacks, contradicciones, detalles, preguntas de seguimiento y conexiones para grafo. Entrega rutas de riff, maximo una linea ejemplo. Labels del grafo de 1 a 3 palabras. Todo en espanol.",
            round: body
          })
        }
      ],
      max_output_tokens: 1200,
      text: {
        format: {
          type: "json_schema",
          name: "punchline_arena_analysis",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    return NextResponse.json(fallback);
  }

  const data = await response.json();
  const text =
    data.output_text ??
    data.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
      ?.map((content: { text?: string }) => content.text ?? "")
      ?.join("");

  if (!text) {
    return NextResponse.json(fallback);
  }

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(fallback);
  }
}
