import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { api, errorMessage } from './api'
import type { SavedPhrase } from './api'
import library from './phrases.json'
import { Section } from './Section'
import { useEditor } from './store'

const MY_CATEGORY = '내 문구'
const TOPIC_SLOT = '{주제}'
const TOPIC_PLACEHOLDER = '○○'
const PHRASE_MAX = 100

interface MyPhrasesState {
  items: SavedPhrase[]
  error: string | null
  load: () => Promise<void>
  add: (text: string) => Promise<void>
  remove: (id: number) => Promise<void>
}

const useMyPhrases = create<MyPhrasesState>((set, get) => ({
  items: [],
  error: null,
  load: async () => {
    try {
      set({ items: await api.listPhrases(), error: null })
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
  add: async (text) => {
    try {
      await api.savePhrase(text)
      await get().load()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
  remove: async (id) => {
    try {
      await api.deletePhrase(id)
      await get().load()
    } catch (error) {
      set({ error: errorMessage(error) })
    }
  },
}))

export function Phrases() {
  const titleText = useEditor((state) => state.title.text)
  const setTitle = useEditor((state) => state.setTitle)
  const { items, error, load, add, remove } = useMyPhrases()
  const [category, setCategory] = useState(library[0].category)
  const [topic, setTopic] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const isMine = category === MY_CATEGORY
  const fill = (phrase: string) =>
    phrase.replaceAll(TOPIC_SLOT, topic.trim() || TOPIC_PLACEHOLDER)
  const libraryPhrases = library.find((item) => item.category === category)?.phrases ?? []
  const currentText = titleText.trim()
  const tooLong = currentText.length > PHRASE_MAX
  const alreadySaved = items.some((item) => item.text === currentText)

  return (
    <Section title="문구 추천">
      <label>
        분류
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {library.map((item) => (
            <option key={item.category} value={item.category}>
              {item.category}
            </option>
          ))}
          <option value={MY_CATEGORY}>{MY_CATEGORY}</option>
        </select>
      </label>
      {!isMine && (
        <label>
          주제 (문구의 {TOPIC_PLACEHOLDER} 자리에 들어갑니다)
          <input
            type="text"
            value={topic}
            maxLength={30}
            placeholder="예: 고양이"
            onChange={(event) => setTopic(event.target.value)}
          />
        </label>
      )}
      <ul className="phrases">
        {isMine
          ? items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setTitle({ text: item.text })}>
                  {item.text}
                </button>
                <button
                  type="button"
                  aria-label={`"${item.text}" 삭제`}
                  onClick={() => void remove(item.id)}
                >
                  ×
                </button>
              </li>
            ))
          : libraryPhrases.map((phrase) => (
              <li key={phrase}>
                <button type="button" onClick={() => setTitle({ text: fill(phrase) })}>
                  {fill(phrase)}
                </button>
              </li>
            ))}
      </ul>
      {isMine && items.length === 0 && !error && (
        <p className="hint">아직 저장한 문구가 없습니다.</p>
      )}
      <button
        type="button"
        disabled={!currentText || tooLong || alreadySaved}
        onClick={() => void add(currentText)}
      >
        지금 제목을 내 문구에 저장
      </button>
      {tooLong && (
        <p className="error">내 문구는 {PHRASE_MAX}자까지 저장할 수 있습니다.</p>
      )}
      {error && <p className="error">{error}</p>}
    </Section>
  )
}
