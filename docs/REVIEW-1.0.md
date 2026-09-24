# Revisión 360 para la 1.0.0

Lista de control para cerrar la versión 1.0.0. Se marca cada punto al terminarlo; lo que se decida no hacer queda anotado abajo con el motivo.

## 1. Consistencia y conexiones
- [x] Un decreto pregonado como cierto dispara eventos por palabras clave: «monedas» se lee como tesoro (+60 de oro regalado) y «fiesta» como festín (grano cobrado dos veces)
- [x] Nueva partida arrastra estado viejo: `nextMuseAt`, turno de la Baronesa o pensamiento en curso, crónica en pantalla, temporizadores pendientes
- [x] La bitácora guarda entradas «pensando…» que tras recargar quedan colgadas para siempre
- [x] Pregones de la Baronesa en cola se pierden al recargar aunque la honestidad ya los contó
- [x] La velocidad no se guarda: una partida en pausa vuelve a ×2
- [x] El primer amanecer de una estación cosecha con la tasa de la estación anterior
- [x] El reinado sin mapa diverge de la app: estación inicial, hora y duración de los golpes del destino, nombres en la crónica, decretos fallidos
- [x] `recordDay` guarda acciones y fallos en cero
- [x] `speakerShort` corta «Sir Aldric» en «Sir»
- [x] El tooltip del granero puede mostrar «Infinity»
- [x] «Reiniciar y probar otro…» del pregón activo borra toda la partida
- [ ] README y `docs/TERRARIO.md` al día con el código (herramientas de la Baronesa, ejemplos de `reaction-smoke`, partes del store, botones que se movieron)

## 2. Interfaz y experiencia para comparar modelos
- [ ] Precio por modelo, no por conexión: al comparar dos modelos del mismo servicio se cobran al mismo precio (también `--price` en la terminal)
- [ ] Tabla de precios al día (el modelo por defecto `claude-opus-5` no tiene precio), con fecha visible
- [ ] «Sin precio» distinto de «gratis»; los modelos locales cuestan $0
- [ ] Estimar el costo antes de correr una prueba
- [ ] Columnas de costo por 1.000 decisiones, tokens por decisión y primera palabra p50 en los resultados
- [ ] Mejor valor de cada columna resaltado
- [ ] Costo con el mismo formato en todas partes (banco, bitácora, Trono, terminal) y «≈» solo cuando es estimado
- [ ] Bitácora: separar el gasto de la Baronesa del de los vecinos; mostrar tokens
- [ ] Latencia etiquetada igual en todas partes (mediana o media)
- [ ] Nombres coherentes para el modo sin modelo («Reglas» en todas partes)
- [ ] Historial y comparación de corridas más fáciles de leer

## 3. BYOK sólido
- [x] Al recargar se ve qué keys faltan y se piden (aviso al abrir la app)
- [x] Desbloqueo de keys guardadas al abrir la app
- [x] Guardar cifradas con una frase, recomendado; una vez abiertas, cada cambio se vuelve a cifrar
- [x] Una bóveda bloqueada nunca se sobrescribe vacía
- [x] La barra dice «sin key» cuando el modelo no puede responder; la Baronesa pasa a reglas
- [x] Olvidar las keys pide confirmación
- [x] Derivación más fuerte (600.000 iteraciones) compatible con bóvedas anteriores, con versión
- [x] El proxy de desarrollo dice qué keys tiene en `.env`, sin falsas alarmas
- [x] Tests del ciclo: guardar, recargar, desbloquear, volver a cifrar, no sobrescribir

## 4. Calidad del código
- [ ] Código muerto: icono `Home`, `screenToTile`, exports usados solo en su archivo, CSS sin uso
- [ ] Duplicados: hora del día, nombres de leyes, iconos de estación, velocidades, nombre por id, formato de costo y de segundos, recorte de texto
- [ ] `src/app/town.ts` (~830 líneas) separado por responsabilidad
- [ ] Funciones largas: `drawProp`, `SettingsModal`, `BenchModal`, `enact`, `mockDecision`
- [ ] `scripts/print-map.ts` sin leyenda para los objetos nuevos
- [ ] Tests con azar sin semilla o que dependen del contenido; tests duplicados
- [ ] Tests nuevos: guardar y restaurar eventos y bitácora, partidas viejas o corruptas, golpes del destino y eventos en curso, estaciones, pensamientos con modelo, precios desconocidos, `parseRulerTurn` y `parseMusing` en los bordes, puntaje del duelo
- [ ] Cobertura también sobre `townState` y `memoryStorage`
- [ ] Typecheck, build y tests limpios en CI

## 5. Publicación
- [x] `CHANGELOG.md` siguiendo keepachangelog.com
- [x] `CONTRIBUTING.md`, con cómo publicar una versión
- [x] `LICENSE.md` (MIT)
- [ ] Versión 1.0.0 en `package.json`
- [ ] README al día: qué es, cómo se juega, cómo se comparan modelos, BYOK, documentación enlazada

## Deuda técnica aceptada

(se llena durante la revisión)
