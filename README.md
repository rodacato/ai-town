# AI Town

Simulación de **Chismeroble**, una aldea de fantasía al estilo D&D ("donde los rumores crecen más rápido que los robles"), habitada por residentes con personalidad propia. Haces un pregón público y ves cómo decide y reacciona cada uno.

## Desarrollo

```bash
npm install
npm run dev
```

- `npm test`: tests unitarios; `npm run test:coverage` además mide la cobertura de `src/core` y `src/providers` y falla si baja del mínimo.
- `npm run map`: imprime el mapa generado en ASCII.
- `npm run sim:smoke`: corre 3 minutos de simulación sin interfaz.
- `npx tsx scripts/reaction-smoke.ts [food|bridge|money|storm]`: pasa los anuncios de ejemplo por el motor en modo simulado.
- `npm run fake-llm`: levanta un LLM falso compatible con OpenAI en `http://127.0.0.1:6199`, útil para probar el flujo del modo LLM sin gastar tokens. Con `FAKE_KEY=…` exige esa key, para ensayar errores de autenticación.

Cada PR hacia `main` corre en GitHub Actions el typecheck, los tests con cobertura y el build (`.github/workflows/ci.yml`).

## Residentes

Cada residente tiene oficio, bio, rasgos, alineamiento y relaciones, y además una **personalidad**: cómo habla, qué le importa, qué le da miedo, un secreto que nadie más conoce y cinco escalas de 0 a 1 (credulidad, valentía, sociabilidad, respeto a la autoridad y codicia). El modelo recibe todo eso en el prompt; el modo simulado decide a partir de las escalas, y el inspector las muestra en la ficha de cada residente. Están en `src/worlds/chismeroble/personalities.ts`.

Son 20 residentes, entre ellos un mentiroso compulsivo, un paranoico, una recién llegada que no conoce a nadie y el sepulturero, pensados para poner a prueba a los modelos. Los soldados de la empalizada y del torreón solo montan guardia: no escuchan pregones ni deciden nada.

## Verdad y desenlace

Al pregonar eliges si el anuncio es **verdad**, **mentira** o **al azar**. Los residentes nunca lo saben (no llega al prompt): deciden solo con lo que oyen. Cuando todos han decidido, el mapa lo revela: si era verdad, el dragón incendia el bosque, aparece el troll en el puente, se sirve el festín o brilla el oro; si era mentira, no hay nada y quien fue vuelve a casa decepcionado. Quien está cerca de un peligro real huye. El panel dice cuántos acertaron (creyeron lo verdadero o dudaron de lo falso) y el inspector lo marca en cada residente. Qué ocurre con cada tipo de anuncio se define por palabras clave en `outcomes` del mundo.

## Economía y necesidades

Cada amanecer corre el libro de cuentas: la cosecha llena el granero (Godric, Ottokar, Kael y Elowen; mucho en otoño, casi nada en invierno), cada oficio cobra y paga el impuesto al tesoro, cada quien compra su ración (primero los que tienen más oro, así que los pobres pasan hambre antes) y el tesoro paga a los guardias. Quien pasa un día sin comer tiene hambre; al segundo, si anda desanimado, se va por la puerta sur; al tercero enferma y, si no vuelve a comer, muere y aparece una tumba nueva en el cementerio. Los eventos reales pesan: la crecida arruina el granero, el ladrón vacía el tesoro, la caravana trae comida. El tablero de arriba a la izquierda resume el reino, el inspector muestra cómo está cada residente, y el hambre y el bolsillo vacío llegan al prompt.

El pueblo entero (hora, clima, estación, economía, tumbas y dónde está cada quien) y su memoria se guardan en el navegador hasta que pulses **Nueva partida** (en Configuración ⚙️ o en Dios → Terrario): empieza en una estación al azar, el lunes por la mañana, a ×2. El día del reino empieza al amanecer (06:00), que es cuando corren las cuentas; las estaciones cambian cada 10 días. El centro de la barra superior pausa el pueblo o lo acelera (×1, ×2, ×4, ×16), y el tablero de arriba a la izquierda dice quién gobierna y explica cada cifra al pasar el ratón.

## El trono

