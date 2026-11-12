# PokeSave Link (3DS)

Homebrew de 3DS para editar tu partida de Pokémon con PokeSave **sin sacar la tarjeta SD**:
la consola sirve la web por wifi, la abres en el móvil o el PC, editas y pulsas
**Guardar en la 3DS**. Antes de tocar nada hace una copia de la partida en la SD.

> ⚠️ **Sin probar en una consola real todavía** (sobre todo la escritura en cartuchos de DS). Compila con devkitARM y el lado de la web está
> probado con un simulador (`web/scripts/mock-3ds.mjs`), pero la lectura/escritura de la
> partida en una 3DS de verdad falta por probar. Úsalo primero con una partida de la que
> tengas copia (Checkpoint).

## Juegos

Encuentra solo:

- **Juegos de 3DS** en cartucho o digitales: X/Y, Rubí Omega/Zafiro Alfa, Sol/Luna y
  Ultrasol/Ultraluna (archivo `main` de su partida).
- **Consola Virtual** (Rojo/Azul/Amarillo, Oro/Plata/Cristal…): títulos instalados cuya
  partida es un `sav.dat` del tamaño de una de Game Boy. Salen como "VC <código>".
- **Cartucho de DS metido en la consola**: Diamante, Perla, Platino, Oro HeartGold, Plata
  SoulSilver, Negro, Blanco, Negro 2 y Blanco 2. Lee y escribe el chip de memoria del cartucho
  (flash de 512 KB, con o sin infrarrojos) con el mismo método que Checkpoint/TWLSaveTool
  (`source/spi.c`). Después de escribir lo vuelve a leer y lo compara.
- **Cualquier `.sav` de la SD** ("Buscar un .sav en la SD…"): juegos de DS con TWiLight
  Menu++ / nds-bootstrap, emuladores, copias… Explorador de carpetas (A abrir, B atrás, L/R
  página) que recuerda la última carpeta. Escribe a través de un temporal.

Siempre hace copia antes en `sdmc:/3ds/PokeSave/backups/<juego>/` (o `backups/sd/`).

## Instalar

1. Compila la app (abajo) y copia `PokeSaveLink.3dsx` a `sdmc:/3ds/`.
2. Compila la web para la consola: `cd web && npm run build:3ds` y copia el **contenido** de
   `web/dist-3ds/` a `sdmc:/3ds/PokeSave/web/` (tiene que quedar
   `sdmc:/3ds/PokeSave/web/index.html`).
3. Abre **PokeSave Link** desde el Homebrew Launcher.

## Usar

1. Elige el juego o "Buscar un .sav en la SD…". La app hace una copia:
   `sdmc:/3ds/PokeSave/backups/<juego>/<fecha>-original.main` (o `backups/sd/<archivo>-<fecha>-original.bak`).
2. En la pantalla sale una dirección (`http://192.168.x.x:8000`) y un **PIN**.
3. Ábrela en el navegador del móvil o del PC (misma wifi) → **Abrir la partida de la 3DS**.
4. Edita y pulsa **Guardar en la 3DS** con el PIN. Antes de escribir hace otra copia
   (`…-antes.main`).
5. Sal con **START** y abre el juego.

Para volver atrás, restaura cualquier copia con Checkpoint (o cópiala tú como `main`).

## Cómo funciona

- Lee y escribe `/main` en el archivo de partida del juego (`ARCHIVE_USER_SAVEDATA`) y hace
  `ARCHIVE_ACTION_COMMIT_SAVE_DATA` para que el juego vea los cambios.
- Servidor HTTP propio (puerto 8000) con la web estática de la SD y una API mínima:
  `GET /api/info`, `GET /api/save`, `POST /api/save` (cabecera `X-PokeSave-Pin`; el cuerpo
  tiene que medir lo mismo que la partida).
- La web se sirve desde la consola porque una página https (GitHub Pages) no puede hablar con
  un servidor http de la red local (contenido mixto).
- El PIN evita que otro aparato de la misma wifi te sobrescriba la partida.

## Compilar

Requisitos: [devkitPro](https://devkitpro.org) con devkitARM y libctru (grupo `3ds-dev`).

```bash
make
```

`make` no admite espacios ni acentos en la ruta: si la carpeta del repositorio los tiene,
copia `3ds/PokeSaveLink` a una ruta sencilla (p. ej. `C:/psl`) y compila allí desde la
consola de devkitPro (msys2).
