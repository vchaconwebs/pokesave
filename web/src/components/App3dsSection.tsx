import { useI18n } from '../i18n'

const base = import.meta.env.BASE_URL

/** PokeSave Link (app de 3DS) en la portada: QR para instalarla con FBI y descargas. */
export function App3dsSection() {
  const { t } = useI18n()
  return (
    <section id="app-3ds" className="app3ds" aria-labelledby="app3ds-title">
      <div className="app3ds__head">
        <img src={`${base}3ds/logo.png`} alt="" width={84} height={84} className="app3ds__logo" />
        <div>
          <p className="hero__kicker px">{t('a3Kicker')}</p>
          <h2 id="app3ds-title">PokeSave Link</h2>
          <p className="muted">{t('a3Lead')}</p>
        </div>
      </div>
      <div className="app3ds__body">
        <div className="app3ds__qr">
          <img src={`${base}3ds/qr-cia.svg`} alt={t('a3QrAlt')} />
        </div>
        <div>
          <h3>{t('a3InstallTitle')}</h3>
          <ol className="app3ds__steps">
            <li>{t('a3Step1')}</li>
            <li>{t('a3Step2')}</li>
            <li>{t('a3Step3')}</li>
            <li>{t('a3Step4')}</li>
          </ol>
          <div className="app3ds__actions">
            <a className="btn btn--red" href={`${base}3ds/PokeSaveLink.cia`}>
              {t('a3DownloadCia')}
            </a>
            <a className="btn" href={`${base}3ds/PokeSaveLink.3dsx`}>
              {t('a3Download3dsx')}
            </a>
          </div>
        </div>
      </div>
      <ul className="app3ds__feats">
        <li>{t('a3Feat1')}</li>
        <li>{t('a3Feat2')}</li>
        <li>{t('a3Feat3')}</li>
        <li>{t('a3Feat4')}</li>
      </ul>
      <p className="muted app3ds__note">{t('a3Note')}</p>
    </section>
  )
}
