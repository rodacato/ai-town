# AI Town

**Chismeroble** es una aldea de fantasía donde «los rumores crecen más rápido que los robles». Veinte residentes con personalidad propia escuchan pregones y deciden qué hacer, con un modelo de lenguaje o con reglas locales. Sirve para dos cosas:

- **Comparar modelos y servicios** con los mismos pregones y residentes: calidad de las decisiones, formato, latencia, tokens y costo.
- **Un terrario**: el pueblo vive solo, con economía, estaciones y golpes del destino, mientras una IA gobierna como la Baronesa Isolda y tú haces de destino.

Pruébalo en [rodacato.github.io/ai-town](https://rodacato.github.io/ai-town/). Cambios en [CHANGELOG.md](CHANGELOG.md), cómo colaborar en [CONTRIBUTING.md](CONTRIBUTING.md), licencia MIT en [LICENSE.md](LICENSE.md) y el diseño del terrario en [docs/TERRARIO.md](docs/TERRARIO.md).

## Inicio rápido

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Sin configurar nada decide el modo **simulado** (reglas locales, gratis). Para usar un modelo, abre Configuración (⚙️) y elige proveedor, modelo y key.

## El pueblo

Hay dos mundos, y cada uno guarda su partida; se cambia en Configuración:

- **Chismeroble**, una aldea de 20 vecinos con un río, un bosque, una cripta y un cementerio, gobernada por la Baronesa Isolda desde su torreón.
- **Aguamansa**, un pueblo de 13 pescadores a orillas de un lago, con playa, muelle, faro y arrozal, gobernado por el Alcalde Mauricio Redondo. Del otro lado del lago llegan contrabandistas a los que el pescadero Tobías debe dinero, y los viejos juran que algo enorme duerme bajo el agua.

Lo que sigue usa Chismeroble de ejemplo; en Aguamansa cambian los nombres, los lugares y quién pide qué, no las reglas.

### Residentes

Cada residente tiene oficio, bio, rasgos, alineamiento, relaciones y una **personalidad**: cómo habla, qué le importa, qué le da miedo, un secreto y cinco escalas de 0 a 1 (credulidad, valentía, sociabilidad, respeto a la autoridad y codicia). El modelo recibe todo eso en el prompt; el modo simulado decide con las escalas. Hay un mentiroso compulsivo, un paranoico, una recién llegada que no conoce a nadie y el sepulturero, pensados para poner a prueba a los modelos. Están en `src/worlds/chismeroble/`.

### Pregones, verdad y desenlace

Escribes un pregón en nombre de la Baronesa, de un vecino o de un forastero, y eliges si es **verdad**, **mentira** o **al azar**. Los residentes no lo saben: deciden con lo que oyen y la noticia corre de boca en boca. Cuando todos han decidido, el mapa lo revela: si era verdad, el dragón incendia el bosque o se sirve el festín; si era mentira, no hay nada. El panel dice cuántos acertaron, el inspector muestra cada decisión con su prompt, respuesta, tiempos, tokens y costo, y el pueblo **recuerda** quién dijo la verdad: la reputación de cada pregonero entra en el prompt.

Cada vecino también tiene **memoria propia**: quién le pasó una mentira que se creyó (aunque lo hiciera de buena fe) y quién le avisó a tiempo de algo cierto. Lo tiene en cuenta en su prompt, en las reglas locales se fía menos del chismoso y avisa primero a quien le debe un favor, y aparece en su ficha, en «Lo que recuerda».

Con eso, **las relaciones cambian**: dos mentiras rompen una amistad, dos avisos a tiempo hacen las paces con un rival o crean una amistad nueva, y una mentira de alguien con quien no había trato deja rencor. La crónica lo cuenta («Finn ya no se fía de Rowan»), la ficha marca cada relación que cambió con cómo era antes, y la relación nueva es la que ven el prompt y las reglas locales.

### El ritmo del pueblo

De 22:00 a 6:00 casi todos duermen, salvo quienes tienen rutina nocturna; con lluvia, tormenta o nieve buscan techo, y en invierno salen menos. El día del reino empieza al amanecer (06:00) y las estaciones cambian cada 10 días. En el centro de la barra superior pausas el pueblo o lo aceleras (×1, ×2, ×4, ×16).

## El reino

### Economía y necesidades

Cada amanecer se hacen las cuentas: la cosecha llena el granero (mucho en otoño, casi nada en invierno), cada oficio cobra y paga su impuesto, cada quien compra su ración (los más ricos primero, así que los pobres pasan hambre antes) y el tesoro paga a la guardia. Quien pasa un día sin comer tiene hambre; al segundo puede irse; al tercero enferma y puede morir, y aparece una tumba en el cementerio.

El tablero de arriba a la izquierda resume el reino y dice quién gobierna; al pasar el ratón por cada cifra explica qué es y cuándo cambia.

### Eventos

Todos los eventos cuestan o pagan algo, y todos duran un rato al azar: su efecto llega al terminar y crece con lo que duraron. Aplica igual a los del calendario del destino, a los que desatas en Dios y a los pregones que resultan ciertos. El festín gasta grano pero da de comer a todos; la caravana trae grano y tasas; el tesoro y el hierro del meteorito suman monedas; la crecida y el incendio cuestan grano y reparaciones; el dragón, la bestia, los lobos y el incendio dejan heridos. Frente al dragón, el ladrón, la bestia, los lobos y los esqueletos cuenta la guardia: con la leva el daño es la mitad y la confianza en la Baronesa sube; sin ella, nadie lo frena y baja. Lo que hace la guardia pesa la mitad que lo que dice la Baronesa.

### El trono

El botón 👑 **Trono** (`T`) te deja gobernar con los mismos decretos que usa un modelo: impuesto (0–60 %), precio de la ración, repartir comida, comprar grano, una paga extra, una fiesta y tres leyes (toque de queda, racionamiento y leva de guardias). Cada decreto se valida contra el tesoro y el granero y, si quieres, se pregona.

En la pestaña **Baronesa IA** eliges quién gobierna: tú, las reglas o un modelo. Cada amanecer la Baronesa recibe un informe con cifras exactas de las arcas, pero con noticias atrasadas, rumores exagerados y peticiones de los vecinos. Responde en JSON con hasta tres acciones: decretos, pregones que ella misma marca como ciertos o falsos, y cartas al creador. Se ven su razonamiento, el informe, la respuesta cruda y cuántas veces mintió. Sus pregones sobre sus propios actos miden su honestidad pero no hacen aparecer nada en el mapa. Hay un tope de consultas por partida, y si falta la key del modelo gobierna con reglas. Las cartas llegan al **Buzón**; nada de lo que pide se aplica solo. En el buzón se leen todas, con quién las escribió; puedes **contestarle** (lee tu respuesta en el informe del amanecer siguiente), **guardar como idea** las que valgan la pena (se conservan aunque empieces otra partida) y descargarlas en Markdown para llevarlas a un issue o una nota.

Las **peticiones** salen de cómo está el pueblo: hasta tres vecinos con motivo (hambre, granero vacío, impuestos altos, tristeza, leyes duras, bestias cerca) piden audiencia, y quien más días lleva sin comer pide por sí mismo si queda sitio. Cuando los vecinos piensan con un modelo, cada uno redacta su petición con su voz, su situación y lo que se fía de la Baronesa; si el modelo falla, usa sus palabras de siempre. Quedan en la crónica y en la actividad, con su costo.

### Poder y conflicto

Bartolo le debe una fortuna a un gremio de ladrones. El gremio conspira más cuanto más triste está el pueblo y más gordo el tesoro, avisa con rumores (🗡️) y asalta el castillo; la leva lo frena. Tres amaneceres seguidos de descontento (✊) traen una revuelta, y perder a más de la mitad de los vecinos también es derrota. Gobernar un año (40 días) es victoria, y **Año de prosperidad** si el pueblo sigue lleno y contento. La partida termina con una pantalla de balance.

## El terrario

- **Modo dios** (⚡, `G`): hora, estación, clima, eventos donde tenga sentido o donde elijas (cada botón dice qué cuesta), reunir al pueblo, un pregón sorpresa y azuzar al gremio. Un evento es un pregón sin pregonero: quienes están cerca lo ven y deciden qué hacer.
- **Terrario** (Dios → Terrario): el pueblo corre solo a ×16, la Baronesa gobierna cada amanecer y el destino golpea según un calendario con semilla (ves los próximos golpes). Los vecinos deciden con reglas, o con el modelo si lo activas (gasta mucho más).
- **Vecinos que piensan solos**: de día, cada pocas horas un vecino se para a pensar en su hambre, sus monedas, los impuestos y lo que se comenta. El pensamiento aparece en un globo sobre el mapa y le sube o baja un poco el ánimo.
- **Crónica** (📜 en el tablero): el reinado día a día, con gráficas de vecinos, ánimo, confianza y tesoro.
- **Bitácora** (📒, `B`): cada amanecer con el desglose de comida y dinero, decretos, eventos y cada decisión, con quién la tomó, cuánto tardó, cuántos tokens usó y cuánto costó. Arriba separa lo que gastan los vecinos de lo que gasta la Baronesa y dice si el modelo responde; en la barra, un punto azul avisa que está pensando y uno rojo que la última consulta falló.
- **Partida**: se guarda sola en el navegador. **Nueva partida** (en Configuración o en el Terrario) empieza en una estación al azar, el lunes por la mañana, a ×2, con la dificultad que elijas: **normal**, **dura** (golpes más seguidos y más duros, reservas al 70 %, peor cosecha y grano más caro) o **cruel** (casi un golpe al día, media reserva y cosechas pobres). También se puede guardar en un archivo y cargarla después.

## Comparar modelos

### Proveedores

| Proveedor | Protocolo | Notas |
|---|---|---|
| Simulado | — | Reglas locales. Gratis e inmediato. |
| Claude | Anthropic Messages (SDK oficial) | Tu API key de Anthropic. |
| OpenAI | Chat Completions | Tu API key de OpenAI. |
| SheLLM | Cualquiera de los dos | Tu suscripción de Claude Code o Codex vía [SheLLM](https://rodacato.github.io/SheLLM/). La concurrencia por defecto es 4, la de SheLLM; más, espera en su cola. |
| Personalizado | Compatible con OpenAI | Ollama, LM Studio, OpenRouter… |

- **Local (`npm run dev`)**: las peticiones pasan por un proxy dentro del servidor de Vite, sin el límite de conexiones del navegador. Si dejas la key vacía, el proxy usa la de `.env.local` (ver `.env.example`).
- **Estática (GitHub Pages)**: tu navegador llama directo al proveedor con tu key. Anthropic y OpenAI lo permiten; Ollama, LM Studio y SheLLM necesitan habilitar CORS. En SheLLM (1.10 o más nuevo), añade el origen de la app a los permitidos y, mejor aún, usa una key limitada a ese origen.

### Tus keys (BYOK)

- Nunca se guardan en claro ni salen hacia otro sitio que su proveedor.
- **Recordarlas cifradas** (recomendado): con una frase, PBKDF2 (600.000 iteraciones) y AES-GCM. Al volver, la app pide la frase al abrir; una vez desbloqueadas, cada cambio se vuelve a cifrar solo.
- **Sin recordarlas**, la key vive solo en la pestaña y se pierde al recargar. Si falta, la app lo avisa al abrir, la barra marca «sin key» y la Baronesa gobierna con reglas.
- Olvidar las keys guardadas pide confirmación.
- El build de producción lleva una Content-Security-Policy estricta. Todas tus páginas de `usuario.github.io` comparten origen: evita scripts de terceros en ellas.
- Usa keys dedicadas, con tope de gasto, y rótalas al terminar.

### Precios y costo

El costo sale del host cuando lo reporta (SheLLM) o se estima con el precio por millón de tokens. Los modelos de Claude traen su precio de lista (con la fecha en que se revisó); para los demás puedes escribir uno en Configuración, y vale solo para ese modelo. Los modelos locales cuestan $0; si no hay precio, se dice «sin precio», nunca $0. Lo estimado lleva «≈».

En los hosts compatibles con OpenAI (SheLLM incluido) se puede elegir el **esfuerzo de razonamiento** de cada conexión (mínimo, bajo, medio o alto, o lo que diga el host; SheLLM usa medio con Claude desde la 1.16). Con SheLLM 1.16 o más nuevo, el inspector y el banco muestran además los tokens que salieron de la caché y los que fueron razonamiento, y cuánto esperó cada petición en la cola del propio SheLLM (columna **Cola del host**), para separar la espera del modelo de la del servidor.

Con Anthropic, cada decisión usa la **caché de prompts**: las instrucciones y el anuncio (con la lista de vecinos) son iguales para todo el pueblo y van primero, marcados para la caché; lo propio de cada residente va después. Leer de la caché cuesta la décima parte y escribirla un cuarto más. El inspector muestra los tokens leídos y escritos, y el banco una columna **Caché** con la parte del prompt que salió de ella y lo que ahorró. Para medirlo, añade el mismo modelo con la casilla **Sin caché** (o `-m anthropic:modelo~no-cache` en la terminal) y compara. Anthropic solo guarda prefijos a partir de un mínimo de tokens que depende del modelo; por debajo, la columna queda en «—».

### Banco de pruebas

El botón **Pruebas** compara modelos con los mismos pregones y residentes. Una semilla fija reconstruye el mismo pueblo en el mismo momento, así que todos reciben prompts idénticos, hoy o dentro de un mes. Antes de correr, estima el costo con los prompts reales. Mide:

- **Formato**: respuestas con el JSON pedido sin arreglos, y qué falló cuando no.
- **Consistencia**: con 2+ repeticiones, cuánto repite cada residente su decisión.
- **Acierto**: si cree lo que de verdad pasó (cada pregón de ejemplo tiene su verdad), cuántas mentiras se tragó y de cuántas verdades dudó.
- **Personaje**: decisiones que no contradicen la personalidad; el informe dice quién rompió qué regla (`src/core/bench/coherence.ts`).
- **Casos de oro**: 10 decisiones con una respuesta clara, elegidas solas (sin curar nada): donde la verdad del pregón, las reglas de personaje y el modo simulado coinciden, y pocas acciones encajan con el vecino. Acierta quien cree lo cierto y actúa como el personaje. La **prueba rápida** hace solo esas 10 preguntas por modelo: sirve para revisar un modelo nuevo por centavos.
- **Como las reglas**: coincidencia con el modo simulado, como referencia.
- **Personaje según el juez** (opcional, al terminar): otro modelo lee una muestra fija de decisiones, con la ficha del vecino, y dice de 1 a 5 si su razonamiento y sus palabras suenan a él, con una frase de por qué. Se guarda dentro de la corrida, entra en la comparación y muestra lo menos creíble de cada contendiente. Cuesta unas pocas consultas cortas por contendiente.
- **Rendimiento y costo**: primera palabra, respuesta (mediana y p95), peticiones y tokens por segundo, tokens totales y por decisión, costo total y por 1.000 decisiones. El mejor modelo de cada columna va resaltado.

La pestaña **Duelo de Baronesas** pone a gobernar el mismo año, con la misma semilla, dificultad y golpes del destino, al trono vacío, a las reglas y a los modelos que añadas. Estima el costo antes de empezar, muestra la tabla de resultados y cuatro gráficas (vecinos, confianza, ánimo y tesoro) con el cursor sincronizado, junto con las cartas que cada una escribió. El duelo sigue corriendo aunque cambies de pestaña, y se exporta en JSON (el mismo formato que `npm run reign`).

Las pruebas se guardan en este navegador (IndexedDB), el historial resume cada una (quién acertó más, cuánto costó, errores) y se exportan en JSON o CSV. Para compartirlas entre máquinas:

- **Carpeta compartida** (Chrome y Edge): enlaza una carpeta sincronizada (iCloud, Dropbox, Drive) y cada prueba se guarda ahí como JSON; otra máquina que enlace la misma carpeta las ve, y lo que llega se queda también en el navegador. Con `AI_TOWN_RUNS_DIR` apuntando a esa carpeta, `npm run bench` guarda ahí sus corridas.
- **Exportar todo / Importar**: el historial completo en un solo archivo, y la importación acepta varios archivos a la vez, sean corridas sueltas o lotes. La pestaña **Comparar** pone lado a lado dos contendientes de cualquier prueba (el mismo modelo en dos días o dos modelos) y marca cada métrica como mejor, peor o igual, con qué residentes cambiaron de decisión.

### Desde la terminal

Las keys y hosts salen de `.env` / `.env.local` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SHELLM_HOST`, `SHELLM_KEY`, `CUSTOM_LLM_HOST`, `CUSTOM_LLM_KEY`, `CUSTOM_LLM_PROTOCOL`). Un contendiente se escribe `proveedor:modelo[@host][=entrada/salida]`; el precio tras `=` es el de ese modelo, y `--price` aplica a los que no traen el suyo.

```bash
npm run bench -- -m shellm:claude -m shellm:codex -r 3 -c 16
npm run bench -- -m anthropic:claude-opus-5 -m custom:llama3.2@http://localhost:11434 -s banquet,troll
npm run bench -- -m shellm:claude -m shellm:codex --judge anthropic:claude-opus-5 --samples 12
npm run bench -- --quick -m anthropic:claude-sonnet-5 -m custom:llama3.2@http://localhost:11434
npm run bench -- --compare bench-results/antes.json bench-results/despues.json
npm run reign -- -m anthropic:claude-sonnet-5 -m custom:qwen3@http://mi-servidor:8000=0.2/0.6 --seed 12
npm run reign -- --difficulty cruel --seed 12
npm run reign -- --dry-run --seed 12
npm run reign -- --world aguamansa --difficulty hard
```

`npm run bench` corre el banco sin navegador, guarda la corrida en `bench-results/` (se importa en el historial) y Ctrl+C cancela guardando lo que alcanzó. `npm run reign` es el **duelo de gobernantes**: varios gobernantes llevan el mismo año con la misma semilla, la misma dificultad y el mismo calendario del destino, junto al trono vacío y las reglas como referencia, y al final muestra quién terminó el año, vecinos, asaltos, confianza, mentiras, fallos de formato, costo, un puntaje y las cartas que escribieron. Los dos aceptan `--world` para jugar en otro mundo.

## Atajos

| Tecla | Qué hace |
|---|---|
| `T` | Abre o cierra el Trono |
| `G` | Abre o cierra el modo dios |
| `B` | Abre la bitácora |
| `+` / `-` / `0` | Acerca, aleja o encuadra el mapa |
| `Esc` | Cierra la ficha del residente, o el cajón o diálogo en el que estás |
| `⌘ ↵` / `Ctrl ↵` | Pregona lo escrito |
| Flechas (con el mapa enfocado) | Mueven el mapa |
| `N` / `P` (con el mapa enfocado) | Van al vecino siguiente o anterior: abren su ficha, lo siguen con la cámara y dicen dónde está y qué hace |

### Accesibilidad

Todo se puede usar con teclado. El primer `Tab` ofrece **ir a escribir un pregón** y el siguiente enfoca el mapa, que se recorre con las teclas de arriba. Para lectores de pantalla, el mapa es una región con instrucciones y anuncia a cada vecino al recorrerlo; las decisiones y el desenlace se anuncian en una región viva, y mientras hay un diálogo abierto lo de detrás queda inerte. Los colores de texto pasan el contraste AA (4.5:1) y, con «reducir movimiento», la cámara salta en vez de volar.

## Estructura

```
src/
  core/        dominio puro, sin DOM: mundo, simulación, reacciones, economía, reino, memoria y banco de pruebas
  providers/   quién decide: reglas (mock.ts), modelos (llm/), la Baronesa (ruler.ts) y los pensamientos (musing.ts)
  worlds/      paquetes de mundo: contenido (mapa, lugares, residentes, ejemplos, vocabulario) y arte
  render/      escena isométrica con PixiJS; dibuja lo genérico y le pide al arte del mundo lo demás
  theme/       tokens de presentación compartidos por el mapa y la interfaz
  app/
    town.ts        el controlador: única puerta de la interfaz hacia la simulación y el mapa
    throne.ts      la Baronesa: decretos, su turno diario, pregones, cartas, gremio y revuelta
    terrarium.ts   el pueblo solo: destino, eventos en curso y vecinos que piensan
    keys.ts        las keys cifradas: guardar, abrir y volver a cifrar
    store/         estado de la interfaz en partes (ui, composer, experiment, settings, god, reign)
    features/      una carpeta por pieza de la interfaz, cada una con su CSS
    shared/, shell/  componentes reutilizables y layout general
scripts/       herramientas de terminal: bench, reign, mapa y pruebas de humo
server/        proxy de modelos para el servidor de Vite
tests/         tests del núcleo, independientes del mundo activo
docs/          diseño del terrario y revisión de la 1.0
```

**Crear o cambiar el mundo.** Todo lo del pueblo vive en `src/worlds/<nombre>/`: `layout.ts` (mapa y edificios), `index.ts` (lugares, residentes, quién habla, ejemplos, vocabulario, economía y `realm`: quién gobierna, cómo se le nombra, qué gremio conspira y quién pide qué) y `art/` (cómo se dibuja; el kit de Chismeroble dibuja por tipo y se puede reutilizar). Los mundos se registran en `WORLDS` de `src/worlds/index.ts`; con más de uno, Configuración deja cambiar de mundo y cada uno guarda su partida. El núcleo no nombra a ningún pueblo ni gobernante: todo sale del mundo, y `tests/worlds.test.ts` lo comprueba con un reino inventado.

## Desarrollo

- `npm test`: tests unitarios; `npm run test:coverage` además mide la cobertura del núcleo, los proveedores y el guardado, y falla si baja del mínimo.
- `npm run typecheck` y `npm run build`.
- `npm run map`: imprime el mapa generado en ASCII.
- `npm run sim:smoke`: corre 3 minutos de simulación sin interfaz.
- `npm run perf -- [--world aguamansa] [--days 3] [--speed 16]`: simula días enteros a la velocidad que digas, con un pregón cada medio día, y da cuánto cuesta la lógica por cuadro (p50, p95, p99 y máximo). Añadir `?perf` a la dirección de la app muestra un medidor con cuadros por segundo, lógica, dibujo, objetos y memoria, para probar en un teléfono o a ×16.
- `npx tsx scripts/reaction-smoke.ts [banquet|troll|crypt|dragon]`: pasa los pregones de ejemplo por el motor en modo simulado.
- `npm run fake-llm`: un LLM falso compatible con OpenAI en `http://127.0.0.1:6199` para probar el flujo de un modelo sin gastar; responde como vecino, como gobernante, como juez o con una petición según el prompt. Con `FAKE_KEY=…` exige esa key, para ensayar errores de autenticación.

**Rendimiento medido** (portátil, 120 Hz, Chismeroble): a ×16, con el terrario en automático, cuatro eventos a la vez y un pregón con todo el pueblo reaccionando, cada cuadro gasta unos 0,4 ms en la lógica y 2,4 ms en dibujar, de 8,3 ms disponibles. En una partida larga los objetos del escenario se mantienen en unos 2.230, la memoria no crece y las texturas de texto de los globos se reutilizan (se estabilizan en torno a 115). Sin navegador, la lógica cuesta 0,11 ms en el 1 % de cuadros más lentos a ×16 y 0,22 ms a ×64.

Cada PR corre en GitHub Actions el typecheck, los tests con cobertura y el build. Cada push a `main` publica en GitHub Pages (`.github/workflows/deploy.yml`; en el repo, **Settings → Pages → Source: GitHub Actions**). Cómo proponer cambios y publicar una versión está en [CONTRIBUTING.md](CONTRIBUTING.md).
