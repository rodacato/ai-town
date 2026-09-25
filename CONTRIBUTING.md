# Cómo contribuir

Gracias por querer mejorar AI Town. Esta guía explica cómo preparar el entorno, cómo está organizado el código y qué se espera de un cambio.

## Entorno

Hace falta Node 24.

```bash
npm install
npm run dev
```

La app abre en `http://localhost:5173`. Sin keys funciona en modo simulado; para probar el flujo de un modelo sin gastar, levanta el LLM falso con `npm run fake-llm` y conéctalo como servicio personalizado.

Las keys para la terminal (`npm run bench`, `npm run reign`) van en `.env.local`, que no se sube al repo:

```
ANTHROPIC_API_KEY=…
OPENAI_API_KEY=…
SHELLM_HOST=… SHELLM_KEY=…
CUSTOM_LLM_HOST=… CUSTOM_LLM_KEY=… CUSTOM_LLM_PROTOCOL=openai
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con el proxy de modelos |
| `npm run typecheck` | Comprueba los tipos |
| `npm test` | Tests unitarios |
| `npm run test:coverage` | Tests con cobertura; falla si baja del mínimo |
| `npm run build` | Build de producción en `dist/` |
| `npm run bench -- --help` | Banco de pruebas en la terminal |
| `npm run reign -- --help` | Duelo de gobernantes en la terminal |
| `npm run perf -- --help` | Cuánto cuesta simular días enteros a ×16, sin navegador |
| `npm run fake-llm` | LLM falso compatible con OpenAI en el puerto 6199 |

## Organización

El código va por capas, de la más pura a la más concreta. Una capa solo importa de las de arriba:

1. `src/core/`: el dominio sin DOM ni red: mundo, simulación, reacciones, economía, reino, memoria y banco de pruebas. Es determinista dada una semilla y es donde van la mayoría de los tests.
2. `src/providers/`: quién decide: reglas locales y modelos (`llm/`: conexión, prompts, lectura de respuestas, precios y bóveda de keys).
3. `src/worlds/`: el contenido de cada mundo (mapa, residentes, ejemplos, arte).
4. `src/render/`: la escena con PixiJS.
5. `src/app/`: la interfaz en React. `town.ts` es la única puerta de la interfaz hacia la simulación; `store/` guarda el estado de la interfaz; `features/` tiene una carpeta por pieza, cada una con su CSS.

`scripts/` son las herramientas de terminal y `server/` el proxy de Vite hacia los proveedores.

## Estilo

- TypeScript estricto; nada de `any` sin motivo.
- Nombres que se expliquen solos. Los comentarios son pocos y dicen el porqué, no el qué.
- **Idioma: el código en inglés, lo que se lee en español.**
  - En inglés: nombres de archivos, variables, funciones, tipos y propiedades; valores que funcionan como identificadores (tonos, dificultades, ids, claves de `localStorage`, clases CSS); flags de la terminal; las claves del JSON que se pide a los modelos; comentarios, tests y mensajes de commit del código.
  - En español: todo lo que lee una persona (la interfaz, la ayuda de la terminal, la crónica, los mensajes de error) y el texto de los prompts. Si un valor en inglés se muestra, se traduce al mostrarlo con una tabla de etiquetas, nunca se usa la etiqueta como identificador.
  - Las descripciones de los PR y el CHANGELOG van en español.
- Funciones cortas con una responsabilidad; la lógica de juego va en `core`, no en componentes.
- Nunca guardar keys en claro ni mandarlas a otro sitio que no sea su proveedor.

## Tests

- Todo cambio de lógica en `core` o `providers` lleva su test en `tests/`.
- Los tests prueban comportamientos que importan (qué pasa en el juego), no detalles internos.
- Lo aleatorio se prueba con semilla o inyectando la función `rand`.
- `npm run test:coverage` debe pasar: el mínimo está en `vitest.config.ts`.

## Cambios y pull requests

1. Crea una rama desde `main` actualizada.
2. Haz commits pequeños con mensajes que digan qué cambia y por qué.
3. Antes de abrir el PR: `npm run typecheck`, `npm run test:coverage` y `npm run build`.
4. Abre el PR contra `main` con una descripción en español: qué cambia, por qué y cómo se probó. CI corre lo mismo en cada PR.
5. Si el cambio se nota para quien usa la app, añádelo a `CHANGELOG.md` bajo **Sin publicar**.

Al mezclar en `main`, GitHub Pages publica la app.

## Publicar una versión

Se sigue [Versionado Semántico](https://semver.org/lang/es/) y [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

1. En `CHANGELOG.md`, pasa lo de **Sin publicar** a una sección nueva `## [X.Y.Z] - AAAA-MM-DD` y actualiza los enlaces del final.
2. Cambia `version` en `package.json` (`npm version X.Y.Z --no-git-tag-version`).
3. Abre un PR con esos cambios y mézclalo.
4. Etiqueta y publica desde `main`:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md | sed '$d')
```
