import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadBytes, loadEngine, type Engine, type Progress } from './engine'
import { I18nContext, detectLang, makeT, useI18n, type Key, type Lang } from './i18n'
import type { SaveSummary } from './types'
import { SaveView } from './components/SaveView'
import { Icon, Logo } from './components/visuals'
import { gameAccent } from './theme'

type EngineState = { status: 'loading'; progress: Progress | null } | { status: 'ready'; engine: Engine } | { status: 'error' }
type Loaded = { save: SaveSummary; fileName: string; parseMs: number }

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  },
}

export default function App() {
  const [lang, setLang] = useState<Lang>(detectLang)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (store.get('pokesave.theme') as 'dark' | 'light' | null) ??
    (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  )
  const [engine, setEngine] = useState<EngineState>({ status: 'loading', progress: null })
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<{ key: Key; hint?: Key } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const queued = useRef<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const t = useMemo(() => makeT(lang), [lang])

  const startEngine = useCallback(() => {
    loadEngine((progress) => setEngine((s) => (s.status === 'loading' ? { status: 'loading', progress } : s)))
      .then((e) => setEngine({ status: 'ready', engine: e }))
      .catch((err) => {
        console.error(err)
        setEngine({ status: 'error' })
      })
  }, [])

  useEffect(startEngine, [startEngine])

  const retryEngine = () => {
    setEngine({ status: 'loading', progress: null })
    startEngine()
  }

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dataset.theme = theme
  }, [lang, theme])

  // El acento de color sigue al juego cargado.
  useEffect(() => {
    const accent = gameAccent(loaded?.save.gameId)
    const root = document.documentElement.style
    if (accent) {
      root.setProperty('--accent', accent[0])
      root.setProperty('--accent-2', accent[1])
    } else {
      root.removeProperty('--accent')
      root.removeProperty('--accent-2')
    }
  }, [loaded])

  const openFile = useCallback(
    async (file: File) => {
      setError(null)
      if (engine.status !== 'ready') {
        queued.current = file // se abrirá en cuanto el motor esté listo
        setBusy(true)
        return
      }
      setBusy(true)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const t0 = performance.now()
        const result = engine.engine.load(bytes, file.name, lang)
        const parseMs = Math.round(performance.now() - t0)
        if (result.ok && result.save) {
          setLoaded({ save: result.save, fileName: file.name, parseMs })
        } else {
          setLoaded(null)
          setError(result.error === 'empty' ? { key: 'errEmpty' } : { key: 'errUnknown', hint: 'errUnknownHint' })
        }
      } catch (err) {
        console.error(err)
        setError({ key: 'errUnknown', hint: 'errUnknownHint' })
      } finally {
        setBusy(false)
      }
    },
    [engine, lang],
  )

  // Archivo soltado antes de que el motor terminara de cargar.
  useEffect(() => {
    if (engine.status === 'ready' && queued.current) {
      const f = queued.current
      queued.current = null
      void openFile(f)
    }
    if (engine.status === 'error' && queued.current) {
      queued.current = null
      setBusy(false)
    }
  }, [engine, openFile])

  const changeLang = (next: Lang) => {
    setLang(next)
    store.set('pokesave.lang', next)
    if (loaded && engine.status === 'ready') {
      const r = engine.engine.summary(next)
      if (r.ok && r.save) setLoaded({ ...loaded, save: r.save })
    }
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    store.set('pokesave.theme', next)
  }

  // Arrastrar y soltar en toda la ventana.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) void openFile(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [openFile])

  const pickFile = () => inputRef.current?.click()

  const downloadOriginal = () => {
    if (engine.status !== 'ready' || !loaded) return
    const name = loaded.fileName.replace(/(\.[^.]*)?$/, (ext) => `.original${ext}`)
    downloadBytes(engine.engine.exportOriginal(), name)
  }

  const pct = engine.status === 'loading' && engine.progress?.total ? Math.round((engine.progress.loaded / engine.progress.total) * 100) : 0

  return (
    <I18nContext.Provider value={{ lang, t }}>
      <div className={`app${dragging ? ' app--dragging' : ''}`}>
        <div className="backdrop" aria-hidden="true" />

        <header className="topbar">
          <a className="brand" href="./" aria-label="PokeSave">
            <Logo />
            <span className="brand__text">
              <strong>PokeSave</strong>
              <small>{t('tagline')}</small>
            </span>
          </a>
          <div className="topbar__right">
            <EnginePill state={engine} pct={pct} onRetry={retryEngine} />
            <div className="seg" role="group" aria-label={t('language')}>
              {(['es', 'en'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => changeLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={t('theme')} title={t('theme')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </header>

        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void openFile(f)
            e.target.value = ''
          }}
        />

        <main className="main">
          {loaded ? (
            <>
              <SaveView save={loaded.save} fileName={loaded.fileName} onAnother={pickFile} onDownloadOriginal={downloadOriginal} />
              {error && <ErrorBox error={error} />}
              {engine.status === 'ready' && (
                <p className="metrics mono">
                  {t('metrics', { engine: engine.engine.loadMs, parse: loaded.parseMs, ver: engine.engine.pkhexVersion })}
                </p>
              )}
            </>
          ) : (
            <Landing busy={busy} engine={engine} error={error} onPick={pickFile} />
          )}
        </main>

        <footer className="footer">
          <p>
            <Icon name="lock" /> {t('privacy')}
          </p>
          <p className="muted">{t('footer')}</p>
        </footer>

        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            <div className="drop-overlay__inner">
              <Icon name="upload" />
              {t('dropTitle')}
            </div>
          </div>
        )}
      </div>
    </I18nContext.Provider>
  )
}

