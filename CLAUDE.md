# PokeSave

Editor web de partidas de Pokémon. Se sube un `.sav`, se ve y edita en el navegador y se
descarga de nuevo. **La partida nunca sale del dispositivo**: todo se procesa con PKHeX.Core
compilado a WebAssembly. Especificación completa: `editor-sav-pokemon-especificacion.pdf`.

Licencia GPL-3.0 (obligatoria por PKHeX.Core).

## Estado

- **Fase 0 (prueba técnica): hecha.** Rama `fase-0`. Carga de partida, detección de juego y
  generación, entrenador, equipo, Pokédex y PC en solo lectura, copia del original.
- Siguiente: Fase 1 (MVP del editor). Antes de empezar, proponer un plan y esperar confirmación.

## Estructura

```
src/PokeSave.Core/    Lógica de partidas (C#, net10.0). Única capa que usa PKHeX.Core.
  SaveSession.cs        Abrir, resumir y exportar una partida.
  SaveSummary.cs        DTOs que se mandan a la UI + contexto JSON con generador de código.
src/PokeSave.Wasm/    Puente browser-wasm. Expone `Engine` a JS con [JSExport].
tests/PokeSave.Core.Tests/   xUnit. Partidas generadas, nunca reales.
tests/saves-local/    Tus partidas reales para probar en local (en .gitignore).
web/                  Frontend: Vite + React + TypeScript.
  src/engine.ts         Carga perezosa del runtime .NET y API tipada.
  src/i18n.ts           Textos en español e inglés.
  src/theme.ts          Colores por juego y por especie.
  src/components/       Vista de partida e iconos/gráficos propios.
  scripts/build-engine.mjs   Publica PokeSave.Wasm y copia _framework a web/public.
  vite.config.ts        Middleware que sirve /_framework tal cual en desarrollo.
```

## Cómo compilar y ejecutar

Requisitos: .NET SDK 10, workload `wasm-tools` (`dotnet workload install wasm-tools`), Node 24.

```bash
cd web
npm install
npm run engine     # compila el motor .NET a WASM (necesario la primera vez y tras cambiar C#)
npm run dev        # http://localhost:5173
npm run build      # web estática en web/dist
```

## Publicar en GitHub Pages

`.github/workflows/pages.yml` compila el motor, pasa los tests y publica `web/dist` en cada push
a `main`. Hay que activar una vez **Settings → Pages → Source: GitHub Actions**. La web queda
en `https://<usuario>.github.io/<repositorio>/` (la base se pasa con `vite build --base`).

GitHub Pages no sirve los `.br`/`.gz` precomprimidos, así que `engine.ts` pide él mismo los
`.gz` y los descomprime con `DecompressionStream` (~5,4 MB en lugar de ~20 MB). Si falla, usa
la URL normal. En local, con Git Bash, usar `MSYS_NO_PATHCONV=1` al pasar `--base /x/`.

## Tests

```bash
dotnet test                 # desde la raíz
cd web && npm run typecheck && npm run lint
```

## Decisiones

- **JSExport + TypeScript (opción B), no Blazor.** El motor .NET solo hace de librería y la UI
  es React normal. Más control del diseño y del tamaño de la primera carga (la interfaz pesa
  ~77 KB gzip y se pinta antes de que llegue el motor).
- **PokeSave.Core separado de PokeSave.Wasm.** La lógica se prueba con xUnit en .NET normal, sin
  navegador. El proyecto WASM solo serializa y pasa bytes.
- **JSON con generador de código** (`PokeSaveJson`): compatible con trimming, sin reflexión.
- **Sprites desde PokéAPI, no desde el repositorio.** `theme.ts → spriteUrl` enlaza a
  `raw.githubusercontent.com/PokeAPI/sprites` (animados de Blanco/Negro hasta #649, estáticos
  después). Ninguna imagen oficial se guarda en el repo. Si no cargan (sin conexión, huevo,
  especie sin sprite) se dibuja el "orbe" propio. Contrapartida: el navegador pide a GitHub los
  sprites de las especies del equipo; la partida en sí no sale del dispositivo. Las formas
  regionales aún no se distinguen.
- **Robustez:** un dato ilegible (p. ej. dinero en un bloque que falta) sale como `null` en vez
  de impedir abrir la partida.
- **No se filtra por tamaño de archivo** antes de abrir: las partidas de Switch no tienen
  tamaño fijo. Se delega en `SaveUtil.TryGetSaveFile`.
- El motor se carga en el hilo principal. Leer la partida tarda ~0,9 s la primera vez (sobre
  todo el análisis de legalidad). Si molesta al editar, moverlo a un Web Worker.

## Mediciones de la Fase 0

Motor publicado con `PublishTrimmed`, `TrimMode=full`, `InvariantGlobalization`, Webcil y
`wasm-tools` (relink nativo). 25 archivos.

| | Sin comprimir | gzip | Brotli |
|---|---|---|---|
| Motor completo | 19,7 MB | 5,4 MB | **3,5 MB** |
| de ello PKHeX.Core | 15,7 MB | 3,9 MB | 2,3 MB |
| Runtime nativo .NET | 1,5 MB | 0,6 MB | 0,5 MB |
| Interfaz (JS + CSS) | 259 KB | 81 KB | — |

- Sin `wasm-tools` el runtime nativo pesaba 3,0 MB (0,98 MB Brotli); el total Brotli era 4,0 MB.
- PKHeX.Core es lo que más pesa: lleva tablas de legalidad y textos de todos los idiomas.
  Posible mejora futura: recortar idiomas o cargar recursos bajo demanda.
- El hosting debe servir los `.br`/`.gz` precomprimidos (Cloudflare Pages y Netlify comprimen
  solos). `vite preview` no lo hace: en local se descargan los 19,7 MB.
- Tiempos en local (escritorio): motor listo en ~0,3 s con caché; primera lectura de partida
  ~0,9 s.
- PKHeX.Core avisa de que no es 100 % seguro con trimming (IL2104). Probado: carga, resumen,
  legalidad y exportación funcionan con `TrimMode=full`. Si aparece un fallo raro en otra
  generación, probar `<TrimmerRootAssembly Include="PKHeX.Core" />`.

## Hallazgos sobre los tests

Las partidas en blanco de PKHeX (`BlankSaveFile`) no son iguales que una real:

- Solo B/W, B2/W2 y BDSP se vuelven a **detectar** desde sus bytes. Con esos se prueba el ciclo
  completo bytes → detección → exportar → bytes (idénticos sin cambios; con cambios, se
  conservan y los checksums son válidos).
- Gen 3 y 4: PKHeX no puede ni escribir la partida en blanco.
- Gen 1, 2, 6, 7, SwSh, PLA, SV, ZA: se prueban resumen y edición sobre el objeto, no la
  detección.
- PLA y SV en blanco no tienen bloque de dinero.
- Para probar la detección en el resto de juegos, poner partidas propias en `tests/saves-local/`.

## Normas de trabajo

- No pasar de fase hasta que la anterior funcione y esté probada.
- Una rama por fase, commits pequeños y descriptivos.
- Proponer un plan breve antes de cada fase y esperar confirmación.
- Preguntar antes de añadir dependencias o servicios externos.
- Nunca subir ROMs, partidas reales ni assets oficiales.
