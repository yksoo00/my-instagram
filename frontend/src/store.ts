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
}

interface EditorState {
  ratio: RatioKey
  image: ImageState | null
  gradient: GradientState
  title: TitleState
  error: string | null
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

export const useEditor = create<EditorState>((set) => ({
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
  },
  error: null,

  setRatio: (ratio) =>
    set((state) => ({
      ratio,
      image: state.image ? fit(state.image.element, ratio) : null,
      // 제목은 아래쪽 기준으로 놓는 요소라서 바닥과의 거리를 유지한다.
      title: {
        ...state.title,
        y: state.title.y + RATIOS[ratio] - RATIOS[state.ratio],
      },
    })),

  setImage: (element) =>
    set((state) => ({ image: fit(element, state.ratio), error: null })),

  moveImage: (x, y) =>
    set((state) => (state.image ? { image: { ...state.image, x, y } } : {})),

  // origin(캔버스 좌표)이 화면에서 제자리에 머물도록 위치를 같이 옮긴다.
  zoomImage: (scale, originX, originY) =>
    set((state) => {
      const image = state.image
      if (!image) return {}
      const factor = scale / image.scale
      return {
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
      state.image ? { image: fit(state.image.element, state.ratio) } : {},
    ),

  setGradient: (patch) =>
    set((state) => ({ gradient: { ...state.gradient, ...patch } })),

  setTitle: (patch) => set((state) => ({ title: { ...state.title, ...patch } })),

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
    const previous = useEditor.getState().image
    if (previous) URL.revokeObjectURL(previous.element.src)
    setImage(element)
  }
  element.onerror = () => {
    URL.revokeObjectURL(url)
    setError('이미지를 읽지 못했습니다.')
  }
  element.src = url
}
