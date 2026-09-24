# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Dificultad al empezar una partida y en el duelo (`--dificultad`): **normal**, **dura** o **cruel**. Cambia la frecuencia y el tipo de los golpes del destino, las reservas iniciales, la cosecha, cuánto duelen los golpes y el precio del grano de los mercaderes; la Baronesa lo ve en su informe.

- Duelo de Baronesas en el navegador, dentro del banco de pruebas: el trono vacío, las reglas y los modelos que elijas gobiernan el mismo año; tabla de resultados, gráficas de vecinos, confianza, ánimo y tesoro con el cursor sincronizado, cartas al creador, costo estimado y exportación en JSON. La terminal y el navegador corren el mismo código (`runDuel`).

- Juez de personaje en el banco de pruebas y en la terminal (`--juez`, `--muestras`): otro modelo puntúa de 1 a 5 si las decisiones de una muestra fija suenan a cada vecino, con su razón; se guarda en la corrida y entra en la comparación.
- Casos de oro: 10 decisiones con una respuesta clara que se eligen solas (verdad, reglas de personaje y modo simulado de acuerdo). Cada prueba los califica, entran en la comparación y la **prueba rápida** (`--rapida` en la terminal) hace solo esas 10 preguntas por modelo.
- Compartir pruebas entre máquinas: carpeta compartida (Chrome y Edge) donde cada prueba se guarda y se leen las que haya, «Exportar todo» en un solo archivo, importación de varios archivos o lotes a la vez, y `AI_TOWN_RUNS_DIR` para que `npm run bench` guarde en esa carpeta.
- Las corridas guardan el razonamiento de cada decisión (recortado).
- El LLM falso responde también como Baronesa y como juez.
- Caché de prompts de Anthropic: las instrucciones y el anuncio, iguales para todo el pueblo, se marcan para la caché. El inspector muestra los tokens leídos y escritos, el costo los cobra a su precio y el banco añade la columna **Caché** (parte del prompt servida y ahorro) y la variante **Sin caché** del mismo modelo (`~sin-cache` en la terminal) para medirlo.
- Memoria de cada vecino: recuerda quién le pasó mentiras que se creyó y quién le avisó a tiempo de algo cierto. Entra en su prompt (también junto a cada rumor que le llega), en las reglas locales (desconfía de quien le mintió y avisa primero a quien le debe) y en su ficha del inspector.
- Relaciones que cambian: dos mentiras rompen una amistad, dos avisos a tiempo reconcilian a rivales o hacen amigos nuevos, y una mentira de un desconocido deja rencor. Salen de la memoria de cada vecino, se anuncian en la crónica, se marcan en la ficha y las usan el prompt, los rumores y las reglas locales.
- Peticiones a la Baronesa escritas por el modelo de los vecinos: cada vecino con motivo la redacta con su voz, su situación y su confianza en ella; sin modelo, o si falla, usa sus palabras de siempre. Se anotan en la crónica y en la actividad, y quien más días lleva sin comer puede pedir por sí mismo. El LLM falso también responde peticiones.
- Buzón de la Baronesa completo: todas las cartas con quién las escribió, respuestas del creador que ella lee en su próximo informe, un archivo de ideas que sobrevive entre partidas y descarga en Markdown.
- Diseño para tablet y móvil: por debajo de 900 px el panel y los cajones se vuelven una hoja inferior, la barra superior se pliega en dos filas, las reacciones son una tira que se desplaza y el mapa se encuadra en el hueco que queda libre (y se reencuadra al plegar la hoja). Entre 900 y 1200 px el panel es más estrecho y la barra no se encima.
- Accesibilidad: el mapa se enfoca con `Tab` y se recorre con teclado (flechas para moverlo, `N`/`P` para ir de vecino en vecino, con su ficha y un anuncio de dónde está y qué hace), enlace para ir directo a escribir un pregón, y los diálogos dejan inerte lo de detrás para lectores de pantalla y teclado.
- Preparado para varios mundos: quién gobierna y cómo se le nombra, el gremio y su deudor, quién pide qué y dónde se hace la fiesta salen del mundo (`realm`), no del código. Registro de mundos con selector en Configuración (aparece con más de uno), y cada mundo guarda su partida.
- Segundo mundo, **Aguamansa**: un pueblo de pescadores a orillas de un lago, con 13 vecinos, playa, muelle, faro y arrozal, gobernado por un alcalde, con sus propios pregones de ejemplo, desenlaces, economía, peticiones y contrabandistas. Reutiliza el kit de arte de Chismeroble; se elige en Configuración y en la terminal con `--mundo`.
- La arena de la orilla se dibuja como arena.

