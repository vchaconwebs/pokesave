// Páginas estáticas para buscadores (se ejecuta después de `vite build`):
//   dist/privacidad/              política de privacidad (ES + EN)
//   dist/juegos/                  lista de juegos compatibles
//   dist/juegos/<juego>/          una página por juego, con contenido propio de ese juego
//   dist/sitemap.xml, robots.txt
// Son HTML sin JavaScript (cargan al instante y Google las lee sin ejecutar nada) que enlazan
// con el editor. La URL pública sale de SITE_URL (por defecto la de GitHub Pages).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(here, '..', 'dist')
const SITE = (process.env.SITE_URL ?? 'https://vchaconwebs.github.io/pokesave/').replace(/\/?$/, '/')
const TODAY = new Date().toISOString().slice(0, 10)

if (!existsSync(DIST)) throw new Error('Primero hay que compilar la web (vite build)')

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- Juegos ----------
// formats: de dónde sale la partida. regional: Pokédex regional (nombre, especies).
// extra: lo que tiene PokeSave además del editor en ese juego.
const PLATFORM = {
  gb: { es: 'Game Boy / Game Boy Color', en: 'Game Boy / Game Boy Color', save: { es: 'el archivo .sav del emulador (mGBA, SameBoy, Gambatte…) o la Consola Virtual de 3DS sacada con Checkpoint', en: 'the emulator .sav file (mGBA, SameBoy, Gambatte…) or the 3DS Virtual Console save dumped with Checkpoint' } },
  gba: { es: 'Game Boy Advance', en: 'Game Boy Advance', save: { es: 'el archivo .sav de 128 KB del emulador (mGBA, VBA-M…) o el de tu cartucho copiado con un lector', en: 'the 128 KB .sav file from your emulator (mGBA, VBA-M…) or your cartridge dumped with a reader' } },
  nds: { es: 'Nintendo DS', en: 'Nintendo DS', save: { es: 'el .sav o .dsv de 512 KB del emulador (melonDS, DeSmuME) o el del cartucho sacado con Checkpoint o TWiLight Menu++', en: 'the 512 KB .sav or .dsv from your emulator (melonDS, DeSmuME) or the cartridge save dumped with Checkpoint or TWiLight Menu++' } },
  '3ds': { es: 'Nintendo 3DS', en: 'Nintendo 3DS', save: { es: 'el archivo main sacado con Checkpoint o JKSM, o el del emulador (Citra, Azahar)', en: 'the main file dumped with Checkpoint or JKSM, or from your emulator (Citra, Azahar)' } },
  switch: { es: 'Nintendo Switch', en: 'Nintendo Switch', save: { es: 'la carpeta de la partida sacada con JKSV o Checkpoint (el archivo main)', en: 'the save folder dumped with JKSV or Checkpoint (the main file)' } },
}

