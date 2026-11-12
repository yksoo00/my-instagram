import { useState } from 'react'
import { useCustomFonts } from './fontStore'
import { Section } from './Section'
import { FONTS } from './store'

const NAME_MAX = 50
const EXTENSION = /\.(ttf|otf|woff2?)$/i

export function CustomFonts() {
  const { items, busy, error, add, remove } = useCustomFonts()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const trimmed = name.trim()

  const submit = async () => {
    // 내장 글꼴과 이름이 겹치면 어느 쪽인지 알 수 없어서 막는다.
    if (FONTS.some((font) => font.value.toLowerCase() === trimmed.toLowerCase())) {
      setLocalError('내장 글꼴과 같은 이름은 쓸 수 없습니다.')
      return
    }
    if (!file) return
    setLocalError(null)
    if (await add(file, trimmed)) {
      setFile(null)
      setName('')
    }
  }

  return (
    <Section title="내 글꼴 (직접 추가)">
      <ul className="phrases">
        {items.map((font) => (
          <li key={font.id}>
            <span className="font-item" style={{ fontFamily: `"${font.name}"` }}>
              {font.name}
            </span>
            <button
              type="button"
              disabled={busy}
              aria-label={`"${font.name}" 삭제`}
              onClick={() => {
                if (window.confirm(`"${font.name}" 글꼴을 삭제할까요?`)) void remove(font.id)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p className="hint">아직 추가한 글꼴이 없습니다.</p>}

      <label>
        글꼴 파일 (TTF · OTF · WOFF · WOFF2, 15MB 이하)
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null
            setFile(picked)
            setLocalError(null)
            // 이름 칸이 비어 있으면 파일 이름에서 확장자를 뺀 걸 기본값으로 채운다.
            if (picked && !name.trim()) {
              setName(picked.name.replace(EXTENSION, '').slice(0, NAME_MAX))
            }
          }}
        />
      </label>
      <label>
        글꼴 이름 (목록에 보이는 이름)
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder="예: 눈누 기초고딕"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="button" disabled={!file || !trimmed || busy} onClick={() => void submit()}>
        {busy ? '처리 중...' : '글꼴 추가'}
      </button>
      <p className="hint">
        무료 한글 글꼴은 눈누(noonnu.cc) 같은 곳에서 받을 수 있습니다. 상업적으로 써도 되는지
        글꼴 라이선스를 꼭 확인하세요. 추가한 글꼴은 제목 글꼴 목록의 "내 글꼴"에 나타납니다.
      </p>
      {(localError ?? error) && <p className="error">{localError ?? error}</p>}
    </Section>
  )
}