### Cambiado
- Los peligros del destino y del modo dios, los lugares con techo o con ambiente de noche, dónde se entierra y por dónde se va la gente salen del mundo, no del código.
- El historial y la comparación del banco muestran solo las pruebas del mundo en el que estás, y avisan si hay de otros.
- El informe de la gobernante se titula «Informe de la corte»; el duelo se llama «Duelo de gobernantes».
- Contraste AA en el texto de acento (velocidad activa, «Gobierna», enlaces) y en las etiquetas de acción, y la barra de progreso del pregón tiene nombre.
- Las reglas de la Baronesa reconocen una petición por su tema, no por sus palabras, para que las redactadas por un modelo cuenten igual.
- El prompt de cada residente empieza por lo común (anuncio y vecinos) y sigue con lo suyo; las pruebas nuevas no reciben el mismo texto que las guardadas antes de este cambio.
- Lo que hace la guardia pesa la mitad que lo que dice la Baronesa en la confianza del pueblo, para que en años de muchos golpes la confianza no se infle sola.

## [1.0.0] - 2026-09-24

Primera versión estable: un pueblo simulado para probar y comparar modelos de lenguaje, y un terrario donde una IA gobierna.

### Añadido

#### El pueblo
- Chismeroble, una aldea isométrica de 40×40 con 20 residentes, cada uno con personalidad medible (credulidad, valentía, sociabilidad, autoridad y codicia), voz, valores, miedos, secreto y relaciones.
- Pregones de la Baronesa, de un vecino o de un forastero: cada residente decide qué hacer con un modelo de lenguaje o con reglas locales, y la noticia corre de boca en boca.
- Verdad y desenlace: cada pregón puede resultar cierto o falso y se revela en el mapa; quien creyó o dudó queda registrado.
- Memoria del pueblo y reputación de cada pregonero, que entran en lo que el modelo sabe.
- Ritmo diario (dormir, taberna, rutinas nocturnas), clima y cuatro estaciones con su aspecto.
- Doce eventos visibles en el mapa (dragón, bestia, esqueletos, lobos, fantasma, incendio, crecida, meteorito, ladrón, caravana, festín y tesoro), con duración al azar y costo o beneficio al terminar.

#### El reino
- Economía: tesoro, granero, oficios, impuestos, raciones y sueldos de la guardia; cuentas cada amanecer.
- Hambre, salud y ánimo por residente: quien pasa hambre se va o muere, con tumba en el cementerio.
- El Trono: decretos de impuestos, precio de la ración, reparto, compra de grano, paga, fiesta y leyes (toque de queda, racionamiento, leva de guardias).
- La Baronesa como agente: gobierna con reglas o con un modelo a partir de un informe con retraso y rumores, con tope de consultas, honestidad medida y un buzón de cartas al creador.
- Gremio de ladrones, revuelta, derrota por pueblo desierto y victoria al cumplir un año; pantalla final con balance.
- La guardia como hecho de la Baronesa: con leva, los golpes duelen la mitad y la confianza sube; sin ella, baja.
- Vecinos que piensan solos cada pocas horas, con el modelo o con reglas, y un globo sobre el mapa.

#### El terrario
- Modo terrario: el pueblo corre solo a ×16, con calendario del destino según semilla.
- Crónica por días con gráficas de vecinos, ánimo, confianza y tesoro.
- Bitácora con cada decisión: quién la tomó, cuánto tardó, cuántos tokens y cuánto costó.
- Guardar y cargar la partida en un archivo; la partida se conserva en el navegador hasta empezar otra.
- Modo dios: hora, estación, clima, eventos con su costo a la vista y acciones sobre el pueblo; pausa y velocidad en el centro de la barra.
- Atajos: `T` trono, `G` modo dios, `B` bitácora, `+`/`-`/`0` mapa.

#### Comparar modelos
- Conexiones a Anthropic, OpenAI, SheLLM y cualquier servicio compatible (Ollama, LM Studio…), directas o por el proxy local de Vite.
- Keys propias (BYOK) que nunca se guardan en claro: cifradas con una frase (PBKDF2 de 600.000 iteraciones y AES-GCM), pedidas al abrir la app y vueltas a cifrar con cada cambio; si falta una, la app lo dice y la barra marca «sin key».
- Precios de lista de los modelos de Claude con fecha de revisión, precio propio por modelo para los demás, $0 para modelos locales y «sin precio» cuando no se sabe.
- Banco de pruebas en el navegador y en la terminal (`npm run bench`): formato, consistencia, acierto contra la verdad, coherencia de personaje, primera palabra, respuesta (mediana y p95), tokens por segundo y por decisión, costo total y por 1.000 decisiones, con el mejor de cada columna resaltado y el costo estimado antes de correr.
- Comparar dos corridas guardadas, con cambios de decisión y avisos de lo que no es comparable.
- Duelo de gobernantes (`npm run reign`): varias Baronesas gobiernan el mismo año con la misma semilla, con puntaje y costo.

[Sin publicar]: https://github.com/rodacato/ai-town/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rodacato/ai-town/releases/tag/v1.0.0
