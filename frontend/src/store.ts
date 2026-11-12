import { create } from 'zustand'

// 편집 상태는 전부 1080 폭 기준 좌표로 둔다. 화면에는 줄여서 보이고, 저장할 때만 원래 크기로 그린다.
export const CANVAS_WIDTH = 1080
export const RATIOS = { '4:5': 1350, '1:1': 1080, '9:16': 1920 } as const
export type RatioKey = keyof typeof RATIOS
export const TITLE_PADDING = 80

export const FONTS = [
  { value: 'Malgun Gothic', label: '맑은 고딕' },
  { value: 'Gulim', label: '굴림' },
  { value: 'Batang', label: '바탕' },
  { value: 'Gungsuh', label: '궁서' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Impact', label: 'Impact' },
] as const

export interface ImageState {
  element: HTMLImageElement
  x: number
  y: number
  scale: number
}

export interface GradientState {
  /** 캔버스 높이 대비 비율 (0~1) */
  height: number
  opacity: number
}

export type TitleAlign = 'left' | 'center' | 'right'

export interface TitleState {
  text: string
  fontFamily: string
  fontSize: number
  bold: boolean
  color: string
  align: TitleAlign
  y: number
  lineHeight: number
  letterSpacing: number
  /** 0 이면 외곽선 없음 */
  strokeWidth: number
  strokeColor: string
  shadow: boolean
}

/** 되돌리기 대상. 오류 문구 같은 화면 상태는 넣지 않는다. */
interface Snapshot {
  ratio: RatioKey
  image: ImageState | null
  gradient: GradientState
  title: TitleState
}

interface EditorState extends Snapshot {
  past: Snapshot[]
  future: Snapshot[]
  error: string | null
  undo: () => void
  redo: () => void
  setRatio: (ratio: RatioKey) => void
  setImage: (element: HTMLImageElement) => void
  moveImage: (x: number, y: number) => void
  zoomImage: (scale: number, originX: number, originY: number) => void
  fitImage: () => void
  setGradient: (patch: Partial<GradientState>) => void
  setTitle: (patch: Partial<TitleState>) => void
  setError: (error: string | null) => void
}

/** 캔버스를 빈틈 없이 덮는 최소 배율 */
export function coverScale(element: HTMLImageElement, ratio: RatioKey): number {
  return Math.max(
    CANVAS_WIDTH / element.naturalWidth,
    RATIOS[ratio] / element.naturalHeight,
  )
}

function fit(element: HTMLImageElement, ratio: RatioKey): ImageState {
  const scale = coverScale(element, ratio)
  return {
    element,
    scale,
    x: (CANVAS_WIDTH - element.naturalWidth * scale) / 2,
    y: (RATIOS[ratio] - element.naturalHeight * scale) / 2,
  }
}

const DEFAULT_RATIO: RatioKey = '4:5'

const HISTORY_LIMIT = 100
const MERGE_WINDOW_MS = 600
let lastKey: string | null = null
let lastTime = 0

function snapshot(state: Snapshot): Snapshot {
  return {
    ratio: state.ratio,
    image: state.image,
    gradient: state.gradient,
    title: state.title,
  }
}

/**
 * 바꾸기 직전 상태를 되돌리기 목록에 쌓는다.
 * 슬라이더·타이핑은 값이 연달아 바뀌므로, 같은 key 가 짧은 간격으로 이어지면 한 단계로 합친다.
 */
function record(state: EditorState, key: string | null) {
  const now = Date.now()
  const merge = key !== null && key === lastKey && now - lastTime < MERGE_WINDOW_MS
  lastKey = key
  lastTime = now
  return {
    past: merge
      ? state.past
      : [...state.past.slice(-(HISTORY_LIMIT - 1)), snapshot(state)],
    future: [],
  }
}

export const useEditor = create<EditorState>((set) => ({
  past: [],
  future: [],

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      if (!previous) return {}
      lastKey = null
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      }
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0]
      if (!next) return {}
      lastKey = null
      return {
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(1),
      }
    }),

  ratio: DEFAULT_RATIO,
  image: null,
  gradient: { height: 0.5, opacity: 0.9 },
  title: {
    text: '제목을 입력하세요',
    fontFamily: FONTS[0].value,
    fontSize: 84,
    bold: true,
    color: '#ffffff',
    align: 'center',
    y: RATIOS[DEFAULT_RATIO] - 320,
    lineHeight: 1.25,
    letterSpacing: 0,
    strokeWidth: 0,
    strokeColor: '#000000',
    shadow: true,
  },
  error: null,

  setRatio: (ratio) =>
    set((state) => ({
      ...record(state, null),
      ratio,
      image: state.image ? fit(state.image.element, ratio) : null,
      // 제목은 아래쪽 기준으로 놓는 요소라서 바닥과의 거리를 유지한다.
      title: {
        ...state.title,
        y: state.title.y + RATIOS[ratio] - RATIOS[state.ratio],
      },
    })),

  setImage: (element) =>
    set((state) => ({
      ...record(state, null),
      image: fit(element, state.ratio),
      error: null,
    })),

  moveImage: (x, y) =>
    set((state) =>
      state.image
        ? { ...record(state, null), image: { ...state.image, x, y } }
        : {},
    ),

  // origin(캔버스 좌표)이 화면에서 제자리에 머물도록 위치를 같이 옮긴다.
  zoomImage: (scale, originX, originY) =>
    set((state) => {
      const image = state.image
      if (!image) return {}
      const factor = scale / image.scale
      return {
        ...record(state, 'zoom'),
        image: {
          ...image,
          scale,
          x: originX - (originX - image.x) * factor,
          y: originY - (originY - image.y) * factor,
        },
      }
    }),

  fitImage: () =>
    set((state) =>
      state.image
        ? { ...record(state, null), image: fit(state.image.element, state.ratio) }
        : {},
    ),

  setGradient: (patch) =>
    set((state) => ({
      ...record(state, `gradient:${Object.keys(patch).join()}`),
      gradient: { ...state.gradient, ...patch },
    })),

  setTitle: (patch) =>
    set((state) => ({
      ...record(state, `title:${Object.keys(patch).join()}`),
      title: { ...state.title, ...patch },
    })),

  setError: (error) => set({ error }),
}))

const ALLOWED_TYPES = ['image/jpeg', 'image/png']

export function loadImageFile(file: File): void {
  const { setImage, setError } = useEditor.getState()
  if (!ALLOWED_TYPES.includes(file.type)) {
    setError('JPG 또는 PNG 파일만 올릴 수 있습니다.')
    return
  }
  const url = URL.createObjectURL(file)
  const element = new Image()
  element.onload = () => {
    // 이미 읽어 들인 사진은 주소를 해제해도 계속 그릴 수 있어서, 되돌리기에 남은 이전 사진도 문제없다.
    URL.revokeObjectURL(url)
    setImage(element)
  }
  element.onerror = () => {
    URL.revokeObjectURL(url)
    setError('이미지를 읽지 못했습니다.')
  }
  element.src = url
}
