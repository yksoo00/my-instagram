import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import { loadImageFile } from './store'

/** 이름·값·슬라이더를 한 묶음으로 보여 주는 패널 입력 */
export function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string
  display: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  // 트랙의 채워진 부분을 CSS 로 그리려고 위치(%)를 변수로 넘긴다.
  const fill = ((value - min) / (max - min)) * 100
  return (
    <label className="field">
      <span className="field-head">
        <span>{label}</span>
        <output>{display}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-head">
        <span>{label}</span>
      </span>
      {children}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" />
      <span>{children}</span>
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <span>{label}</span>
    </label>
  )
}

/** 사진 고르기 버튼. 숨긴 파일 입력을 라벨로 감싼다. */
export function OpenImage({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <label className={`button ${className ?? ''}`}>
      <input
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) loadImageFile(file)
          event.target.value = ''
        }}
      />
      <Icon name="image" />
      {children}
    </label>
  )
}
