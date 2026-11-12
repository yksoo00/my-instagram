import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { api, errorMessage } from './api'
import type { Template } from './api'
import { Section } from './Section'
import { currentTemplateSettings, useEditor } from './store'

const NAME_MAX = 50

interface TemplatesState {
  items: Template[]
  error: string | null
  load: () => Promise<void>
  save: (name: string) => Promise<void>
  remove: (id: number) => Promise<void>
}

const useTemplates = create<TemplatesState>((set, get) => ({
  items: [],
  error: null,
  load: async () => {
    try {
      set({ items: await api.listTemplates(), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
  save: async (name) => {
    try {
      await api.saveTemplate(name, currentTemplateSettings())
      await get().load()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
  remove: async (id) => {
    try {
      await api.deleteTemplate(id)
      await get().load()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
}))

export function Templates() {
  const { items, error, load, save, remove } = useTemplates()
  const applyTemplate = useEditor((state) => state.applyTemplate)
  const [name, setName] = useState('')
  const trimmed = name.trim()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Section title="템플릿">
      <ul className="phrases">
        {items.map((template) => (
          <li key={template.id}>
            <button type="button" onClick={() => applyTemplate(template.settings)}>
              {template.name}
            </button>
            <button
              type="button"
              aria-label={`"${template.name}" 삭제`}
              onClick={() => void remove(template.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && (
        <p className="hint">아직 저장한 템플릿이 없습니다.</p>
      )}
      <label>
        이름
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder="예: 뉴스 기본"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!trimmed}
        onClick={() => {
          void save(trimmed)
          setName('')
        }}
      >
        지금 설정을 템플릿으로 저장
      </button>
      <p className="hint">
        비율·그라데이션·제목 모양을 저장합니다. 같은 이름으로 저장하면 덮어씁니다.
      </p>
      {error && <p className="error">{error}</p>}
    </Section>
  )
}
