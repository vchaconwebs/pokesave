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
- **Fase 3 (asistente de Pokédex, Blanco/Negro): hecha.** Rama `fase-3`. Sección "Asistente":
  qué te falta (Teselia o Nacional), dónde sale en tu versión (lugar, método, niveles,
  probabilidad, estación), evoluciones e intercambios, exclusivos de la otra versión, eventos y
  Pokétransfer. Filtros por método y "solo lo que puedo conseguir ya" según medallas y Liga.
- **Todos los juegos (rama `fase-3b-juegos`):** Gen 1-4 probadas con partidas de formato real,
  Pokédex editable de Gen 1 a 9 (menos Leyendas: Arceus), Pokédex regionales de todos los
  juegos y asistente para los 18 grupos de juegos (Blanco/Negro con medallas y estaciones; el
  resto con los datos de PKHeX).
- **Fase 4 (buscador de objetos y MT): hecha.** Rama `fase-4`. Sección "Objetos": todos los
  objetos del juego con cuántos tienes (mochila + PC), qué movimiento enseña cada MT/MO/DT (de
  Rojo a Z-A) y, en Esmeralda, Rubí/Zafiro y Rojo Fuego/Verde Hoja, dónde está cada objeto
  (suelo, oculto, regalo, tienda) y si ya lo has cogido según los flags de la partida.
  Gen 2 (Oro/Plata/Cristal) añadida después.
- **Fase 5 (mapas interactivos): hecha para Gen 2 y 3.** Sección "Mapa" en Oro/Plata/Cristal
  (Johto y Kanto), Rubí/Zafiro/Esmeralda (Hoenn) y Rojo Fuego/Verde Hoja (Kanto e islas Sete):
  mapa propio en SVG con cada lugar en su sitio; el color dice cuánto te falta (objetos sin
  coger + Pokémon sin capturar de tu versión) y al tocar un lugar se ve el detalle.

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
cd web && npm run typecheck && npm run lint && npm test
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

## Decisiones de la Fase 3

- **Datos**: `node tools/build-bw-data.mjs` genera `web/public/data/bw.json` (56 KB) desde
  PokéAPI con caché en `tools/.cache/` (no se sube). El JSON sí se versiona. La web lo carga
  solo al abrir el asistente. `tools/bw-locations.mjs` tiene las correcciones a mano:
  - Nombres de lugares de España (WikiDex). PokéAPI no los tiene en español; si falta uno se
    usa el inglés en vez de inventarlo.
  - Medallas aproximadas por lugar según el orden de la historia (9 = tras la Liga).
  - Errores de PokéAPI: el Zorua de Game Freak es de N2B2 y Tornadus/Thundurus "en la base
    del Team Flare" es de XY (en BN vagan por Teselia tras la Liga).
- **Reglas** (`web/src/assistant.ts`, tests con Vitest en `assistant.test.ts`): Surf pide 6
  medallas (MO03 en el Monte Tuerca), la Supercaña la Liga (te la da Looker), los legendarios
  fijos la Liga salvo Zekrom/Reshiram en el Castillo de N. Estación según el mes (ene
  primavera, feb verano, mar otoño, abr invierno…). Los singulares y Zorua/Zoroark son evento.
- No sabemos leer de la partida si se ha terminado la Liga: lo marca el usuario (se recuerda).

## Decisiones de "todos los juegos"

- **Gen 1-4 con formato real** (`RealFormatTests`): las partidas en blanco de PKHeX no sirven
  (en Gen 3/4 ni se pueden escribir; en Gen 1/2 no se reconocen). Se fabrican con la misma
  estructura que una partida de verdad (sectores con ID, firma 0x08012025 y contador en Gen 3;
  pie de bloque con tamaño y magia 0x20060623 en Gen 4; caja actual "0 + 0xFF" en Gen 1/2) y se
  prueba detectar → editar → exportar → reabrir con checksums válidos, mochila, Pokédex e
  importar. En Gen 3 el nombre del entrenador vacío debe ir relleno de 0xFF o PKHeX la toma por
  japonesa. Con `POKESAVE_DUMP=<carpeta>` el test `DumpSyntheticSaves` las guarda para probar a
  mano. **Falta probarlas en un emulador.**
- **Gen 1/2**: las cajas son listas sin huecos; importar en una caja va al primer hueco libre.
- **Pokédex por juego** (`SetDexFlags`): Gen 4 usa `Zukan4` (el genérico no hace nada) con el
  sexo visto; Gen 5 `Zukan5`; Gen 7-9 el "completar entrada" de PKHeX (`SetDexEntryAll`) y para
  "solo visto" se quita lo capturado a mano en cada juego. En SwSh solo cuentan las especies con
  entrada en la partida (sin los DLC no salen). Leyendas: Arceus queda en solo lectura.
