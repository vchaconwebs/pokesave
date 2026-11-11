# PokeSave

Editor web de partidas de Pokémon. Se sube un `.sav`, se ve y edita en el navegador y se
descarga de nuevo. **La partida nunca sale del dispositivo**: todo se procesa con PKHeX.Core
compilado a WebAssembly. Especificación completa: `editor-sav-pokemon-especificacion.pdf`.

Licencia GPL-3.0 (obligatoria por PKHeX.Core).

## Estado

- Publicado en https://vchaconwebs.github.io/pokesave/ (rama `main`).
- **Fase 0 (prueba técnica): hecha.** Rama `fase-0`. Carga de partida, detección de juego y
  generación, entrenador, equipo, Pokédex y PC en solo lectura, copia del original.
- **Fase 1 (MVP del editor): hecha.** Rama `fase-1`. Editar Pokémon (especie, nivel, mote,
  naturaleza, habilidad, movimientos, IVs, EVs, variocolor, objeto) del equipo y de las cajas,
  editar nombre y dinero del entrenador, medallas, cajas del PC, avisos de legalidad y exportar
  con copia del original obligatoria antes.
- **Fase 1 probada en emulador** por el usuario con su partida de Blanco (nivel 60, carga bien).
- **Fase 2 (edición ampliada): hecha.** Rama `fase-2`. Mochila por bolsillos con buscador,
  Pokédex (vistos/capturados, en bloque), exportar .pk* y Showdown, importar .pk* (también de
  otras generaciones) y Showdown en huecos vacíos, deshacer/rehacer (botones y Ctrl+Z/Ctrl+Y).
- Siguiente: Fase 3 (asistente de Pokédex, empezando por Blanco/Negro). Proponer un plan antes.

## Estructura

