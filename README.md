# AI Town

Simulación de un pueblo isométrico habitado por residentes con personalidad propia. Haces un anuncio público y ves cómo decide y reacciona cada uno.

## Desarrollo

```bash
npm install
npm run dev
```

- `npm run map`: imprime el mapa generado en ASCII.
- `npm run sim:smoke`: corre 3 minutos de simulación sin interfaz.
- `npx tsx scripts/reaction-smoke.ts [food|bridge|money|storm]`: pasa los anuncios de ejemplo por el motor en modo simulado.
- `npm run fake-llm`: levanta un LLM falso compatible con OpenAI en `http://127.0.0.1:6199`, útil para probar el flujo del modo LLM sin gastar tokens.

## Modelo de decisiones

El engrane de la barra superior abre la configuración. Opciones:

| Proveedor | Protocolo | Notas |
|---|---|---|
| Simulado | — | Reglas locales. Gratis e inmediato. |
| Claude | Anthropic Messages (SDK oficial) | Usa tu API key de Anthropic. |
| OpenAI | Chat Completions | Usa tu API key de OpenAI. |
| SheLLM | Cualquiera de los dos | Tu suscripción de Claude Code o Codex vía [SheLLM](https://rodacato.github.io/SheLLM/). Mantén la concurrencia baja. |
| Personalizado | Compatible con OpenAI | Ollama, LM Studio, OpenRouter… |

Las peticiones pasan por un proxy dentro del servidor de Vite (`/api/llm`), así el navegador no necesita CORS ni ve credenciales de terceros. Si dejas la key vacía en el modal, el proxy usa la del archivo `.env` (ver `.env.example`). La configuración se guarda en `localStorage`.

El proxy está pensado para uso local. Si publicas la app, las keys deben quedarse solo en el servidor.

## Estructura

- `src/sim/`: motor puro en TypeScript (mundo, pathfinding, rutinas, tareas). No depende de React ni de Pixi.
- `src/agents/`: motor de reacciones, scheduler, contrato `DecisionProvider`, modo simulado y proveedor LLM (`llm/`).
- `server/llmProxy.ts`: proxy de Vite hacia Anthropic u APIs compatibles con OpenAI.
- `src/render/`: escena isométrica con PixiJS.
- `src/ui/`: interfaz en React.
- `src/data/`: el pueblo, sus 16 residentes y los anuncios de ejemplo.
