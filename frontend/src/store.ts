import { create } from 'zustand'

// 편집 상태는 전부 1080 폭 기준 좌표로 둔다. 화면에는 줄여서 보이고, 저장할 때만 원래 크기로 그린다.
export const CANVAS_WIDTH = 1080
export const RATIOS = { '4:5': 1350, '1:1': 1080, '9:16': 1920 } as const
export type RatioKey = keyof typeof RATIOS
export const TITLE_PADDING = 80

// 위 3개는 같이 묶어 배포하는 웹폰트(fonts.ts), 나머지는 Windows 기본 글꼴.
export const FONTS = [
  { value: 'Pretendard', label: 'Pretendard' },
  { value: 'Black Han Sans', label: '검은고딕' },
  { value: 'Do Hyeon', label: '도현' },
  { value: 'Malgun Gothic', label: '맑은 고딕' },
  { value: 'Gulim', label: '굴림' },
  { value: 'Batang', label: '바탕' },
  { value: 'Gungsuh', label: '궁서' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Impact', label: 'Impact' },
] as const

/** 원본 사진에서 남길 영역(원본 픽셀 단위). 원본은 그대로 두고 보이는 부분만 정한다. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageState {
  element: HTMLImageElement
  /** 올린 원본 파일. 프로젝트로 저장할 때 서버에 올린다. */
  blob: Blob
  /** 자른 영역. null 이면 원본 전체 */
  crop: CropRect | null
  /** 자른 영역의 왼쪽 위가 놓인 캔버스 좌표 */
  x: number
  y: number
  /** 자른 영역 기준 배율(가로·세로 같이) */
  scale: number
  /** 가로·세로를 따로 늘이거나 줄인 정도. 1 이면 원래 비율. 화면 크기는 scale × stretch. */
  stretchX: number
  stretchY: number
}

/** 화면에 그려지는 사진 크기(캔버스 좌표) */
export function displaySize(image: Pick<ImageState, 'element' | 'crop' | 'scale' | 'stretchX' | 'stretchY'>): {
  width: number
  height: number
} {
  const { width, height } = sourceSize(image)
  return { width: width * image.scale * image.stretchX, height: height * image.scale * image.stretchY }
}

/** 화면에 쓰이는 원본 쪽 크기. 자르기가 있으면 자른 영역 크기. */
export function sourceSize(image: Pick<ImageState, 'element' | 'crop'>): {
  width: number
  height: number
} {
  return image.crop
    ? { width: image.crop.width, height: image.crop.height }
    : { width: image.element.naturalWidth, height: image.element.naturalHeight }
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
  /** 제목에서 *별표*로 감싼 부분의 색 */
  accentColor: string
  align: TitleAlign
  y: number
  lineHeight: number
  letterSpacing: number
  /** 0 이면 외곽선 없음 */
  strokeWidth: number
  strokeColor: string
  shadow: boolean
}

/** 사진 보정. 0 이 원본이다. */
export interface AdjustState {
  /** -1 ~ 1 */
  brightness: number
  /** -100 ~ 100 (Konva Contrast 필터 단위) */
  contrast: number
}

/** 하단 모서리의 계정명·출처 표기. 빈 문자열이면 그리지 않는다. */
export interface FooterState {
  text: string
  fontSize: number
}

/**
 * 인스타 프로필 격자는 게시물 가운데를 3:4 로 잘라 보여 준다.
 * 잘리지 않고 보이는 영역이 캔버스 가장자리에서 얼마나 안쪽인지 (1080 폭 기준 좌표).
 */
export function gridInset(ratio: RatioKey): { x: number; y: number } {
  const height = RATIOS[ratio]
  const visibleWidth = Math.min(CANVAS_WIDTH, (height * 3) / 4)
  const visibleHeight = Math.min(height, (CANVAS_WIDTH * 4) / 3)
  return { x: (CANVAS_WIDTH - visibleWidth) / 2, y: (height - visibleHeight) / 2 }
}

