import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'

// Anuncios (opcional). DESACTIVADO mientras no haya un ID de AdSense en la compilación:
//   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX   VITE_ADSENSE_SLOT=1234567890
// Sin esas variables este componente no pinta nada ni carga ningún script.
// Reglas (especificación): nunca tapan la interfaz (van en su propio hueco, al final de las
// secciones, nunca flotando ni a pantalla completa) y en la UE hace falta el aviso de
// consentimiento de Google (Privacidad y mensajes de AdSense), que se configura en la cuenta.
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined

const adsEnabled = Boolean(CLIENT && SLOT)

let scriptAdded = false
function addScript() {
  if (scriptAdded || !CLIENT) return
  scriptAdded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

export function AdSlot() {
  const { t } = useI18n()
  const ref = useRef<HTMLModElement>(null)
  useEffect(() => {
    if (!adsEnabled || !ref.current) return
    addScript()
    try {
      ;((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({})
    } catch {
      /* bloqueador de anuncios: no pasa nada */
    }
  }, [])
  if (!adsEnabled) return null
  return (
    <aside className="ad-slot" aria-label={t('adLabel')}>
      <span className="ad-slot__label">{t('adLabel')}</span>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={CLIENT} data-ad-slot={SLOT} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  )
}
