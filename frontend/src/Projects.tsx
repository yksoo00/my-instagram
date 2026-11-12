import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { api, errorMessage } from './api'
import type { ProjectSummary } from './api'
import { buildProjectData, openProject } from './projectIo'
import { Section } from './Section'

const NAME_MAX = 50

interface ProjectsState {
  items: ProjectSummary[]
  busy: boolean
  error: string | null
  load: () => Promise<void>
  save: (name: string) => Promise<void>
  open: (id: number) => Promise<void>
  remove: (id: number) => Promise<void>
}

// 저장·불러오기는 사진을 올리고 받느라 오래 걸릴 수 있어서 busy 로 버튼을 잠근다.
const useProjects = create<ProjectsState>((set) => {
  const run = async (action: () => Promise<void>) => {
    set({ busy: true, error: null })
    try {
      await action()
    } catch (error) {
      set({ error: errorMessage(error) })
    } finally {
      set({ busy: false })
    }
  }
  return {
    items: [],
    busy: false,
    error: null,
    load: () => run(async () => set({ items: await api.listProjects() })),
    save: (name) =>
      run(async () => {
        await api.saveProject(name, await buildProjectData())
        set({ items: await api.listProjects() })
      }),
    open: (id) => run(() => openProject(id)),
    remove: (id) =>
      run(async () => {
        await api.deleteProject(id)
        set({ items: await api.listProjects() })
      }),
  }
})

export function Projects() {
  const { items, busy, error, load, save, open, remove } = useProjects()
  const [name, setName] = useState('')
  const trimmed = name.trim()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Section title="프로젝트 (전체 작업 저장)">
      <ul className="phrases">
        {items.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`지금 작업을 닫고 "${project.name}"을(를) 불러올까요?`)) {
                  void open(project.id)
                }
              }}
            >
              {project.name}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`"${project.name}" 삭제`}
              onClick={() => {
                if (window.confirm(`"${project.name}"을(를) 삭제할까요?`)) void remove(project.id)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && !error && <p className="hint">아직 저장한 프로젝트가 없습니다.</p>}
      <label>
        이름
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          placeholder="예: 고양이 카드뉴스"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!trimmed || busy}
        onClick={() => {
          void save(trimmed)
          setName('')
        }}
      >
        {busy ? '처리 중...' : '지금 작업 전체를 저장'}
      </button>
      <p className="hint">
        모든 장의 사진·글·보정과 위치를 저장합니다. 같은 이름으로 저장하면 덮어씁니다.
      </p>
      {error && <p className="error">{error}</p>}
    </Section>
  )
}
