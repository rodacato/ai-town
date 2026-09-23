# AI Town

Simulación de un pueblo isométrico habitado por residentes con personalidad propia. Haces un anuncio público y ves cómo reacciona cada uno.

## Desarrollo

```bash
npm install
npm run dev
```

- `npm run map`: imprime el mapa generado en ASCII.
- `npm run sim:smoke`: corre 3 minutos de simulación sin interfaz.

## Estructura

- `src/sim/`: motor puro en TypeScript (mundo, pathfinding, rutinas). No depende de React ni de Pixi.
- `src/render/`: escena isométrica con PixiJS (terreno, edificios, residentes, ambiente, cámara).
- `src/ui/`: interfaz en React.
- `src/data/`: el pueblo y sus 16 residentes.
