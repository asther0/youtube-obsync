# Obsync

Obsync convierte contenido web y recortes de video en apuntes conectados con Obsidian. Mientras lees o ves un video, puedes escribir una nota, capturar una imagen, marcar un extracto con transcripción cuando exista video y guardar todo como Markdown en tu vault.

El proyecto también incluye **Comedy Graph**, una ruta especializada para analizar videos de comedia como grafos de ideas, callbacks y conexiones.

## Qué Hace

- Guarda apuntes rápidos desde cualquier página web con URL fuente, estado y capturas.
- Trae transcripciones de YouTube usando SearchAPI `youtube_transcripts` cuando capturas un extracto de video.
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
8. Haz click en **Config**, pega el token sin la palabra `Bearer` y prueba la conexión con **Probar**.
9. Usa:
   - **Pendiente / Revisado** para marcar el estado del apunte.
   - **Imagen** para capturar evidencia visual de cualquier página.
   - **Voz** para dictar texto directo dentro del apunte cuando Chrome soporte reconocimiento de voz.
   - **Guardar apunte** para guardar URL, nota, estado e imágenes en Obsidian.
   - **Iniciar extracto** en YouTube para marcar desde dónde quieres guardar transcripción.
   - **Cerrar y guardar** para cerrar el rango, traer la transcripción, interpretarla con OpenAI y guardar el extracto en Obsidian.

La extensión usa `chrome.tabs.captureVisibleTab`, por lo que captura lo visible de la pestaña como evidencia visual. Las imágenes se guardan junto al inbox de Obsync y se embeben en el Markdown. Backtick fue usado como referencia de producto para exportar imágenes pulidas desde UI propia, pero Obsync mantiene el recorte de pestaña porque necesita capturar páginas reales, videos y documentos abiertos en Chrome.

El backend local sigue siendo necesario para traer transcript con SearchAPI, generar notas atómicas con OpenAI y escribir en Obsidian sin depender del certificado local de Chrome. El plugin suele responder en `https://127.0.0.1:27124`; el sidebar lo detecta automáticamente desde **Probar**.

La configuración vive en **Config**: token de Obsidian y endpoints avanzados. El destino del vault es fijo para mantener el flujo limpio: todo entra por `20 inbox/obsync/` y luego se revisa o promueve manualmente dentro de Obsidian.

## Organización En Obsidian

Obsync guarda todos los apuntes en una ruta mensual fija dentro del vault:

```text
20 inbox/obsync/YYYY-MM/YYYY-MM-DD-titulo.md
```

Las capturas de pantalla se guardan dentro de la misma rama:

```text
20 inbox/obsync/_attachments/YYYY-MM/archivo.png
```

Cada nota incluye frontmatter para poder armar recordatorios, Dataview queries
o un dashboard personal:

- `obsync_kind`: `web_note` o `video_extract`
- `source_type`: `web`, `linkedin`, `github` o `youtube`
- `status`: `pendiente` o `revisado`
- `review_after`: fecha sugerida para volver a revisar
- `review_interval_days`: intervalo usado para esa revisión
- `source`, `source_title`, `captured_at`, `folder`

La regla de trabajo recomendada es simple: todo entra por `20 inbox/obsync/`.
Después, al revisar, se promueve manualmente a `10 second-brain/ideas`,
`10 second-brain/patterns`, un proyecto en `30 projects/`, o se archiva.

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