function Landing({
  busy,
  engine,
  error,
  onPick,
}: {
  busy: boolean
  engine: EngineState
  error: { key: Key; hint?: Key } | null
  onPick: () => void
}) {
  const { t } = useI18n()
  const status = busy ? (engine.status === 'ready' ? t('dropReading') : t('dropWaiting')) : null
  return (
    <div className="landing">
      <section className="hero">
        <h1>
          {t('heroTitle1')} <span className="grad">{t('heroTitle2')}</span>
        </h1>
        <p className="lead">{t('heroBody')}</p>
      </section>

      <button type="button" className={`dropzone${busy ? ' dropzone--busy' : ''}`} onClick={onPick} disabled={busy}>
        <span className="dropzone__icon">
          <Icon name="upload" />
        </span>
        <span className="dropzone__title">{status ?? t('dropTitle')}</span>
        {!status && (
          <span className="dropzone__sub">
            {t('dropOr')} <u>{t('dropButton')}</u>
          </span>
        )}
        <span className="dropzone__hint">{t('dropHint')}</span>
        {busy && <span className="dropzone__scan" aria-hidden="true" />}
      </button>

      {error && <ErrorBox error={error} />}
      {engine.status === 'error' && <ErrorBox error={{ key: 'errEngine' }} />}

      <ul className="features">
        <Feature icon="lock" title={t('featPrivate')} body={t('featPrivateBody')} />
        <Feature icon="layers" title={t('featGens')} body={t('featGensBody')} />
        <Feature icon="shield" title={t('featSafe')} body={t('featSafeBody')} />
      </ul>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: 'lock' | 'layers' | 'shield'; title: string; body: string }) {
  return (
    <li className="feature card">
      <span className="feature__icon">
        <Icon name={icon} />
      </span>
      <div>
        <h3>{title}</h3>
        <p className="muted">{body}</p>
      </div>
    </li>
  )
}

function ErrorBox({ error }: { error: { key: Key; hint?: Key } }) {
  const { t } = useI18n()
  return (
    <div className="error card" role="alert">
      <Icon name="alert" />
      <div>
        <strong>{t(error.key)}</strong>
        {error.hint && <p className="muted">{t(error.hint)}</p>}
      </div>
    </div>
  )
}

function EnginePill({ state, pct, onRetry }: { state: EngineState; pct: number; onRetry: () => void }) {
  const { t } = useI18n()
  if (state.status === 'error')
    return (
      <button type="button" className="pill pill--error" onClick={onRetry}>
        <Icon name="refresh" /> {t('retry')}
      </button>
    )
  if (state.status === 'ready')
    return (
      <span className="pill pill--ready" role="status">
        <span className="pill__dot" /> <span className="pill__text">{t('engineReady')}</span>
      </span>
    )
  return (
    <span className="pill" role="status" aria-live="polite">
      <span className="pill__bar" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="pill__spinner" aria-hidden="true" />
      <span className="pill__text">
        {t('engineLoading')} <span className="mono">{pct}%</span>
      </span>
    </span>
  )
}
