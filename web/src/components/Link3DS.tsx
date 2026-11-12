import { useState } from 'react'
import { useI18n } from '../i18n'
import { api3ds, loadFrom3ds, type Link3dsInfo } from '../link3ds'
import { Modal } from './controls'

/** Banner "conectado a tu 3DS" con el botón de cargar la partida. */
export function Link3dsBanner({ info, onOpen }: { info: Link3dsInfo; onOpen: (f: File) => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <div className="dialog link3ds" role="status">
      <p>
        🎮 <b>{t('l3Connected')}</b> · {info.game === 'SD' ? info.file : info.game}
      </p>
      <button
        type="button"
        className="btn btn--red btn--sm"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          loadFrom3ds(info.file)
            .then(onOpen)
            .finally(() => setBusy(false))
        }}
      >
        {t('l3Load')}
      </button>
    </div>
  )
}

/** Guardar en la 3DS: pide el PIN de la pantalla de la consola y manda la partida. */
export function SaveTo3dsDialog({ getBytes, onClose, onDone }: { getBytes: () => Uint8Array; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'pin'>('idle')

  const send = async () => {
    setState('busy')
    try {
      const r = await fetch(api3ds('save'), { method: 'POST', headers: { 'X-PokeSave-Pin': pin, 'Content-Type': 'application/octet-stream' }, body: getBytes() as BodyInit })
      if (r.status === 403) return setState('pin')
      if (!r.ok) return setState('error')
      onDone()
      onClose()
    } catch {
      setState('error')
    }
  }

  return (
    <Modal
      title={t('l3SaveTitle')}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--red" disabled={pin.length !== 4 || state === 'busy'} onClick={send}>
          {t('l3Save')}
        </button>
      }
    >
      <p>{t('l3SaveHelp')}</p>
      <label className="field">
        <span className="field__label">PIN</span>
        <input className="input" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
      </label>
      {state === 'pin' && <p className="dialog dialog--error">{t('l3BadPin')}</p>}
      {state === 'error' && <p className="dialog dialog--error">{t('l3Error')}</p>}
    </Modal>
  )
}
