// Compila PokeSave Link entero: web dentro de la app (romfs), .3dsx y .cia.
// Uso (desde la raíz del repo): node 3ds/PokeSaveLink/build.mjs
// Salida: 3ds/PokeSaveLink/dist/PokeSaveLink.3dsx y PokeSaveLink.cia
//
// - make no admite espacios ni acentos en la ruta: se compila en C:\psl-build.
// - Herramientas: devkitPro (devkitARM, libctru, citro2d) y, para el .cia, makerom y
//   bannertool en tools/3ds-bin (no se suben al repo).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..')
const BUILD = 'C:\\psl-build'
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })

// 1. La web compilada con base relativa, dentro de romfs/web (sin .br ni los originales de lo
//    que ya va en .gz: la web pide los .gz).
run('npm', ['run', 'build:3ds'], { cwd: join(repo, 'web'), shell: true })
const webSrc = join(repo, 'web', 'dist-3ds')
const webDst = join(here, 'romfs', 'web')
rmSync(webDst, { recursive: true, force: true })
let files = 0
const copyDir = (src, dst) => {
  mkdirSync(dst, { recursive: true })
  const names = readdirSync(src)
  for (const name of names) {
    const s = join(src, name)
    if (statSync(s).isDirectory()) { copyDir(s, join(dst, name)); continue }
    if (name.endsWith('.br') || name === '.nojekyll') continue
    if (!name.endsWith('.gz') && names.includes(name + '.gz')) continue
    cpSync(s, join(dst, name))
    files++
  }
}
copyDir(webSrc, webDst)
console.log(`romfs/web: ${files} archivos`)

// 2. Compilar en una ruta sin espacios.
mkdirSync(BUILD, { recursive: true })
for (const p of ['Makefile', 'source', 'gfx', 'meta', 'romfs']) cpSync(join(here, p), join(BUILD, p), { recursive: true, force: true })
const msysBash = 'C:\\devkitPro\\msys2\\usr\\bin\\bash.exe'
run(msysBash, ['-lc', 'export DEVKITPRO=/opt/devkitpro DEVKITARM=/opt/devkitpro/devkitARM; export PATH=/opt/devkitpro/tools/bin:/opt/devkitpro/devkitARM/bin:$PATH; cd /c/psl-build && make'])

// 3. El .cia (icono, banner con su jingle y la app con su romfs).
const bin = join(repo, 'tools', '3ds-bin')
const bannertool = join(bin, 'bannertool', 'windows-x86_64', 'bannertool.exe')
const makerom = join(bin, 'makerom', 'makerom.exe')
const out = join(here, 'dist')
mkdirSync(out, { recursive: true })
cpSync(join(BUILD, 'PokeSaveLink.3dsx'), join(out, 'PokeSaveLink.3dsx'))
if (existsSync(bannertool) && existsSync(makerom)) {
  run(bannertool, ['makebanner', '-i', join(here, 'meta', 'banner.png'), '-a', join(here, 'meta', 'banner.wav'), '-o', join(BUILD, 'banner.bnr')])
  run(bannertool, ['makesmdh', '-s', 'PokeSave Link', '-l', 'PokeSave Link: edita tu partida desde el navegador', '-p', 'PokeSave', '-i', join(here, 'meta', 'icon.png'), '-o', join(BUILD, 'icon.icn')])
  run(makerom, ['-f', 'cia', '-o', join(out, 'PokeSaveLink.cia'), '-elf', 'PokeSaveLink.elf', '-rsf', 'meta/app.rsf', '-icon', 'icon.icn', '-banner', 'banner.bnr', '-exefslogo', '-target', 't', '-major', '1', '-minor', '1', '-micro', '1'], { cwd: BUILD })
} else {
  console.log('Sin makerom/bannertool en tools/3ds-bin: solo se genera el .3dsx')
}
for (const f of readdirSync(out)) console.log(`${f}: ${(statSync(join(out, f)).size / 1024 / 1024).toFixed(1)} MB`)