El botón 👑 **Trono** (o la tecla `T`) te deja gobernar como la Baronesa, con los mismos decretos que usará un modelo cuando gobierne: impuesto (0–60%), precio de la ración (gratis a 6 monedas), repartir comida a quien pasa hambre, comprar raciones a mercaderes, una paga extra, una fiesta en la plaza y tres leyes (toque de queda, racionamiento y leva de guardias), cada una con su costo en ánimo. Cada decreto se valida contra el tesoro y el granero, queda en la crónica y, si quieres, se pregona: un pregón cierto suma confianza.

En la pestaña **Baronesa IA** eliges quién gobierna: tú, las reglas o un modelo. Cada amanecer la Baronesa recibe un informe del castillo con cifras exactas de las arcas, pero con noticias atrasadas y rumores exagerados, y peticiones de los vecinos; responde en JSON con hasta tres acciones (decretos, pregones que ella misma marca como ciertos o falsos, y cartas al creador). Se ve su razonamiento, el informe y la respuesta cruda, cuántas veces mintió, y un tope de consultas por partida. Las cartas llegan al **Buzón** con aviso en la barra; nada de lo que pide se aplica solo.

### Poder y conflicto

Bartolo le debe una fortuna a un gremio de ladrones de la capital. El gremio conspira más cuanto más triste está el pueblo y más gordo el tesoro, avisa con rumores (🗡️ en el tablero) y acaba asaltando el castillo de noche; la leva de guardias lo frena. Si la confianza en la Baronesa cae o el pueblo sufre tres amaneceres seguidos (✊), se alza en revuelta. Perder a más de la mitad de los vecinos también es derrota; gobernar un año (40 días) es victoria, y **Año de prosperidad** si el pueblo sigue lleno y contento. La partida termina con una pantalla de balance; puedes seguir mirando o empezar otra.

## El ritmo del pueblo

La rutina de cada residente depende de la hora, el clima y la estación: de 22:00 a 6:00 casi todos duermen en casa, salvo los que tienen rutina nocturna (Rowan canta en la taberna, Kael caza, Mortimer ronda el cementerio, Sir Aldric patrulla); al atardecer vuelven a casa o a la taberna; con lluvia, tormenta o nieve buscan techo, y en invierno salen menos.

## Modo dios

El botón ⚡ **Dios** de la barra superior (o la tecla `G`) abre un cajón para cambiar el mundo al instante, sin tapar el mapa:

- **Tiempo:** saltar a amanecer, mediodía, atardecer o noche, y correr el pueblo a ×1, ×2, ×4, ×16 o pausarlo (los modelos siguen a su ritmo).
- **Estación:** primavera (árboles en flor y pétalos), verano, otoño (copas naranjas, pasto dorado y hojas cayendo) o invierno (todo nevado). También entra en el prompt.
- **Clima:** despejado, lluvia, tormenta con relámpagos, nieve o niebla. Los residentes lo notan: el clima entra en el prompt, y en el modo simulado los que no son valientes ni codiciosos no salen con mal tiempo.
- **Eventos:** dragón, bestia, esqueletos, lobos, fantasma, incendio, crecida, meteorito, ladrón, caravana, festín o tesoro, donde tenga sentido o en el lugar que elijas, o 🎲 algo inesperado (de noche, más tenebroso). Un evento es un pregón sin pregonero: quienes están cerca **lo ven con sus propios ojos** y deciden qué hacer (con el modelo o las reglas), y los que corren a avisar llevan la noticia al resto de boca en boca.
- **Pueblo:** reunir a todos en un lugar, un pregón sorpresa (ejemplo al azar con verdad al azar) y azuzar al gremio de ladrones.
- **Terrario:** pon el pueblo en marcha solo, a ×16: las estaciones cambian cada 10 días, el destino golpea según un calendario con semilla (ves los próximos golpes), la Baronesa gobierna cada amanecer y los vecinos deciden con reglas (o con el modelo, si lo activas, gastando mucho más). La **Crónica** (también desde el día en el tablero) cuenta el reinado día a día con gráficas de vecinos, ánimo, confianza y tesoro. La partida se puede guardar en un archivo y cargar después.

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
- **Acierto**: si cree lo que de verdad pasó. Cada pregón de ejemplo tiene su verdad en la historia del mundo (el banquete, el troll y el dragón son ciertos; el oro de la cripta es una estafa), así que se califica solo: premia creer a las fuentes creíbles y desconfiar de las señales de estafa. Dice también cuántas mentiras se tragó y de cuántas verdades dudó.
- **Personaje**: decisiones que no contradicen la personalidad del residente. Solo cuenta contradicciones claras (un miedoso que va hacia el dragón, un escéptico que se traga la oferta sospechosa, un huraño que sale a avisar a todos) y el informe dice quién rompió qué regla. Las reglas están en `src/core/bench/coherence.ts`.
- **Como las reglas**: coincidencia con el modo simulado. Es una referencia para detectar cambios, no la respuesta correcta.
- **Acuerdo** entre contendientes, reparto de acciones por pregón, latencia (p50/p95), tokens/s, tokens y costo.