/** 참고 이미지에서 읽어 낸 구조. 글자 덩어리를 못 찾으면 title 이 null. */
export interface ReferenceStyle {
  ratio: RatioKey
  gradient: GradientState
  title: {
    y: number
    fontSize: number
    align: TitleAlign
    color: string
    /** 본문 색과 뚜렷이 다른 채도 높은 색이 있을 때만 */
    accentColor: string | null
    lineCount: number
  } | null
}

/** 되돌리기 대상. 오류 문구 같은 화면 상태는 넣지 않는다. */
interface Snapshot {
  ratio: RatioKey
  image: ImageState | null
  adjust: AdjustState
  gradient: GradientState
  title: TitleState
  footer: FooterState
  /** 모든 장. 장 추가·삭제와 다른 장의 변화까지 한 줄기로 되돌리려고 통째로 담는다. */
  slides: SlideData[]
  activeSlide: number
}

/** 템플릿으로 저장하는 값. 사진과 제목 글은 게시물마다 달라서 뺀다. */
export interface TemplateSettings {
  ratio: RatioKey
  gradient: GradientState
  title: Omit<TitleState, 'text'>
  /** 계정명은 게시물마다 반복되므로 템플릿에 넣는다. 예전에 저장한 템플릿에는 없다. */
  footer?: FooterState
}

/**
 * 슬라이드마다 다른 것만 담는다. 비율·그라데이션·제목 모양·푸터는 모든 장이 같이 쓴다.
 * 지금 고르고 있는 장의 값은 최상위 필드(image·adjust·title.text)에 있고,
 * 이 목록에서 그 장의 칸은 장을 옮길 때까지 오래된 값이다.
 */
export interface SlideData {
  image: ImageState | null
  adjust: AdjustState
  text: string
}

interface EditorState extends Snapshot {
  past: Snapshot[]
  future: Snapshot[]
  error: string | null
  /** 각 장 오른쪽 위에 "1/5" 표시 */
  numbering: boolean
  setNumbering: (numbering: boolean) => void
  addSlide: () => void
  selectSlide: (index: number) => void
  removeSlide: (index: number) => void
  /** 화면 보조선. 되돌리기·저장 대상이 아니다. */
  showGuide: boolean
  setShowGuide: (show: boolean) => void
  setAdjust: (patch: Partial<AdjustState>) => void
  setFooter: (patch: Partial<FooterState>) => void
  applyTemplate: (settings: TemplateSettings) => void
  applyReference: (style: ReferenceStyle) => void
  undo: () => void
  redo: () => void
  setRatio: (ratio: RatioKey) => void
  setImage: (element: HTMLImageElement, blob: Blob) => void
  /** 자르기를 바꾸고 새 영역에 맞춰 다시 배치한다. null 이면 자르기 해제. */
  setCrop: (crop: CropRect | null) => void
  moveImage: (x: number, y: number) => void
  zoomImage: (scale: number, originX: number, originY: number) => void
  /** cover: 캔버스를 꽉 채움(넘치는 부분은 잘림), contain: 사진 전체가 보이게 */
  fitImage: (mode?: 'cover' | 'contain') => void
  /** 가로·세로를 따로 늘이거나 줄인다. 사진 가운데가 제자리에 머문다. */
  stretchImage: (patch: { stretchX?: number; stretchY?: number }) => void
  /** 캔버스에서 손잡이로 끈 결과를 한 번에 반영한다(되돌리기 한 단계). */
  transformImage: (next: { x: number; y: number; scale: number; stretchX: number; stretchY: number }) => void
  /** 가로(x) 또는 세로(y) 한쪽만 캔버스 끝까지 늘린다. 다른 방향 크기와 위치는 그대로. */
  stretchToEdge: (axis: 'x' | 'y') => void
  /** 캔버스에서 사진이 선택돼 손잡이가 보이는지. 화면 상태라서 되돌리기·저장 대상이 아니다. */
  photoSelected: boolean
  setPhotoSelected: (selected: boolean) => void
  setGradient: (patch: Partial<GradientState>) => void
  setTitle: (patch: Partial<TitleState>) => void
  setError: (error: string | null) => void
}