const GAMES = [
  { slug: 'rojo-azul-amarillo', es: 'Pokémon Rojo, Azul y Amarillo', en: 'Pokémon Red, Blue and Yellow', gen: 1, p: 'gb', regional: ['Kanto', 151], extra: ['assistant'] },
  { slug: 'oro-plata-cristal', es: 'Pokémon Oro, Plata y Cristal', en: 'Pokémon Gold, Silver and Crystal', gen: 2, p: 'gb', regional: ['Johto', 251], extra: ['assistant', 'items', 'map'] },
  { slug: 'rubi-zafiro', es: 'Pokémon Rubí y Zafiro', en: 'Pokémon Ruby and Sapphire', gen: 3, p: 'gba', regional: ['Hoenn', 202], extra: ['assistant', 'items', 'map'] },
  { slug: 'esmeralda', es: 'Pokémon Esmeralda', en: 'Pokémon Emerald', gen: 3, p: 'gba', regional: ['Hoenn', 202], extra: ['assistant', 'items', 'map'] },
  { slug: 'rojo-fuego-verde-hoja', es: 'Pokémon Rojo Fuego y Verde Hoja', en: 'Pokémon FireRed and LeafGreen', gen: 3, p: 'gba', regional: ['Kanto', 151], extra: ['assistant', 'items', 'map'] },
  { slug: 'diamante-perla', es: 'Pokémon Diamante y Perla', en: 'Pokémon Diamond and Pearl', gen: 4, p: 'nds', regional: ['Sinnoh', 151], extra: ['assistant'] },
  { slug: 'platino', es: 'Pokémon Platino', en: 'Pokémon Platinum', gen: 4, p: 'nds', regional: ['Sinnoh', 210], extra: ['assistant'] },
  { slug: 'oro-heartgold-plata-soulsilver', es: 'Pokémon Oro HeartGold y Plata SoulSilver', en: 'Pokémon HeartGold and SoulSilver', gen: 4, p: 'nds', regional: ['Johto', 256], extra: ['assistant'] },
  { slug: 'negro-blanco', es: 'Pokémon Negro y Blanco', en: 'Pokémon Black and White', gen: 5, p: 'nds', regional: ['Teselia', 156], extra: ['assistant-rich'] },
  { slug: 'negro-2-blanco-2', es: 'Pokémon Negro 2 y Blanco 2', en: 'Pokémon Black 2 and White 2', gen: 5, p: 'nds', regional: ['Teselia', 301], extra: ['assistant'] },
  { slug: 'x-y', es: 'Pokémon X e Y', en: 'Pokémon X and Y', gen: 6, p: '3ds', regional: ['Kalos', 457], extra: ['assistant'] },
  { slug: 'rubi-omega-zafiro-alfa', es: 'Pokémon Rubí Omega y Zafiro Alfa', en: 'Pokémon Omega Ruby and Alpha Sapphire', gen: 6, p: '3ds', regional: ['Hoenn', 211], extra: ['assistant'] },
  { slug: 'sol-luna', es: 'Pokémon Sol y Luna', en: 'Pokémon Sun and Moon', gen: 7, p: '3ds', regional: ['Alola', 302], extra: ['assistant'] },
  { slug: 'ultrasol-ultraluna', es: 'Pokémon Ultrasol y Ultraluna', en: 'Pokémon Ultra Sun and Ultra Moon', gen: 7, p: '3ds', regional: ['Alola', 403], extra: ['assistant'] },
  { slug: 'lets-go-pikachu-eevee', es: 'Pokémon Let’s Go, Pikachu! y Let’s Go, Eevee!', en: 'Pokémon Let’s Go, Pikachu! and Let’s Go, Eevee!', gen: 7, p: 'switch', regional: ['Kanto', 153], extra: ['assistant'] },
  { slug: 'espada-escudo', es: 'Pokémon Espada y Escudo', en: 'Pokémon Sword and Shield', gen: 8, p: 'switch', regional: ['Galar', 400], extra: ['assistant'] },
  { slug: 'diamante-brillante-perla-reluciente', es: 'Pokémon Diamante Brillante y Perla Reluciente', en: 'Pokémon Brilliant Diamond and Shining Pearl', gen: 8, p: 'switch', regional: ['Sinnoh', 151], extra: ['assistant'] },
  { slug: 'leyendas-arceus', es: 'Leyendas Pokémon: Arceus', en: 'Pokémon Legends: Arceus', gen: 8, p: 'switch', regional: ['Hisui', 242], extra: ['assistant'], dexReadOnly: true },
  { slug: 'escarlata-purpura', es: 'Pokémon Escarlata y Púrpura', en: 'Pokémon Scarlet and Violet', gen: 9, p: 'switch', regional: ['Paldea', 400], extra: ['assistant'] },
  { slug: 'leyendas-z-a', es: 'Leyendas Pokémon: Z-A', en: 'Pokémon Legends: Z-A', gen: 9, p: 'switch', regional: ['Luminalia', 232], extra: ['assistant'] },
]

