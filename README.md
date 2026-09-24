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

## Residentes

Cada residente tiene oficio, bio, rasgos, alineamiento y relaciones, y además una **personalidad**: cómo habla, qué le importa, qué le da miedo, un secreto que nadie más conoce y cinco escalas de 0 a 1 (credulidad, valentía, sociabilidad, respeto a la autoridad y codicia). El modelo recibe todo eso en el prompt; el modo simulado decide a partir de las escalas, y el inspector las muestra en la ficha de cada residente. Están en `src/worlds/chismeroble/personalities.ts`.

Son 20 residentes, entre ellos un mentiroso compulsivo, un paranoico, una recién llegada que no conoce a nadie y el sepulturero, pensados para poner a prueba a los modelos. Los soldados de la empalizada y del torreón solo montan guardia: no escuchan pregones ni deciden nada.

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

### Banco de pruebas

El botón **Pruebas** compara modelos con los mismos pregones y residentes. Una semilla fija reconstruye el mismo pueblo en el mismo momento, así que todos los contendientes reciben prompts idénticos, hoy o dentro de un mes. Mide:

- **Formato**: respuestas con el JSON pedido sin que la app tenga que arreglar nada (y qué falló cuando no).
- **Consistencia**: con 2+ repeticiones, qué tanto repite cada residente su decisión.
- **Personaje**: decisiones que no contradicen la personalidad del residente. Solo cuenta contradicciones claras (un miedoso que va hacia el dragón, un escéptico que se traga la oferta sospechosa, un huraño que sale a avisar a todos) y el informe dice quién rompió qué regla. Las reglas están en `src/core/bench/coherence.ts`.
- **Como las reglas**: coincidencia con el modo simulado. Es una referencia para detectar cambios, no la respuesta correcta.
- **Acuerdo** entre contendientes, reparto de acciones por pregón, latencia (p50/p95), tokens/s, tokens y costo.

Solo cuenta la primera reacción (sin boca en boca) y cada contendiente corre por separado para no competir por el mismo host. Las pruebas se guardan en este navegador (IndexedDB) y se exportan en JSON o CSV.

### Desde la terminal

`npm run bench` corre el mismo banco sin navegador, directo desde Node: sin proxy ni límite de conexiones, útil para saturar SheLLM. Las keys y hosts salen de `.env` / `.env.local` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SHELLM_HOST`, `SHELLM_KEY`, `CUSTOM_LLM_HOST`, `CUSTOM_LLM_KEY`, `CUSTOM_LLM_PROTOCOL`).

```bash
npm run bench -- -m shellm:claude -m shellm:codex -r 3 -c 16
npm run bench -- -m custom:llama3.2:3b@http://localhost:11434 -s banquet,troll --price 0/0
npm run bench -- --help
```

Muestra el progreso en vivo, imprime la misma tabla que el navegador (más peticiones por segundo) y guarda la corrida en `bench-results/`. Ese JSON se importa en el historial del Banco de pruebas. Ctrl+C cancela y guarda lo que alcanzó a correr.

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