/** 캔버스를 빈틈 없이 덮는 최소 배율 */
export function coverScale(image: Pick<ImageState, 'element' | 'crop'>, ratio: RatioKey): number {
  const { width, height } = sourceSize(image)
  return Math.max(CANVAS_WIDTH / width, RATIOS[ratio] / height)
}

/** 캔버스 안에 사진 전체가 들어오는 최대 배율. 한 변이 남아 검은 바탕이 보인다. */
export function containScale(
  image: Pick<ImageState, 'element' | 'crop'>,
  ratio: RatioKey,
): number {
  const { width, height } = sourceSize(image)
  return Math.min(CANVAS_WIDTH / width, RATIOS[ratio] / height)
}

export const ZOOM_MAX = 5
const ZOOM_MIN_DEFAULT = 0.5

/**
 * 확대 범위(채우기 배율의 몇 배인지). 아주 길쭉한 사진은 0.5배로 줄여도 전체가 안 들어오므로,
 * 최소값을 "전체가 보이는 배율"까지 내려 준다.
 */
export function zoomRange(
  image: Pick<ImageState, 'element' | 'crop'>,
  ratio: RatioKey,
): { min: number; max: number } {
  const contain = containScale(image, ratio) / coverScale(image, ratio)
  return { min: Math.min(ZOOM_MIN_DEFAULT, contain), max: ZOOM_MAX }
}

function fit(
  source: Pick<ImageState, 'element' | 'blob' | 'crop'>,
  ratio: RatioKey,
  mode: 'cover' | 'contain' = 'cover',
): ImageState {
  const { element, blob, crop } = source
  const scale = mode === 'cover' ? coverScale(source, ratio) : containScale(source, ratio)
  const { width, height } = sourceSize(source)
  return {
    element,
    blob,
    crop,
    scale,
    stretchX: 1,
    stretchY: 1,
    x: (CANVAS_WIDTH - width * scale) / 2,
    y: (RATIOS[ratio] - height * scale) / 2,
  }
}

const DEFAULT_RATIO: RatioKey = '4:5'
const DEFAULT_TEXT = '제목을 입력하세요'
const DEFAULT_ADJUST: AdjustState = { brightness: 0, contrast: 0 }

/** 비율이 바뀌면 지금 장이 아닌 장의 사진도 새 비율에 다시 맞춘다. */
function refitSlides(slides: SlideData[], ratio: RatioKey): SlideData[] {
  return slides.map((slide) =>
    slide.image ? { ...slide, image: fit(slide.image, ratio) } : slide,
  )
}

/** 최상위 필드의 지금 장 값을 목록에 반영한 목록 */
function withLiveSlide(state: EditorState): SlideData[] {
  return state.slides.map((slide, index) =>
    index === state.activeSlide
      ? { image: state.image, adjust: state.adjust, text: state.title.text }
      : slide,
  )
}

/** 모든 장의 값. 지금 장은 최상위 필드 값을 쓴다. */
export function allSlides(): SlideData[] {
  return withLiveSlide(useEditor.getState())
}

const HISTORY_LIMIT = 100
const MERGE_WINDOW_MS = 600
let lastKey: string | null = null
let lastTime = 0

