// Lugares de Blanco/Negro: nombre oficial en España y medallas aproximadas para llegar.
// badges: 0-8 = medallas necesarias; 9 = después de la Liga (postgame).
// Nombres: WikiDex (https://www.wikidex.net/wiki/Teselia). Si un nombre no está verificado
// se deja fuera y la web usa el nombre en inglés de PokéAPI.
// Las medallas son aproximadas: siguen el orden normal de la historia.

export const LOCATIONS = {
  'nuvema-town': { es: 'Pueblo Arcilla', badges: 0 },
  'unova-route-1': { es: 'Ruta 1', badges: 0 },
  'unova-route-2': { es: 'Ruta 2', badges: 0 },
  'striaton-city': { es: 'Ciudad Gres', badges: 0 },
  dreamyard: { es: 'Solar de los Sueños', badges: 0 },
  'unova-route-3': { es: 'Ruta 3', badges: 1 },
  'wellspring-cave': { es: 'Cueva Manantial', badges: 1 },
  'pinwheel-forest': { es: 'Bosque Azulejo', badges: 2 },
  'nacrene-city': { es: 'Ciudad Esmalte (Museo)', badges: 3 },
  'unova-route-4': { es: 'Ruta 4', badges: 3 },
  'desert-resort': { es: 'Zona Desierto', badges: 3 },
  'relic-castle': { es: 'Castillo Ancestral', badges: 3 },
  'unova-route-16': { es: 'Ruta 16', badges: 3 },
  'lostlorn-forest': { es: 'Bosque Perdidos', badges: 3 },
  'unova-route-5': { es: 'Ruta 5', badges: 4 },
  'driftveil-drawbridge': { es: 'Puente de Fayenza', badges: 4 },
  'driftveil-city': { es: 'Ciudad Fayenza', badges: 4 },
  'cold-storage': { es: 'Almacenes Frigoríficos', badges: 4 },
  'unova-route-6': { es: 'Ruta 6', badges: 5 },
  'mistralton-cave': { es: 'Cueva Loza', badges: 5 },
  'chargestone-cave': { es: 'Cueva Electrorroca', badges: 5 },
  'unova-route-7': { es: 'Ruta 7', badges: 6 },
  'celestial-tower': { es: 'Torre de los Cielos', badges: 6 },
  'twist-mountain': { es: 'Monte Tuerca', badges: 6 },
  'icirrus-city': { es: 'Ciudad Teja', badges: 6 },
  'dragonspiral-tower': { es: 'Torre Duodraco', badges: 7 },
  'moor-of-icirrus': { es: 'Pantano Teja', badges: 7 },
  'unova-route-8': { es: 'Ruta 8', badges: 7 },
  'unova-route-9': { es: 'Ruta 9', badges: 7 },
  'unova-route-10': { es: 'Ruta 10', badges: 8 },
  'unova-victory-road': { es: 'Calle Victoria', badges: 8 },
  'ns-castle': { es: 'Castillo de N', badges: 8 },
  // Después de la Liga
  'unova-route-11': { es: 'Ruta 11', badges: 9 },
  'unova-route-12': { es: 'Ruta 12', badges: 9 },
  'unova-route-13': { es: 'Ruta 13', badges: 9 },
  'unova-route-14': { es: 'Ruta 14', badges: 9 },
  'unova-route-15': { es: 'Ruta 15', badges: 9 },
  'unova-route-17': { es: 'Ruta 17', badges: 9 },
  'unova-route-18': { es: 'Ruta 18', badges: 9 },
  'village-bridge': { es: 'Puente Villa', badges: 9 },
  'giant-chasm': { es: 'Boquete Gigante', badges: 9 },
  'undella-town': { es: 'Pueblo Arenisca', badges: 9 },
  'undella-bay': { es: 'Bahía Arenisca', badges: 9 },
  'marvelous-bridge': { badges: 9 },
  'abundant-shrine': { es: 'Santuario Abundancia', badges: 9 },
  'p2-laboratory': { badges: 9 },
  'challengers-cave': { es: 'Gruta Superación', badges: 9 },
  'guidance-chamber': { badges: 9 },
  'trial-chamber': { badges: 9 },
  'liberty-garden': { es: 'Isla Libertad', badges: 8 },
  // Pseudo-lugares añadidos a mano (ver OVERRIDES).
  'dragonspiral-tower-top': { es: 'Torre Duodraco (cima)', en: 'Dragonspiral Tower (top)', badges: 9 },
  'unova-roaming': { es: 'Por toda Teselia (errante)', en: 'All over Unova (roaming)', badges: 9 },
}

/** Áreas que PokéAPI mete en Blanco/Negro pero son de otros juegos. */
export const EXCLUDED_AREAS = new Set([
  'castelia-city-game-freak-hq-1f', // Zorua de regalo: es de Negro 2/Blanco 2
  'team-flare-secret-hq-area', // Pokémon X/Y
])

/** Áreas que se separan de su lugar porque se desbloquean en otro momento. */
export const AREA_TO_LOCATION = {
  'dragonspiral-tower-7f': 'dragonspiral-tower-top',
}

/** Encuentros añadidos a mano. v: 1 = Negro, 2 = Blanco, 3 = los dos. */
export const EXTRA_ENCOUNTERS = [
  // Tornadus y Thundurus vagan por Teselia tras la Liga (PokéAPI los pone en una base de X/Y).
  { species: 641, location: 'unova-roaming', method: 'roaming-grass', min: 40, max: 40, chance: 0, v: 1 },
  { species: 642, location: 'unova-roaming', method: 'roaming-grass', min: 40, max: 40, chance: 0, v: 2 },
]

/** Especies que en Blanco/Negro solo se consiguen con un evento (además de las singulares). */
export const EVENT_ONLY = new Set([570, 571]) // Zorua y Zoroark
