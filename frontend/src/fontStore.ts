import { create } from 'zustand'
import { api, errorMessage } from './api'
import type { CustomFont } from './api'

interface CustomFontsState {
  items: CustomFont[]
  /** 글꼴이 등록·삭제될 때마다 올라간다. 캔버스가 이걸 보고 제목을 다시 그린다. */
  version: number
  busy: boolean
  error: string | null
  load: () => Promise<void>
  add: (file: File, name: string) => Promise<boolean>
  remove: (id: number) => Promise<void>
}

// 브라우저에 등록한 글꼴. 서버 목록과 맞춰서 없어진 글꼴은 브라우저에서도 뺀다.
const registered = new Map<number, FontFace>()

async function register(font: CustomFont): Promise<void> {
  if (registered.has(font.id)) return
  const face = new FontFace(font.name, `url(/api/fonts/files/${font.file})`)
  await face.load()
  document.fonts.add(face)
  registered.set(font.id, face)
}

function unregisterMissing(items: CustomFont[]): void {
  const ids = new Set(items.map((item) => item.id))
  for (const [id, face] of registered) {
    if (!ids.has(id)) {
      document.fonts.delete(face)
      registered.delete(id)
    }
  }
}

export const useCustomFonts = create<CustomFontsState>((set) => {
  const sync = async () => {
    const items = await api.listFonts()
    unregisterMissing(items)
    // 한 글꼴이 깨져 있어도 나머지는 쓸 수 있게 따로 등록한다.
    await Promise.allSettled(items.map(register))
    set((state) => ({ items, version: state.version + 1 }))
  }
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    set({ busy: true, error: null })
    try {
      await action()
      return true
    } catch (error) {
      set({ error: errorMessage(error) })
      return false
    } finally {
      set({ busy: false })
    }
  }
  return {
    items: [],
    version: 0,
    busy: false,
    error: null,
    load: async () => {
      await run(sync)
    },
    add: (file, name) =>
      run(async () => {
        await api.uploadFont(file, name)
        await sync()
      }),
    remove: async (id) => {
      await run(async () => {
        await api.deleteFont(id)
        await sync()
      })
    },
  }
})