- **Pokédex regionales**: `tools/build-regional-dex.mjs` genera `RegionalDexData.cs` desde
  PokéAPI (revisado contra Bulbapedia). Espada/Escudo usa los índices de PKHeX; en DBPR,
  Leyendas, SV y Z-A los de PKHeX no cuadraban (faltaban especies o formas).
- **Asistente en todos los juegos**: `tools/PokeSave.DataBuilder` (consola .NET) lee por
  reflexión las tablas de encuentros internas de PKHeX (`Encounters1`…`Encounters9a`) y
  escribe `web/public/data/games/<grupo>.json`: lugares en español e inglés (los nombres de
  PKHeX), método, niveles, versión, forma, y las evoluciones del propio juego. Se ejecuta con
  `dotnet run --project tools/PokeSave.DataBuilder` al cambiar de versión de PKHeX.
  - Se descartan eventos, Pokémon GO, Mundo Sueño, discos de bonificación y Radar Sueño.
  - En SV PKHeX junta las dos versiones en los salvajes (Círculo Unión): los exclusivos van a
    mano en `ApplyExclusivesSV` (lista de thonky.com).
  - Sin medallas ni estaciones fuera de Blanco/Negro: "solo lo que puedo conseguir ya" pasa a
    "solo lo que sale en tu versión". Si la partida no dice la versión (Rubí/Zafiro, DP, HGSS,
    Gen 1/2…), se pregunta y se recuerda.
  - Blanco/Negro sigue con `bw.json` (más rico: medallas, estaciones, probabilidades).

## Decisiones de la Fase 4

- **MT → movimiento** (`SaveSession.Machines`): tablas públicas de PKHeX (`ItemStorageX.Machine`
  + `PersonalInfoX.MachineMoves` o `LearnSourceX.MachineMoves`). Ojo: en SwSh la MT00 es el
  objeto 1230 y va aparte; en SV la tabla de movimientos va por número de MT (la 0 no existe) y
  la de objetos tiene huecos, así que se empareja por el número del nombre inglés ("TM123").
- **Nombres de objetos**: Gen 1-3 numeran los objetos a su manera. Hay que usar
  `GetItemStrings(context, version)`, no `itemlist` (antes la mochila de Gen 1-3 enseñaba
  nombres equivocados).
- **Dónde está cada objeto (Gen 3)**: `node tools/build-gen3-items.mjs` lee las decompilaciones
  de pret (map.json: Poké Balls con script `finditem` y `hidden_item`; scripts.inc: `giveitem`,
  `giveitem_msg`, `additem` y `pokemart`) y escribe `web/public/data/items/{e,frlg,rs}.json`.
  Los flags salen de `flags.h` (con sus expresiones) y los objetos de `items.h` (enum en
  Esmeralda, #define en el resto; las MT de Esmeralda por nombre de movimiento salen de
  `tms_hms.h`). El flag de un regalo es el primer `setflag` tras darlo o el `goto_if_set` del
  principio; si no hay, se muestra sin estado. Los nombres de lugar son los de PKHeX por número
  de sección del mapa (`gen3-locations.json`, lo escribe el DataBuilder).
- **Gen 2** (`tools/build-gen2-items.mjs`, pokecrystal y pokegold): mismo formato. Constantes de
  RGBDS (`const_def`, `const`, `const_skip`, `add_tm`/`add_hm`; ojo con no contar los `const`
  de dentro de `MACRO … ENDM`), lugar = landmark del mapa (`gen2-locations.json`).
- Resto de juegos: sin datos de dónde está cada objeto (no hay decompilación con flags). Gen 4
  (pokeplatinum, pokeheartgold) y Gen 1 (pokered, con objetos "missable") son los candidatos.

## Decisiones de la Fase 5

- **Sin imágenes oficiales**: el mapa lo dibuja la web (SVG) con la posición de cada lugar que
  traen las decompilaciones de pret (`node tools/build-region-maps.mjs` →
  `web/public/data/maps/*.json`): rectángulos de `region_map_sections.json` (Hoenn), cuadrícula
  de `region_map_layout_*.h` (Kanto y Sete de FRLG) y puntos de `landmarks.asm` (Johto y Kanto
  de GSC). Por eso no hace falta Leaflet: es una cuadrícula pequeña.
- El número de cada casilla es el de PKHeX (sección en Gen 3, landmark en Gen 2): el
  DataBuilder guarda ese número (`Locations[].Id`) para cruzar los encuentros del asistente.
- Resto de juegos: no hay coordenadas libres de cada lugar; haría falta dibujarlas a mano.

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
