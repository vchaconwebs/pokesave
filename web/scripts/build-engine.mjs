// Compila el motor .NET (PokeSave.Wasm) y copia _framework a web/public para que Vite lo sirva.
// Uso: npm run engine
import { execSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = resolve(root, 'artifacts', 'engine')
const target = resolve(root, 'web', 'public', '_framework')

// Limpiar antes: dotnet publish no borra los archivos con hash de compilaciones anteriores.
rmSync(out, { recursive: true, force: true })

execSync(`dotnet publish "${resolve(root, 'src', 'PokeSave.Wasm')}" -c Release -o "${out}" --nologo`, {
  stdio: 'inherit',
  env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
})

const framework = resolve(out, 'wwwroot', '_framework')
if (!existsSync(framework)) throw new Error(`No se encontró ${framework}`)
// Vaciar en lugar de borrar la carpeta: el servidor de Vite puede tenerla abierta.
mkdirSync(target, { recursive: true })
for (const f of readdirSync(target)) rmSync(resolve(target, f), { recursive: true, force: true })
cpSync(framework, target, { recursive: true })
console.log(`Motor copiado a ${target}`)