const FEATURES = {
  es: {
    base: [
      'Equipo y cajas del PC: especie, nivel, mote, naturaleza, habilidad, movimientos, IVs, EVs, objeto y variocolor',
      'Entrenador: nombre, dinero y medallas',
      'Mochila por bolsillos, con solo los objetos que existen en el juego',
      'Importar y exportar Pokémon (.pk*) y equipos de Showdown',
      'Avisos de legalidad y deshacer/rehacer',
    ],
    dex: (g) => (g.dexReadOnly ? `Pokédex (Nacional y ${g.regional[0]}) para consultar` : `Pokédex editable: vistos y capturados, Nacional y ${g.regional[0]} (${g.regional[1]})`),
    assistant: 'Asistente de Pokédex: qué te falta y dónde sale en tu versión (lugar, método y niveles), evoluciones y exclusivos de la otra versión',
    'assistant-rich': 'Asistente de Pokédex completo: qué te falta, dónde sale según tus medallas y la estación, con probabilidades',
    items: 'Buscador de objetos y MT: dónde está cada objeto (suelo, oculto, regalo, tienda) y cuáles has recogido ya',
    map: 'Mapa interactivo de la región con lo que te falta en cada sitio',
    tm: 'Buscador de objetos y MT: qué tienes y qué movimiento enseña cada MT',
  },
  en: {
    base: [
      'Party and PC boxes: species, level, nickname, nature, ability, moves, IVs, EVs, held item and shininess',
      'Trainer: name, money and badges',
      'Bag by pocket, only with items that exist in the game',
      'Import and export Pokémon (.pk*) and Showdown teams',
      'Legality warnings and undo/redo',
    ],
    dex: (g) => (g.dexReadOnly ? `Pokédex (National and ${g.regional[0]}) to browse` : `Editable Pokédex: seen and caught, National and ${g.regional[0]} (${g.regional[1]})`),
    assistant: 'Pokédex assistant: what you are missing and where it appears in your version (place, method and levels), evolutions and version exclusives',
    'assistant-rich': 'Full Pokédex assistant: what you are missing and where it appears given your badges and the season, with encounter rates',
    items: 'Item & TM finder: where every item is (ground, hidden, gift, shop) and which ones you already picked up',
    map: 'Interactive region map with what you are missing in each place',
    tm: 'Item & TM finder: what you have and which move each TM teaches',
  },
}

const featureList = (g, lang) => {
  const f = FEATURES[lang]
  const list = [...f.base, f.dex(g), ...g.extra.map((e) => f[e])]
  if (!g.extra.includes('items')) list.push(f.tm)
  return list
}

// ---------- Plantilla ----------
const css = `
:root{--bg:#0e1430;--surface:#182150;--text:#f3f5ff;--muted:#a8b0d6;--red:#e3242b;--gold:#ffcb05;--line:rgb(255 255 255/.12)}
@media (prefers-color-scheme:light){:root{--bg:#eaf3ff;--surface:#fff;--text:#1b1d26;--muted:#5a6280;--line:rgb(0 0 0/.1)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 ui-rounded,'Fredoka',system-ui,sans-serif}
header{background:var(--red);color:#fff;padding:14px 16px}header a{color:#fff;text-decoration:none;font-weight:800;font-size:1.2rem}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}h1{font-size:clamp(1.6rem,4vw,2.3rem);line-height:1.2;margin:.2em 0 .4em}
h2{margin-top:1.8em;font-size:1.3rem}.card{background:var(--surface);border-radius:18px;padding:16px 18px;box-shadow:inset 0 0 0 2px var(--line);margin:14px 0}
a{color:var(--gold)}@media (prefers-color-scheme:light){a{color:#1f5fa8}}
.cta{display:inline-block;background:var(--red);color:#fff!important;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:999px;margin:8px 0;box-shadow:0 6px 0 -2px rgb(0 0 0/.25)}
.muted{color:var(--muted)}ul.games{columns:2 260px;padding-left:1.1em}footer{max-width:860px;margin:0 auto;padding:0 16px 32px;color:var(--muted);font-size:.9rem}
li{margin:.2em 0}details{margin:.4em 0}summary{cursor:pointer;font-weight:700}`

