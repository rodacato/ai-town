# AI Town

Simulación de **Chismeroble**, una aldea de fantasía al estilo D&D ("donde los rumores crecen más rápido que los robles"), habitada por residentes con personalidad propia. Haces un pregón público y ves cómo decide y reacciona cada uno.

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

### Dos formas de conectar

- **Local (`npm run dev`)**: las peticiones pasan por un proxy dentro del servidor de Vite (`/api/llm`). El navegador mantiene un solo stream abierto y cada decisión es un POST corto, así que no aplica el límite de ~6 conexiones por host del navegador. Si dejas la key vacía, el proxy usa la de `.env` (ver `.env.example`). La terminal registra cada petición.
- **Estática (GitHub Pages)**: no hay proxy. Tu navegador llama directo al proveedor con tu propia key. Anthropic y OpenAI lo permiten; Ollama y LM Studio necesitan habilitar CORS; SheLLM necesita CORS y, para más de 6 peticiones a la vez, HTTPS con HTTP/2 (por ejemplo, Caddy delante).

### Keys

- Por defecto viven solo en memoria: se borran al cerrar la pestaña.
- Opcionalmente se recuerdan **cifradas** (PBKDF2 + AES-GCM) con una frase; nunca se guardan en claro.
- El build de producción lleva una Content-Security-Policy estricta: sin scripts externos ni `eval`.
- Todas tus páginas de `usuario.github.io` comparten origen: evita scripts de terceros en ellas.
- Usa keys dedicadas, con tope de gasto, y rótalas al terminar.

### Métricas y exportación

Cada petición al modelo queda registrada: tiempo en cola, hasta la primera palabra, respuesta completa, tokens y costo. El panel **Consumo** muestra totales y percentiles (p50/p95); el inspector, los de cada residente. El costo viene del host cuando lo reporta (SheLLM) o se estima con el precio por millón de tokens que pongas en Configuración (Claude trae precios de lista para algunos modelos). Al terminar un pregón puedes exportar la corrida en **JSON** (configuración sin key, decisiones y métricas) o **CSV** (una fila por petición).

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre typecheck, tests y build en cada push a `main` y publica `dist/`. En el repo, activa **Settings → Pages → Source: GitHub Actions**. El build usa rutas relativas, así que funciona con cualquier nombre de repositorio.

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