function snapshot(state: EditorState): Snapshot {
  return {
    ratio: state.ratio,
    image: state.image,
    adjust: state.adjust,
    gradient: state.gradient,
    title: state.title,
    footer: state.footer,
    slides: withLiveSlide(state),
    activeSlide: state.activeSlide,
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
  adjust: DEFAULT_ADJUST,
  footer: { text: '', fontSize: 32 },
  showGuide: false,
  slides: [{ image: null, adjust: DEFAULT_ADJUST, text: DEFAULT_TEXT }],
  activeSlide: 0,
  numbering: false,
  gradient: { height: 0.5, opacity: 0.9 },
  title: {
    text: DEFAULT_TEXT,
    fontFamily: FONTS[0].value,
    fontSize: 84,
    bold: true,
    color: '#ffffff',
    accentColor: '#ffd400',
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
      slides: refitSlides(state.slides, ratio),
      image: state.image ? fit(state.image, ratio) : null,
      // 제목은 아래쪽 기준으로 놓는 요소라서 바닥과의 거리를 유지한다.
      title: {
        ...state.title,
        y: state.title.y + RATIOS[ratio] - RATIOS[state.ratio],
      },
    })),

  setImage: (element, blob) =>
    set((state) => ({
      ...record(state, null),
      image: fit({ element, blob, crop: null }, state.ratio),
      error: null,
    })),

  setCrop: (crop) =>
    set((state) =>
      state.image
        ? { ...record(state, null), image: fit({ ...state.image, crop }, state.ratio) }
        : {},
    ),

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

  photoSelected: false,
  setPhotoSelected: (photoSelected) => set({ photoSelected }),

  stretchImage: (patch) =>
    set((state) => {
      const image = state.image
      if (!image) return {}
      const stretchX = patch.stretchX ?? image.stretchX
      const stretchY = patch.stretchY ?? image.stretchY
      const before = displaySize(image)
      const after = displaySize({ ...image, stretchX, stretchY })
      return {
        // 슬라이더를 끄는 동안은 한 단계로 합친다
        ...record(state, `stretch:${Object.keys(patch).join()}`),
        image: {
          ...image,
          stretchX,
          stretchY,
          x: image.x + (before.width - after.width) / 2,
          y: image.y + (before.height - after.height) / 2,
        },
      }
    }),

  stretchToEdge: (axis) =>
    set((state) => {
      const image = state.image
      if (!image) return {}
      const source = sourceSize(image)
      // 늘이기 배율이 아니라 전체 크기(캔버스 좌표)가 캔버스 한 변과 같아지게 정한다.
      return axis === 'x'
        ? {
            ...record(state, null),
            image: { ...image, stretchX: CANVAS_WIDTH / (source.width * image.scale), x: 0 },
          }
        : {
            ...record(state, null),
            image: { ...image, stretchY: RATIOS[state.ratio] / (source.height * image.scale), y: 0 },
          }
    }),

  transformImage: (next) =>
    set((state) =>
      state.image ? { ...record(state, null), image: { ...state.image, ...next } } : {},
    ),

  fitImage: (mode = 'cover') =>
    set((state) =>
      state.image
        ? { ...record(state, null), image: fit(state.image, state.ratio, mode) }
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

  setShowGuide: (showGuide) => set({ showGuide }),

  setNumbering: (numbering) => set({ numbering }),

  // 장을 옮기는 건 편집이 아니라서 되돌리기에 쌓지 않는다.
  // 되돌릴 때는 스냅샷에 든 장으로 같이 돌아가므로, 작업이 있던 장이 자동으로 열린다.
  selectSlide: (index) =>
    set((state) => {
      const slides = withLiveSlide(state)
      const target = slides[index]
      if (!target || index === state.activeSlide) return {}
      lastKey = null
      return {
        slides,
        activeSlide: index,
        image: target.image,
        adjust: target.adjust,
        title: { ...state.title, text: target.text },
      }
    }),

  addSlide: () =>
    set((state) => ({
      ...record(state, null),
      slides: [
        ...withLiveSlide(state),
        { image: null, adjust: DEFAULT_ADJUST, text: DEFAULT_TEXT },
      ],
      activeSlide: state.slides.length,
      image: null,
      adjust: DEFAULT_ADJUST,
      title: { ...state.title, text: DEFAULT_TEXT },
    })),

  removeSlide: (index) =>
    set((state) => {
      if (state.slides.length <= 1 || !state.slides[index]) return {}
      const slides = withLiveSlide(state).filter((_, i) => i !== index)
      const active =
        index === state.activeSlide
          ? Math.min(index, slides.length - 1)
          : index < state.activeSlide
            ? state.activeSlide - 1
            : state.activeSlide
      const target = slides[active]
      return {
        ...record(state, null),
        slides,
        activeSlide: active,
        image: target.image,
        adjust: target.adjust,
        title: { ...state.title, text: target.text },
      }
    }),

  setAdjust: (patch) =>
    set((state) => ({
      ...record(state, `adjust:${Object.keys(patch).join()}`),
      adjust: { ...state.adjust, ...patch },
    })),

  setFooter: (patch) =>
    set((state) => ({
      ...record(state, `footer:${Object.keys(patch).join()}`),
      footer: { ...state.footer, ...patch },
    })),

  // 글꼴 종류·외곽선·그림자·줄 간격은 이미지에서 알 수 없으니 지금 값을 그대로 둔다.
  applyReference: (style) =>
    set((state) => {
      const { accentColor, y, fontSize, align, color } = style.title ?? {}
      return {
        ...record(state, null),
        ratio: style.ratio,
        slides: refitSlides(state.slides, style.ratio),
        image: state.image ? fit(state.image, style.ratio) : null,
        gradient: style.gradient,
        title: style.title
          ? {
              ...state.title,
              y: y!,
              fontSize: fontSize!,
              align: align!,
              color: color!,
              accentColor: accentColor ?? state.title.accentColor,
            }
          : state.title,
      }
    }),

  applyTemplate: (settings) =>
    set((state) => ({
      ...record(state, null),
      ratio: settings.ratio,
      slides: refitSlides(state.slides, settings.ratio),
      image: state.image ? fit(state.image, settings.ratio) : null,
      gradient: settings.gradient,
      title: { ...settings.title, text: state.title.text },
      footer: settings.footer ?? state.footer,
    })),
}))

