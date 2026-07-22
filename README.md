# Obsync

Obsync convierte recortes de videos de YouTube en notas atómicas conectadas con Obsidian. Pega un video, conecta tu vault local, marca inicio y fin del recorte, y guarda Markdown con transcript, fuente, carpeta sugerida, tags y backlinks.

El proyecto también incluye **Comedy Graph**, una ruta especializada para analizar videos de comedia como grafos de ideas, callbacks y conexiones.

## Qué Hace

- Trae transcripciones de YouTube usando SearchAPI `youtube_transcripts`.
- Permite marcar recortes de video por inicio y fin.
- Usa OpenAI para extraer notas atómicas, carpeta sugerida, tags y backlinks.
- Sincroniza archivos `.md` e imágenes directamente en un vault local de Obsidian usando Local REST API.
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

Para la demo atómica completa, `OPENAI_API_KEY` y `SEARCHAPI_KEY` son requeridas. Si el backend de IA/transcript falla, la extensión conserva el flujo como captura manual visible, pero no lo presenta como nota generada por IA.

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

2. Instala en Obsidian el plugin Community **Local REST API with MCP** y copia su token.
3. Abre Chrome en `chrome://extensions`.
4. Activa **Developer mode**.
5. Haz click en **Load unpacked** y selecciona la carpeta `extension/`.
6. Abre un video de YouTube.
7. Abre la extensión desde un video de YouTube. Se abrirá como side panel.
8. Haz click en **Conectar**, pega el token sin la palabra `Bearer` y prueba la conexión con **Probar Obsidian**.
9. Elige la carpeta destino en **Carpeta**.
10. Usa:
   - **Imagen** para capturar frames importantes mientras ves el video.
   - **Iniciar extracto** para marcar desde dónde quieres guardar transcripción.
   - **Cerrar y guardar** para cerrar el rango, traer la transcripción, interpretarla con OpenAI y guardar la nota en Obsidian.

La extensión usa `chrome.tabs.captureVisibleTab`, por lo que captura lo visible de la pestaña como evidencia visual. Las imágenes se guardan en `Attachments/youtube-obsync/` y se embeben en el Markdown.

El backend local sigue siendo necesario para traer transcript con SearchAPI, generar notas atómicas con OpenAI y escribir en Obsidian sin depender del certificado local de Chrome. El plugin suele responder en `https://127.0.0.1:27124`; el sidebar lo detecta automáticamente desde **Probar Obsidian**.

La configuración vive en **Conectar**: token de Obsidian, carpeta destino, carpetas canónicas y endpoints avanzados. La vista principal queda enfocada en capturar imagen, escribir una nota breve y guardar un extracto verificable del video.

La extensión usa `<all_urls>` en `host_permissions` para permitir `chrome.tabs.captureVisibleTab` desde el service worker durante la demo. El backend proxy solo acepta endpoints locales de Obsidian (`localhost`/`127.0.0.1` en puertos `27123` o `27124`).

## Uso De Referencias

El producto analiza contenido en runtime desde links que pega el usuario. No guarda transcripciones en el repo ni empaqueta material de terceros como dataset. El objetivo de Obsync es capturar conocimiento personal desde videos; el objetivo de Comedy Graph es estudiar estructura cómica: cómo nacen, vuelven y se transforman las ideas durante un video.

## Built With Codex

Este proyecto fue pivotado y construido con Codex durante OpenAI Build Week.

Decisiones humanas:

- Pivotar desde entrenamiento de crowdwork hacia análisis visual de videos de comedia.
- Expandir el producto hacia Obsync como herramienta general para aprender de videos.
- Usar SearchAPI para transcripciones de YouTube.
- Priorizar un side panel de Chrome para capturar momentos de YouTube sin salir del video.

Codex aceleró:

- Implementación del frontend.
- Endpoints de SearchAPI y OpenAI.
- Esquema estructurado para grafo de comedia.
- Generación de notas atómicas compatibles con Obsidian.
- Sync local usando Obsidian Local REST API.

## Track Recomendado

**Education** o **Apps for Your Life**.

Education si lo presentamos como herramienta para estudiar desde videos. Apps for Your Life si lo presentamos como una memoria personal para capturar aprendizajes cotidianos.
