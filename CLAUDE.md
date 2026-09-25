# AI Town

Guía completa para contribuir: [CONTRIBUTING.md](CONTRIBUTING.md). Lo que un agente debe tener siempre presente:

- **Código en inglés, lo que se lee en español.** Identificadores, valores que funcionan como ids o tipos, flags de la terminal, claves del JSON que se pide a los modelos, comentarios y tests: en inglés. La interfaz, la ayuda de la terminal, la crónica, los errores y el texto de los prompts: en español, traduciendo los valores al mostrarlos. Los PR y el CHANGELOG, en español.
- **Servidores y procesos:** detén el servidor de desarrollo o de vista previa, el LLM falso y cualquier proceso en segundo plano en cuanto dejes de usarlos, y siempre antes de terminar tu turno. Para pruebas que cambian la partida (avanzar el tiempo, cambiar de mundo, consultar a la gobernante), usa otro puerto que el 5173: ahí vive la partida guardada de quien mantiene el repo.
- Antes de un PR: `npm run typecheck`, `npm run test:coverage` y `npm run build`.
- Un cambio por rama y por PR; quien mantiene el repo decide cuándo mezclar.