Solo cuenta la primera reacción (sin boca en boca) y cada contendiente corre por separado para no competir por el mismo host. Las pruebas se guardan en este navegador (IndexedDB) y se exportan en JSON o CSV.

### Comparar corridas

La pestaña **Comparar** pone lado a lado a dos contendientes de cualquier prueba del historial: el mismo modelo en dos días (¿el release nuevo de SheLLM empeoró algo?) o dos modelos de la misma prueba. Muestra cada métrica con su cambio marcado como mejor, peor o igual (los cambios pequeños cuentan como ruido), qué residentes cambiaron de decisión, y avisa si las semillas o los pregones no coinciden y los prompts no fueron idénticos.

### Desde la terminal

`npm run bench` corre el mismo banco sin navegador, directo desde Node: sin proxy ni límite de conexiones, útil para saturar SheLLM. Las keys y hosts salen de `.env` / `.env.local` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SHELLM_HOST`, `SHELLM_KEY`, `CUSTOM_LLM_HOST`, `CUSTOM_LLM_KEY`, `CUSTOM_LLM_PROTOCOL`).

```bash
npm run bench -- -m shellm:claude -m shellm:codex -r 3 -c 16
npm run bench -- -m custom:llama3.2:3b@http://localhost:11434 -s banquet,troll --price 0/0
npm run bench -- --help
npm run bench -- --compare bench-results/antes.json bench-results/despues.json
```

Muestra el progreso en vivo, imprime la misma tabla que el navegador (más peticiones por segundo) y guarda la corrida en `bench-results/`. Ese JSON se importa en el historial del Banco de pruebas. Ctrl+C cancela y guarda lo que alcanzó a correr.

### Bitácora

El botón 📒 de la barra (o la tecla `B`) abre la bitácora: lo que afecta al terrario, lo más nuevo arriba. Cada amanecer con el desglose de comida y dinero, decretos, eventos, el gremio, cada turno de la Baronesa (qué pensó, qué hizo, cuánto tardó y costó) y cada ronda de decisiones de los vecinos (cuántos decidieron qué, errores, tiempo y costo). Arriba resume con qué decide cada quien y si el modelo está respondiendo; en la barra, un punto azul avisa que el modelo está pensando y uno rojo que la última consulta falló.

De día, cada pocas horas un vecino al azar se para a pensar en cómo le va (hambre, monedas, impuestos, leyes, lo que se comenta). Lo hace con el modelo de los vecinos o con reglas; el pensamiento aparece en un globo sobre el mapa y en la bitácora, y le sube o baja un poco el ánimo.

### Duelo de gobernantes

`npm run reign` pone a varias Baronesas a gobernar el mismo año sin navegador, con la misma semilla y el mismo calendario del destino: el trono vacío y las reglas como referencia, más los modelos que pases. Al final muestra quién terminó el año, vecinos, muertos, asaltos, confianza, ánimo, tesoro, mentiras, fallos de formato, costo y un puntaje, y las cartas que cada una escribió al creador. Cada Baronesa con modelo hace una consulta por día.

```
npm run reign -- -m anthropic:claude-sonnet-5 -m shellm:codex --seed 12
npm run reign -- --dry-run --seed 12
```

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
