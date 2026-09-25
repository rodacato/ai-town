# El Terrario de Chismeroble

Un mundo que corre solo, con dos manos dentro: **tú eres el destino** (el panel de dios: clima, estaciones, desastres, eventos) y **una IA gobierna como la Baronesa Isolda** (leyes, pregones, impuestos, comida). Los habitantes viven, comen, sufren, opinan y recuerdan; la **reputación** de la Baronesa es el termómetro que junta todo.

## Principios

- **Núcleo puro y reproducible:** semilla + calendario de eventos = la misma historia, para repetirla y comparar.
- **La IA solo actúa con herramientas validadas:** nunca toca el estado directamente.
- **Costo acotado y visible:** en el terrario la Baronesa usa modelo (una llamada por día del juego, con tope por partida) y los habitantes, las reglas locales, salvo que se pida lo contrario. La bitácora dice qué gastó cada quien.
- **Todo se mide y queda en la crónica.**

## Fases

Todas están hechas desde la 1.0.0; el detalle de cómo se juega está en el README.

1. **Memoria y reputación.** El pueblo recuerda pregones con verdad revelada y eventos vistos; cada pregonero tiene reputación; entra al prompt y al modo simulado; se guarda en el navegador. El banco de pruebas no la usa.
2. **Economía y necesidades.** Oro (tesoro real y bolsas), comida (granero: huerto, pan, caza; consumo diario; estaciones; desastres), ánimo; hambre → enfermedad → se va o muere; libro de cuentas al amanecer; indicadores arriba.
3. **El trono, jugable por una persona.** Impuesto, precio de la ración, reparto y compra de comida, paga extra, fiesta y leyes (toque de queda, racionamiento, leva de guardias).
4. **La Baronesa como agente IA.** Informe diario con información imperfecta (retrasos y rumores), acciones en JSON (`proclaim`, `set_tax`, `set_ration_price`, `hand_out_food`, `buy_food`, `bonus`, `festival`, `law` y `ask_creator`, hasta tres por día), peticiones de los habitantes, Salón del trono con su razonamiento, Buzón de la Baronesa (nunca se aplica solo) y honestidad medida con la verdad revelada.
5. **Poder y conflicto.** Gremio de ladrones que conspira con el ánimo bajo y el tesoro lleno; revuelta tras días de descontento; derrota si el pueblo queda desierto; victoria al cumplir un año; pantalla final. La guardia cuenta como hecho de la Baronesa: protege o falla, y la confianza lo sigue.
6. **Modo terrario.** Corre solo, calendario de eventos con semilla, eventos que duran y cobran al terminar, vecinos que piensan solos, crónica con gráficas, bitácora, guardar y cargar.
7. **Duelo de gobernantes.** Misma semilla y calendario para varios modelos; CLI `npm run reign`; final, vecinos, asaltos, confianza, mentiras, formato, costo y puntaje.
