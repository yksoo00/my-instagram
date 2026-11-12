import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useCustomFonts } from './fontStore'
import { FONTS } from './store'

interface Option {
  /** CSS font-family 로 쓰는 값 */
  value: string
  label: string
  group: '기본 글꼴' | '내 글꼴'
}

/** 검색하고 고를 수 있는 글꼴 목록. 각 글꼴을 자기 모양으로 보여 준다. */
export function FontPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (fontFamily: string) => void
}) {
  const customFonts = useCustomFonts((state) => state.items)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const options = useMemo<Option[]>(
    () => [
      ...FONTS.map((font) => ({ value: font.value, label: font.label, group: '기본 글꼴' as const })),
      ...customFonts.map((font) => ({ value: font.name, label: font.name, group: '내 글꼴' as const })),
    ],
    [customFonts],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    // 한글 이름(label)과 영문 글꼴 이름(value) 둘 다로 찾는다. 예: "검은" 으로도 "black" 으로도 찾힘.
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
    )
  }, [options, query])

  const current = options.find((option) => option.value === value)
  const currentLabel = current?.label ?? `${value} (없음)`

  // 바깥을 누르면 닫는다.
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // 키보드로 움직일 때 highlight 한 항목이 보이는 위치로 스크롤한다.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-highlight="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const openPicker = () => {
    setQuery('')
    setHighlight(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  const choose = (option: Option) => {
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((index) => Math.min(filtered.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[highlight]
      if (option) choose(option)
    }
  }

  let lastGroup: Option['group'] | null = null

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        type="button"
        className="font-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ fontFamily: `"${value}"` }}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span>{currentLabel}</span>
        <span className="font-picker-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="font-picker-popover" onKeyDown={handleKeyDown}>
          <input
            type="text"
            autoFocus
            value={query}
            placeholder="글꼴 이름 검색"
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlight(0)
            }}
          />
          <ul ref={listRef} role="listbox">
            {filtered.map((option, index) => {
              const header = option.group !== lastGroup ? option.group : null
              lastGroup = option.group
              return (
                <li key={`${option.group}:${option.value}`} role="presentation">
                  {header && <p className="font-picker-group">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    data-highlight={index === highlight}
                    className={`font-picker-option ${option.value === value ? 'selected' : ''} ${index === highlight ? 'highlight' : ''}`}
                    style={{ fontFamily: `"${option.value}"` }}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(option)}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="hint font-picker-empty">찾는 글꼴이 없습니다.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