function page({ path, lang = 'es', title, description, body, jsonld = [], alternates = [] }) {
  const url = SITE + path
  const depth = path.split('/').filter(Boolean).length
  const root = depth ? '../'.repeat(depth) : './'
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alternates.map(([l, href]) => `<link rel="alternate" hreflang="${l}" href="${href}">`).join('\n')}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="PokeSave">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#e3242b">
<link rel="icon" type="image/svg+xml" href="${root}favicon.svg">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
<style>${css}</style>
</head>
<body>
<header><a href="${root}">⬤ PokeSave</a></header>
<main>
${body(root)}
</main>
<footer>
<p>PokeSave es un proyecto de fans sin relación con Nintendo, Game Freak ni The Pokémon Company. Pokémon y sus nombres son marcas de sus dueños. · <a href="${root}privacidad/">Privacidad</a> · <a href="${root}juegos/">Juegos compatibles</a> · Código abierto (GPL-3.0) con <a href="https://github.com/kwsch/PKHeX">PKHeX.Core</a>.</p>
</footer>
</body>
</html>
`
  const dir = resolve(DIST, path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html)
  return url
}

const urls = [SITE]

// ---------- Privacidad ----------
urls.push(
  page({
    path: 'privacidad/',
    title: 'Privacidad · PokeSave',
    description: 'Tu partida de Pokémon nunca sale de tu dispositivo: PokeSave la lee y la edita en tu navegador. Qué datos se usan y cuáles no.',
    alternates: [
      ['es', SITE + 'privacidad/'],
      ['en', SITE + 'privacidad/#english'],
    ],
    body: (root) => `
<h1>Privacidad</h1>
<p class="muted">Última actualización: ${TODAY}</p>
<div class="card">
<p><b>Resumen: tu partida nunca sale de tu dispositivo.</b> PokeSave abre, enseña y edita el archivo en tu navegador con PKHeX.Core compilado a WebAssembly. No hay servidor que reciba tu partida, ni cuentas, ni base de datos.</p>
</div>
<h2>Qué pasa con tu partida</h2>
<ul>
<li>El archivo se lee en la memoria de tu navegador y solo se guarda donde tú lo descargues.</li>
<li>Antes de descargar la partida editada, la web te pide bajar una copia del original.</li>
<li>Al cerrar la pestaña se borra todo de la memoria.</li>
</ul>
<h2>Qué se descarga de otros sitios</h2>
<ul>
<li><b>Imágenes de los Pokémon</b>: se piden al repositorio público de <a href="https://github.com/PokeAPI/sprites">PokeAPI/sprites</a> en GitHub (raw.githubusercontent.com). Ese servidor ve, como cualquier web, tu dirección IP y qué imagen pides (es decir, qué especie), pero no tu partida.</li>
<li><b>La web en sí</b> está alojada en GitHub Pages. GitHub puede registrar las visitas (IP, navegador) según su <a href="https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement">declaración de privacidad</a>.</li>
</ul>
<h2>Qué se guarda en tu navegador</h2>
<p>Solo preferencias, en el almacenamiento local de tu navegador: idioma, tema claro u oscuro, si has terminado la Liga (para el asistente) y qué versión del juego elegiste. Nada de eso sale de tu dispositivo y puedes borrarlo limpiando los datos del sitio.</p>
<h2>Compartir el equipo</h2>
<p>Si compartes tu equipo con un enlace, los datos de esos Pokémon (especie, nivel, movimientos…) van dentro de la propia dirección, después de <code>#</code>. Esa parte de la dirección no se envía a ningún servidor. No se incluye nada más de tu partida.</p>
<h2>Cookies y publicidad</h2>
<p>PokeSave no usa cookies propias ni de analítica. Si algún día hay anuncios, se avisará aquí antes y se pedirá tu consentimiento cuando haga falta.</p>
<h2>Código abierto</h2>
<p>Todo el código es público (licencia GPL-3.0): puedes comprobar que funciona así.</p>
<p><a class="cta" href="${root}">Abrir el editor</a></p>

