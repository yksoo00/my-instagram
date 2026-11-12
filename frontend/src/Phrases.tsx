import { useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import library from './phrases.json'
import { useEditor } from './store'

const MY_CATEGORY = '내 문구'
const TOPIC_SLOT = '{주제}'
const TOPIC_PLACEHOLDER = '○○'

interface MyPhrasesState {
  phrases: string[]
  add: (phrase: string) => void
  remove: (phrase: string) => void
}

// 내 문구는 이 브라우저에만 남는다. 백엔드 저장을 붙이면 그쪽으로 옮긴다.
const useMyPhrases = create<MyPhrasesState>()(
  persist(
    (set) => ({
      phrases: [],
      add: (phrase) =>
        set((state) =>
          state.phrases.includes(phrase) ? {} : { phrases: [phrase, ...state.phrases] },
        ),
      remove: (phrase) =>
        set((state) => ({ phrases: state.phrases.filter((item) => item !== phrase) })),
    }),
    { name: 'my-phrases' },
  ),
)

export function Phrases() {
  const titleText = useEditor((state) => state.title.text)
  const setTitle = useEditor((state) => state.setTitle)
  const myPhrases = useMyPhrases()
  const [category, setCategory] = useState(library[0].category)
  const [topic, setTopic] = useState('')

  const isMine = category === MY_CATEGORY
  const phrases = isMine
    ? myPhrases.phrases
    : (library.find((item) => item.category === category)?.phrases ?? [])
  const fill = (phrase: string) =>
    phrase.replaceAll(TOPIC_SLOT, topic.trim() || TOPIC_PLACEHOLDER)
  const currentText = titleText.trim()

  return (
    <section>
      <h2>문구 추천</h2>
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
        {phrases.map((phrase) => (
          <li key={phrase}>
            <button type="button" onClick={() => setTitle({ text: fill(phrase) })}>
              {fill(phrase)}
            </button>
            {isMine && (
              <button
                type="button"
                className="remove"
                aria-label={`"${phrase}" 삭제`}
                onClick={() => myPhrases.remove(phrase)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {isMine && phrases.length === 0 && (
        <p className="hint">아직 저장한 문구가 없습니다.</p>
      )}
      <button
        type="button"
        disabled={!currentText || myPhrases.phrases.includes(currentText)}
        onClick={() => myPhrases.add(currentText)}
      >
        지금 제목을 내 문구에 저장
      </button>
    </section>
  )
}
