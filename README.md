# Obsync

Obsync convierte recortes de videos de YouTube en notas atómicas conectadas con Obsidian. Pega un video, conecta tu vault local, marca inicio y fin del recorte, y guarda Markdown con transcript, fuente, carpeta sugerida, tags y backlinks.

El proyecto también incluye **Comedy Graph**, una ruta especializada para analizar videos de comedia como grafos de ideas, callbacks y conexiones.

## Qué Hace

- Trae transcripciones de YouTube usando SearchAPI `youtube_transcripts`.
- Permite marcar recortes de video por inicio y fin.
- Usa OpenAI para extraer notas atómicas, carpeta sugerida, tags y backlinks.
- Sincroniza archivos `.md` directamente en un vault local de Obsidian usando File System Access API.
- Incluye transcript timestamped dentro del Markdown guardado.
- Mantiene `/` como Comedy Graph para explorar estructura cómica en un grafo interactivo.

## Correr Localmente

```bash
bun install
bun run dev -- -p 4177
```

Abre:

- `http://localhost:4177/obsync` para Obsync.
- `http://localhost:4177` para Comedy Graph.

Variables en `.env.local`:

```bash
OPENAI_API_KEY=...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
SEARCHAPI_KEY=...
```

## Flujo

1. Pega una URL de YouTube.
2. Conecta tu vault de Obsidian.
3. Reproduce el video.
4. Marca inicio del recorte.
5. Marca fin y guarda.
6. Obsync crea notas `.md` conectadas dentro del vault.

## Chrome Extension MVP

La carpeta `extension/` contiene una extensión Chrome con side panel para probar el flujo natural desde YouTube.

Para probarla:

1. Corre la app local:

```bash
bun run dev -- -p 4177
```

2. Instala en Obsidian el plugin Community **Local REST API** y copia su token.
3. Abre Chrome en `chrome://extensions`.
4. Activa **Developer mode**.
5. Haz click en **Load unpacked** y selecciona la carpeta `extension/`.
6. Abre un video de YouTube.
7. Abre la extensión desde un video de YouTube. Se abrirá como side panel.
8. Configura:
   - Backend: `http://localhost:4177`
   - Obsidian REST URL: `http://127.0.0.1:27123`
   - Obsidian token
   - Carpetas canónicas separadas por comas
9. Elige la carpeta destino en **Save to**.
10. Usa:
   - **Start** para marcar inicio.
   - **Screenshot** para capturar la pantalla actual.
   - **Save** para cerrar el recorte, generar la nota y guardarla en Obsidian.

La extensión usa `chrome.tabs.captureVisibleTab`, por lo que captura lo visible de la pestaña como evidencia visual. Las imágenes se guardan en `Attachments/youtube-obsync/` y se embeben en el Markdown.

El backend local sigue siendo necesario para dos partes: traer transcript con SearchAPI y generar notas atómicas con OpenAI. La escritura final a Obsidian ocurre desde la extensión vía Local REST API.

## Uso De Referencias

El producto analiza contenido en runtime desde links que pega el usuario. No guarda transcripciones en el repo ni empaqueta material de terceros como dataset. El objetivo de Obsync es capturar conocimiento personal desde videos; el objetivo de Comedy Graph es estudiar estructura cómica: cómo nacen, vuelven y se transforman las ideas durante un video.

## Built With Codex

Este proyecto fue pivotado y construido con Codex durante OpenAI Build Week.

Decisiones humanas:

- Pivotar desde entrenamiento de crowdwork hacia análisis visual de videos de comedia.
- Expandir el producto hacia Obsync como herramienta general para aprender de videos.
- Usar SearchAPI para transcripciones de YouTube.
- Priorizar sync web-first con Obsidian antes de una extensión Chrome completa.

Codex aceleró:

- Implementación del frontend.
- Endpoints de SearchAPI y OpenAI.
- Esquema estructurado para grafo de comedia.
- Generación de notas atómicas compatibles con Obsidian.
- Sync local usando File System Access API.

## Track Recomendado

**Education** o **Apps for Your Life**.

Education si lo presentamos como herramienta para estudiar desde videos. Apps for Your Life si lo presentamos como una memoria personal para capturar aprendizajes cotidianos.
