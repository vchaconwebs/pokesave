import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Option } from '../types'
import { useI18n } from '../i18n'

/** Ventana modal: hoja inferior en el móvil, cuadro centrado en pantallas grandes. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`modal__panel${wide ? ' modal__panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal__x" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Desplegable con buscador. Muestra como mucho 60 resultados para ir fluido en el móvil. */
export function Combobox({
  label,
  options,
  value,
  onChange,
  noneLabel,
  disabled = false,
}: {
  label: string
  options: Option[]
  value: number
  onChange: (id: number) => void
  /** Si se pasa, añade una opción "ninguno" con id 0. */
  noneLabel?: string
  disabled?: boolean
}) {
  const { t } = useI18n()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const all = useMemo(() => (noneLabel ? [{ id: 0, name: noneLabel }, ...options] : options), [options, noneLabel])
  const current = all.find((o) => o.id === value)
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    const hits = q ? all.filter((o) => normalize(o.name).includes(q)) : all
    return hits.slice(0, 60)
  }, [all, query])

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (o: Option) => {
    onChange(o.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="combo" ref={root}>
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        className="combo__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o)
          setActive(0)
        }}
      >
        <span id={`${id}-value`} className="truncate">
          {current?.name ?? noneLabel ?? '—'}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="combo__pop">
          <input
            ref={input}
            className="combo__search"
            type="search"
            placeholder={t('search')}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={filtered[active] ? `${id}-o${active}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(filtered.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (filtered[active]) pick(filtered[active])
              } else if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
          />
          <ul ref={list} className="combo__list" role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`}>
            {filtered.length === 0 && <li className="combo__empty">{t('noResults')}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.id}
                id={`${id}-o${i}`}
                data-i={i}
                role="option"
                aria-selected={o.id === value}
                className={`combo__opt${i === active ? ' is-active' : ''}${o.id === value ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o)
                }}
              >
                {o.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Número con botones − / + (cómodo en el móvil) y límites. */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  step?: number
}) {
  const id = useId()
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? Math.round(n) : min))
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="stepper">
        <button type="button" aria-label="−" onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(e.target.valueAsNumber))}
        />
        <button type="button" aria-label="+" onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  )
}