<h2 id="english">Privacy (English)</h2>
<div class="card">
<p><b>Your save file never leaves your device.</b> PokeSave opens, shows and edits it in your browser using PKHeX.Core compiled to WebAssembly. There is no server receiving your save, no accounts and no database.</p>
</div>
<ul>
<li><b>Pokémon images</b> are loaded from the public <a href="https://github.com/PokeAPI/sprites">PokeAPI/sprites</a> repository on GitHub, which sees your IP and which image (species) is requested, never your save.</li>
<li><b>The site</b> is hosted on GitHub Pages, which may log visits under GitHub's privacy statement.</li>
<li><b>Local storage</b> only keeps preferences (language, theme, assistant options).</li>
<li><b>Shared team links</b> carry the team inside the URL fragment (after <code>#</code>), which browsers never send to servers.</li>
<li>No cookies, no analytics. If ads are ever added, this page will say so first and ask for consent where required.</li>
</ul>`,
  }),
)

// ---------- Juegos ----------
for (const g of GAMES) {
  const pl = PLATFORM[g.p]
  const featuresEs = featureList(g, 'es')
  const faq = [
    [`¿Puedo editar ${g.es} sin descargar nada?`, `Sí. PokeSave funciona en el navegador, también en el móvil: abres la web, eliges tu partida y la editas. No hay que instalar ningún programa.`],
    [`¿De dónde saco la partida de ${g.es}?`, `Es ${pl.save.es}.`],
    ['¿Se sube mi partida a algún sitio?', 'No. Se procesa entera en tu dispositivo con PKHeX.Core compilado a WebAssembly. Antes de descargar la editada te pide guardar una copia del original.'],
    ['¿Puedo romper la partida?', 'PokeSave solo deja poner Pokémon, movimientos y objetos que existen en ese juego y avisa de lo que no sería legal. Aun así, guarda siempre la copia del original.'],
  ]
  urls.push(
    page({
      path: `juegos/${g.slug}/`,
      title: `Editor de partidas de ${g.es} (.sav) · PokeSave`,
      description: `Edita tu partida de ${g.es} en el navegador: Pokémon, mochila, Pokédex de ${g.regional[0]} y más. Gratis, sin instalar nada y sin que la partida salga de tu dispositivo.`,
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: `PokeSave · Editor de ${g.es}`,
          url: SITE,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Navegador web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          inLanguage: ['es', 'en'],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
        },
      ],
      body: (root) => `
<p class="muted">Generación ${g.gen} · ${esc(pl.es)}</p>
<h1>Editor de partidas de ${esc(g.es)}</h1>
<p>Sube tu partida de <b>${esc(g.es)}</b> y edítala directamente en el navegador: tu equipo, las cajas del PC, la mochila y la Pokédex de ${esc(g.regional[0])}. Todo pasa en tu dispositivo: la partida no se sube a ningún sitio.</p>
<p><a class="cta" href="${root}">Abrir el editor</a></p>
<h2>Qué puedes hacer con tu partida de ${esc(g.es)}</h2>
<ul>${featuresEs.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
<h2>Cómo editar tu partida</h2>
<ol>
<li>Consigue tu archivo de partida: ${esc(pl.save.es)}.</li>
<li>Abre PokeSave y elige el archivo (o arrástralo a la página). Se reconoce el juego solo.</li>
<li>Edita lo que quieras. Descarga primero la copia del original y luego la partida editada.</li>
<li>Copia la partida editada donde estaba (emulador, Checkpoint…) y abre el juego.</li>
</ol>
<h2>Preguntas frecuentes</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
<div class="card"><p lang="en"><b>English:</b> edit your ${esc(g.en)} save file in the browser — party, PC boxes, bag and ${esc(g.regional[0])} Pokédex — without uploading it anywhere. <a href="${root}">Open the editor</a>.</p></div>
<p class="muted"><a href="${root}juegos/">Ver todos los juegos compatibles</a></p>`,
    }),
  )
}

urls.push(
  page({
    path: 'juegos/',
    title: 'Juegos compatibles · PokeSave, editor de partidas de Pokémon',
    description: 'PokeSave edita partidas de todos los juegos principales de Pokémon, de Rojo y Azul a Escarlata, Púrpura y Leyendas Z-A, en el navegador y sin subir la partida.',
    body: (root) => `
<h1>Juegos compatibles</h1>
<p>PokeSave usa PKHeX.Core, así que abre las partidas de todos los juegos principales, de la primera a la novena generación.</p>
<ul class="games">${GAMES.map((g) => `<li><a href="${root}juegos/${g.slug}/">${esc(g.es)}</a> <span class="muted">· Gen ${g.gen}</span></li>`).join('')}</ul>
<p><a class="cta" href="${root}">Abrir el editor</a></p>`,
  }),
)

// ---------- sitemap y robots ----------
writeFileSync(
  resolve(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`,
)
writeFileSync(resolve(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`)
console.log(`Páginas estáticas: ${urls.length} (${SITE})`)
