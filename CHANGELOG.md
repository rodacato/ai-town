# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

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
- Modo dios: hora, velocidad, estación, clima, eventos y acciones sobre el pueblo.

#### Comparar modelos
- Conexiones a Anthropic, OpenAI, SheLLM y cualquier servicio compatible (Ollama, LM Studio…), directas o por el proxy local de Vite.
- Keys propias (BYOK), con opción de guardarlas cifradas con una frase.
- Banco de pruebas en el navegador y en la terminal (`npm run bench`): formato, consistencia, acierto contra la verdad, coherencia de personaje, latencia (primera palabra, p50, p95), tokens por segundo y costo.
- Comparar dos corridas guardadas, con cambios de decisión y avisos de lo que no es comparable.
- Duelo de gobernantes (`npm run reign`): varias Baronesas gobiernan el mismo año con la misma semilla, con puntaje y costo.

[Sin publicar]: https://github.com/rodacato/ai-town/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rodacato/ai-town/releases/tag/v1.0.0