/** 프로젝트 하나를 이루는 모든 값. 서버에 저장·불러오기 하는 단위. */
export interface ProjectState {
  ratio: RatioKey
  gradient: GradientState
  title: Omit<TitleState, 'text'>
  footer: FooterState
  numbering: boolean
  slides: SlideData[]
}

export function currentProject(): ProjectState {
  const state = useEditor.getState()
  const { text: _text, ...style } = state.title
  return {
    ratio: state.ratio,
    gradient: state.gradient,
    title: style,
    footer: state.footer,
    numbering: state.numbering,
    slides: allSlides(),
  }
}

/** 작업 전체를 갈아끼운다. 되돌리기 기록은 새 프로젝트와 무관하므로 비운다. */
export function replaceProject(project: ProjectState): void {
  const first = project.slides[0]
  lastKey = null
  useEditor.setState({
    ratio: project.ratio,
    gradient: project.gradient,
    title: { ...project.title, text: first.text },
    footer: project.footer,
    numbering: project.numbering,
    slides: project.slides,
    activeSlide: 0,
    image: first.image,
    adjust: first.adjust,
    past: [],
    future: [],
    error: null,
  })
}

export function currentTemplateSettings(): TemplateSettings {
  const { ratio, gradient, title, footer } = useEditor.getState()
  const { text: _text, ...style } = title
  return { ratio, gradient, title: style, footer }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png']

/** JPG·PNG 데이터를 읽어 지금 장의 사진으로 넣는다. 읽지 못하면 오류 문구를 남기고 reject. */
export function loadImageBlob(blob: Blob): Promise<void> {
  const { setImage, setError } = useEditor.getState()
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const element = new Image()
    element.onload = () => {
      // 이미 읽어 들인 사진은 주소를 해제해도 계속 그릴 수 있어서, 되돌리기에 남은 이전 사진도 문제없다.
      URL.revokeObjectURL(url)
      setImage(element, blob)
      resolve()
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      setError('이미지를 읽지 못했습니다.')
      reject(new Error('이미지를 읽지 못했습니다.'))
    }
    element.src = url
  })
}

export function loadImageFile(file: File): void {
  const { setError } = useEditor.getState()
  if (!ALLOWED_TYPES.includes(file.type)) {
    setError('JPG 또는 PNG 파일만 올릴 수 있습니다.')
    return
  }
  // 실패 문구는 loadImageBlob 이 이미 남겼으므로 여기서는 reject 를 삼킨다.
  void loadImageBlob(file).catch(() => {})
}