```
src/PokeSave.Core/    Lógica de partidas (C#, net10.0). Única capa que usa PKHeX.Core.
  SaveSession.cs        Abrir, resumir y exportar una partida.
  SaveSummary.cs        DTOs que se mandan a la UI + contexto JSON con generador de código.
  SaveSession.Editing.cs  Fase 1: leer/editar Pokémon, cajas, entrenador, medallas, listas.
  EditModels.cs         DTOs de edición (SlotRef, PokemonEdit, EditLimits, EditResult…).
  SaveSession.Phase2.cs   Fase 2: historial, mochila, Pokédex, importar/exportar .pk*/Showdown.
  Phase2Models.cs       DTOs de la Fase 2.
src/PokeSave.Wasm/    Puente browser-wasm. Expone `Engine` a JS con [JSExport].
tests/PokeSave.Core.Tests/   xUnit. Partidas generadas, nunca reales.
tests/saves-local/    Tus partidas reales para probar en local (en .gitignore).
web/                  Frontend: Vite + React + TypeScript.
  src/engine.ts         Carga perezosa del runtime .NET y API tipada.
  src/i18n.ts           Textos en español e inglés.
  src/theme.ts          Colores por juego y por especie.
  src/components/       Vista de partida, editor de Pokémon (PokemonEditor), cajas del PC,
                        entrenador y exportación (Panels), controles (Modal, Combobox…).
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

Para relanzar el despliegue a mano: `gh workflow run pages.yml -R vchaconwebs/pokesave --ref main`.

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
- **Diseño "de videojuego":** portada con una Pokédex dibujada en CSS (la lente y los LED
  indican el estado del motor), Tarjeta de Entrenador, pantallas LCD para las estadísticas,
  cuadros de diálogo como en los juegos y tarjetas de equipo coloreadas por tipo. Fuentes
  Fredoka y Press Start 2P empaquetadas con `@fontsource` (no se piden a Google Fonts).
- **Tipos:** `PokemonInfo.Types` y `MoveSlot.Type` usan la numeración de PKHeX (0 Normal …
  17 Hada). En Gen 1/2 los datos de especie vienen con la numeración de Game Boy y se
  normalizan en `SaveSession.NormalizeType`; los movimientos ya vienen normalizados.
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

## Decisiones de la Fase 1

- **Toda la validación está en el núcleo C#** (`SaveSession.Apply`): especie existente en el
  juego, nivel 1-100, 1-4 movimientos sin repetir, IVs/EVs dentro de los límites de la
  generación (EV máx. 255 en Gen ≤5, 252 después; total 510), objeto que se pueda llevar en
  ese juego, mote con la longitud del juego. Si algo falla no se toca la partida y se devuelve
  un código (`EditResult.Error`) que la UI traduce (`err_*` en `i18n.ts`).
- **Vista previa** (`PreviewPokemon`): aplica los cambios a una copia para mostrar stats,
  habilidades de la nueva especie y legalidad mientras se edita.
- **PID**: en Gen 3/4 naturaleza, habilidad, sexo y variocolor salen del mismo PID; se busca
  un PID que cumpla todo a la vez (`SearchPid34`). En Gen 5+ la naturaleza se asigna directa
  y variocolor/habilidad se aplican en bucle. Antes fallaba de forma intermitente: hay un test
  que prueba 200 combinaciones seguidas en Gen 3, 4, 5, 6 y 8.
- **Gen 1/2**: no hay naturaleza ni habilidad, el PS sale de los demás IVs, AtE/DeE es una
  sola estadística (Especial) y el variocolor depende de los IVs (manda sobre ellos).
- **Exportar**: la UI obliga a descargar antes la copia del original. La partida editada se
  descarga con el mismo nombre que el original para sustituirla sin más.
- Aviso del navegador al cerrar la pestaña con cambios sin descargar.
- Los Pokémon sin movimientos no se pueden guardar hasta añadir uno (el mensaje lo explica).
- No se distinguen formas (Alola, Galar…) ni se crean Pokémon en huecos vacíos: Fase 2.

## Decisiones de la Fase 2

- **Deshacer**: antes de cada cambio válido se guarda `Save.Clone()`. Máximo de pasos según el
  tamaño de la partida (64 MB en total, entre 5 y 30 pasos). `SaveSummary.History.Position`
  dice cuántos cambios hay; la web compara con la posición del último archivo descargado para
  saber si hay cambios pendientes.
- **Mochila**: se reescribe un bolsillo entero (`SetPouch`), validando que cada objeto sea de
  ese bolsillo (`GetAllItems`), la cantidad máxima y los huecos. En Gen 5 el Caramelo Raro va
  en Medicinas: el buscador de "añadir" solo ofrece los del bolsillo.
- **Pokédex**: los métodos genéricos `SetSeen/SetCaught` no hacen nada en Gen 5, BDSP, SwSh,
  SV… Gen 5 usa `Zukan5` (visto por sexo + "mostrado"). Gen 1-4 y 6 usan los genéricos. Gen 7+
  queda en solo lectura (`DexView.Editable = false`) hasta implementar cada Zukan.
- **Importar .pk***: los archivos van descifrados. `SaveFile.GetDecryptedPKM` espera datos
  CIFRADOS (fallaba con cualquier Pokémon con PID ≠ 0); se copian los bytes en `Save.BlankPKM`
  y se comprueba el checksum. Si la extensión no es la del juego se usa `EntityFormat` +
  `EntityConverter` (transferencia entre generaciones). PK4 y PK5 miden lo mismo (136 bytes):
  por eso manda la extensión.
- **Showdown**: `TryParseAnyLanguage` y se comprueban especie y movimientos ANTES de aplicar:
  PKHeX recorta valores fuera de rango (un Sprigatito en Blanco se convertía en Genesect).
  La exportación sale en inglés, que es el formato estándar de Showdown.
- Importar en el equipo siempre añade al final (no puede quedar un hueco en medio).
- **Nada que no exista en el juego**: movimientos contra `LegalMoves` (los de
  `FilteredGameDataSource`, no solo `≤ MaxMoveID`: en SwSh hay 71 con número válido quitados
  del juego, 314 en DBPR, 227 en SV y 673 en Leyendas), especie+forma con
  `Personal.IsPresentInGame`, objetos con `HeldItems` y los de cada bolsillo. Al importar, una
  habilidad inválida se cambia por la primera de la especie y un objeto que no existe se quita.
  `SafetyTests` lo comprueba juego a juego.
- **Pokédex regional**: Teselia en Blanco/Negro (mismo orden que la Nacional, 494-649 → 000-155),
  Kanto en Gen 1, y las que trae PKHeX en DBPR, SwSh (Galar, Armadura, Corona), Leyendas, SV
  (Paldea, Noroteo, Arándano) y Z-A. Del resto (B2N2, XY, ROZA, SL, USUL…) aún no hay datos.

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
