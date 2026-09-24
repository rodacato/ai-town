# El Terrario de Chismeroble

Un mundo que corre solo, con dos manos dentro: **tú eres el destino** (el panel de dios: clima, estaciones, desastres, eventos) y **una IA gobierna como la Baronesa Isolda** (leyes, pregones, impuestos, comida). Los habitantes viven, comen, sufren, opinan y recuerdan; la **reputación** de la Baronesa es el termómetro que junta todo.

## Principios

- **Núcleo puro y reproducible:** semilla + calendario de eventos = la misma historia, para repetirla y comparar.
- **La IA solo actúa con herramientas validadas:** nunca toca el estado directamente.
- **Costo acotado y visible:** en el terrario solo la Baronesa usa modelo (una llamada por día del juego); los habitantes, las reglas locales.
- **Todo se mide y queda en la crónica.**

## Fases

1. **Memoria y reputación.** El pueblo recuerda pregones con verdad revelada y eventos vistos; cada pregonero tiene reputación; entra al prompt y al modo simulado; se guarda en el navegador. El banco de pruebas no la usa.
2. **Economía y necesidades.** Oro (tesoro real y bolsas), comida (granero: huerto, pan, caza; consumo diario; estaciones; desastres), ánimo; hambre → enfermedad → se va o muere; libro de cuentas al amanecer; indicadores arriba.
3. **El trono, jugable por una persona.** Impuestos, salarios, reparto de comida y decretos (toque de queda, racionamiento, fiesta, leva de guardias).
4. **La Baronesa como agente IA.** Informe diario con información imperfecta (retrasos y rumores), herramientas (`pregonar`, `decretar`, `fijar_impuesto`, `pagar_salarios`, `repartir_comida`, `pedir_al_creador`), peticiones de los habitantes, Salón del trono con su razonamiento, Buzón de la Baronesa (nunca se aplica solo) y honestidad medida con la verdad revelada.
5. **Poder y conflicto.** Gremio de ladrones que conspira con el ánimo bajo; revuelta si la reputación cae; victoria por días o puntaje; pantalla final.
6. **Modo terrario.** Corre solo, calendario de eventos con semilla, crónica narrada, guardar/cargar y línea de tiempo.
7. **Duelo de gobernantes.** Misma semilla y calendario para dos modelos; CLI `npm run reign`; días, reputación, muertes, mentiras, tesoro y costo.
