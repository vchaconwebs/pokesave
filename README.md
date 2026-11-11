# PokeSave

**Editor de partidas de Pokémon que funciona entero en tu navegador.** Sube tu `.sav`, mira
tu equipo, tu Pokédex y tus cajas, y edítalo desde el móvil o el ordenador. Tu
partida nunca se sube a ningún servidor.

**Pruébala:** https://vchaconwebs.github.io/pokesave/

> Estado: **Fase 1 · editor**. Ver y editar equipo y cajas (especie, nivel, mote, naturaleza,
> habilidad, movimientos, IVs, EVs, variocolor, objeto), entrenador y dinero, con avisos de
> legalidad y descarga de la partida lista para tu juego o emulador.

## Cómo funciona

```
[ tu navegador ]
   React + TypeScript (interfaz, 77 KB)
        │  bytes del .sav         ▲  resumen en JSON
        ▼                         │
   .NET 10 WebAssembly  →  PKHeX.Core (checksums, cifrado, legalidad)

   sin backend · sin subidas · hosting estático
```

- **PKHeX.Core** lee y escribe partidas de las generaciones 1 a 9, con checksums, cifrado y
  comprobación de legalidad. Aquí se compila a WebAssembly y se llama desde TypeScript con
  `[JSExport]`.
- La interfaz se pinta al momento y el motor (~3,5 MB con Brotli) se descarga en segundo plano
  con indicador de progreso.
- Español e inglés, tema claro y oscuro, pensado primero para el móvil.

## Desarrollo

Requisitos: .NET SDK 10 con el workload `wasm-tools`, y Node 24.

```bash
cd web
npm install
npm run engine   # compila el motor C# a WebAssembly
npm run dev
```

Tests: `dotnet test` en la raíz. Se publica sola en GitHub Pages con cada push a `main`. Más detalles en [CLAUDE.md](CLAUDE.md).

## Créditos y licencia

Basado en [PKHeX](https://github.com/kwsch/PKHeX) de Kaphotics y colaboradores. Publicado con
licencia [GPL-3.0](LICENSE).

Proyecto no oficial, sin relación con Nintendo, Game Freak, Creatures ni The Pokémon Company.
No incluye ROMs ni partidas de terceros. Los sprites se cargan desde
[PokéAPI/sprites](https://github.com/PokeAPI/sprites) y no se guardan en este repositorio;
son propiedad de sus respectivos dueños.
