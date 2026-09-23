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

```
src/
  core/        dominio puro, sin DOM: mundo, simulación, motor de reacciones y contrato de decisiones
  providers/   quién decide: modo simulado (mock.ts) y LLM (llm/), elegidos en providers/index.ts
  worlds/      paquetes de mundo: contenido (mapa, lugares, residentes, ejemplos, vocabulario) y arte
  render/      escena isométrica con PixiJS; dibuja lo genérico y le pide al arte del mundo lo demás
  theme/       tokens de presentación compartidos por el mapa y la interfaz
  app/
    town.ts    el controlador: única puerta de la interfaz hacia la simulación y el mapa
    store/     estado de la interfaz en partes (ui, composer, experiment, settings)
    features/  una carpeta por pieza de la interfaz, cada una con su CSS
    shared/    componentes reutilizables
    shell/     layout general
server/        proxy LLM para el servidor de Vite
tests/         tests del núcleo, independientes del mundo activo
```

**Crear o cambiar el mundo.** Todo lo del pueblo vive en `src/worlds/<nombre>/`: `layout.ts` (mapa y edificios), `index.ts` (lugares, residentes, quién habla, ejemplos, vocabulario) y `art/` (cómo se dibuja). El mundo activo se elige en `src/worlds/index.ts`. Los tests validan cualquier paquete: `npm test`.
