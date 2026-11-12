// 마음에 든 게시물 이미지에서 "구조"를 읽어 내는 순수 계산. AI 없이 밝기 분포만 본다.
// 읽는 것: 비율, 하단 어두운 영역의 높이·농도, 제목 글자 덩어리의 위치·크기·정렬·색.
// 못 읽는 것: 글꼴 종류, 외곽선·그림자, 글 내용. 이건 사람이 고른다.
import { CANVAS_WIDTH, RATIOS } from './store'
import type { ReferenceStyle, RatioKey, TitleAlign } from './store'

export interface Pixels {
  data: ArrayLike<number> // RGBA
  width: number
  height: number
}

/** 분석용으로 줄여 읽을 가로 크기. 이보다 크면 느리기만 하고 얻는 게 없다. */
export const ANALYSIS_WIDTH = 200

const TEXT_CONTRAST = 70 // 줄 중앙값 밝기와 이만큼 차이 나면 글자 픽셀로 본다
const GRADIENT_MIN_DARKNESS = 0.15
const TITLE_LINE_HEIGHT = 1.25 // 앱의 기본 줄 간격. 글자 크기를 거꾸로 셀 때 쓴다
const GLYPH_HEIGHT_RATIO = 0.9 // 한글 한 줄에서 글자가 실제로 차지하는 높이 / 글자 크기
const TEXT_TOP_OFFSET = 0.15 // 줄 상자 위쪽 여백 / 글자 크기

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function nearestRatio(width: number, height: number): RatioKey {
  const aspect = width / height
  let best: RatioKey = '4:5'
  let bestGap = Infinity
  for (const key of Object.keys(RATIOS) as RatioKey[]) {
    const gap = Math.abs(aspect - CANVAS_WIDTH / RATIOS[key])
    if (gap < bestGap) {
      best = key
      bestGap = gap
    }
  }
  return best
}

interface Band {
  top: number
  bottom: number // 포함
  count: number
}

/** 하단이 위쪽보다 얼마나 어두운지로 그라데이션의 높이·농도를 짐작한다. 어두워진 게 없으면 높이 0. */
function readGradient(rowMedian: number[]): ReferenceStyle['gradient'] {
  const height = rowMedian.length
  const topReference = median(rowMedian.slice(0, Math.max(1, Math.floor(height * 0.3))))
  const bottom = median(rowMedian.slice(Math.floor(height * 0.9)))
  const darkness = topReference > 8 ? clamp(1 - bottom / topReference, 0, 1) : 0
  if (darkness < GRADIENT_MIN_DARKNESS) return { height: 0, opacity: 0.9 }

  // 아래에서 위로 올라가다 위쪽 밝기를 다시 회복하는 지점이 그라데이션의 윗끝이다.
  const limit = topReference * 0.9
  let top = height
  while (top > 0 && rowMedian[top - 1] <= limit) top--
  return {
    height: Number(clamp((height - top) / height, 0.2, 0.95).toFixed(2)),
    opacity: Number(clamp(darkness, 0.3, 1).toFixed(2)),
  }
}

export function analyzeReference(pixels: Pixels): ReferenceStyle {
  const { data, width, height } = pixels
  const scale = CANVAS_WIDTH / width

  const lum = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    lum[i] = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
  }
  const rowMedian: number[] = []
  for (let y = 0; y < height; y++) {
    rowMedian.push(median(Array.from(lum.subarray(y * width, (y + 1) * width))))
  }

  const style: ReferenceStyle = {
    ratio: nearestRatio(width, height),
    gradient: readGradient(rowMedian),
    title: null,
  }

  // 글자 픽셀: 아래쪽 70% 에서 줄 중앙값과 크게 다른 픽셀
  const startRow = Math.floor(height * 0.3)
  const counts = new Array<number>(height).fill(0)
  const isText = new Uint8Array(width * height)
  for (let y = startRow; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(lum[y * width + x] - rowMedian[y]) >= TEXT_CONTRAST) {
        isText[y * width + x] = 1
        counts[y]++
      }
    }
  }

  // 글자가 있는 줄(행) 묶음 = 한 줄의 글자. 가는 틈(2행 이하)은 이어 붙인다.
  const minCount = Math.max(2, Math.round(width * 0.01))
  const bands: Band[] = []
  for (let y = startRow; y < height; y++) {
    if (counts[y] < minCount) continue
    const last = bands[bands.length - 1]
    if (last && y - last.bottom <= 3) {
      last.bottom = y
      last.count += counts[y]
    } else {
      bands.push({ top: y, bottom: y, count: counts[y] })
    }
  }
  if (bands.length === 0) return style

  // 줄 사이 간격이 줄 높이 정도 이하면 같은 제목 덩어리다. 가장 글자가 많은 덩어리가 제목.
  const blocks: Band[][] = []
  for (const band of bands) {
    const block = blocks[blocks.length - 1]
    const previous = block?.[block.length - 1]
    const gap = previous ? band.top - previous.bottom : Infinity
    const lineHeight = previous ? Math.max(previous.bottom - previous.top + 1, band.bottom - band.top + 1) : 0
    if (block && gap <= lineHeight * 1.2) block.push(band)
    else blocks.push([band])
  }
  const total = (block: Band[]) => block.reduce((sum, band) => sum + band.count, 0)
  const title = blocks.reduce((best, block) => (total(block) > total(best) ? block : best))

  const top = title[0].top
  const bottom = title[title.length - 1].bottom
  let fontSize: number
  if (title.length > 1) {
    const pitch = (title[title.length - 1].top - title[0].top) / (title.length - 1)
    fontSize = (pitch / TITLE_LINE_HEIGHT) * scale
  } else {
    fontSize = (((bottom - top + 1) / GLYPH_HEIGHT_RATIO) * scale)
  }
  fontSize = clamp(Math.round(fontSize), 30, 200)

  // 글자 픽셀의 가로 범위와 색
  let minX = width
  let maxX = -1
  let lighter = 0
  let darker = 0
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < width; x++) {
      if (!isText[y * width + x]) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      if (lum[y * width + x] > rowMedian[y]) lighter++
      else darker++
    }
  }
  const wantLighter = lighter >= darker

  let r = 0
  let g = 0
  let b = 0
  let n = 0
  let accent = { r: 0, g: 0, b: 0, n: 0 }
  const colored: [number, number, number][] = []
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!isText[index] || lum[index] > rowMedian[y] !== wantLighter) continue
      const pr = data[index * 4]
      const pg = data[index * 4 + 1]
      const pb = data[index * 4 + 2]
      r += pr
      g += pg
      b += pb
      n++
      const max = Math.max(pr, pg, pb)
      const saturation = max === 0 ? 0 : (max - Math.min(pr, pg, pb)) / max
      if (saturation >= 0.5 && lum[index] >= 60) colored.push([pr, pg, pb])
    }
  }
  if (n === 0) return style
  const main = { r: r / n, g: g / n, b: b / n }

  // 강조 색: 채도가 높은 글자 픽셀이 충분히 많고 본문 색과 뚜렷이 다를 때만
  if (colored.length >= n * 0.04) {
    for (const [pr, pg, pb] of colored) {
      accent = { r: accent.r + pr, g: accent.g + pg, b: accent.b + pb, n: accent.n + 1 }
    }
    accent = { r: accent.r / accent.n, g: accent.g / accent.n, b: accent.b / accent.n, n: accent.n }
  }
  const accentDistance = Math.hypot(accent.r - main.r, accent.g - main.g, accent.b - main.b)
  const accentColor = accent.n > 0 && accentDistance > 80 ? toHex(accent.r, accent.g, accent.b) : null

  const center = (minX + maxX) / 2
  let align: TitleAlign = 'center'
  if (Math.abs(center - width / 2) > width * 0.08) {
    align = center < width / 2 ? 'left' : 'right'
  }

  style.title = {
    y: Math.round(top * scale - fontSize * TEXT_TOP_OFFSET),
    fontSize,
    align,
    color: toHex(main.r, main.g, main.b),
    accentColor,
    lineCount: title.length,
  }
  return style
}

/** 이미지를 분석 크기로 줄여 픽셀을 읽는다. 브라우저에서만 쓴다. */
export function readPixels(image: HTMLImageElement): Pixels {
  const width = ANALYSIS_WIDTH
  const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('이미지를 분석할 수 없습니다.')
  context.drawImage(image, 0, 0, width, height)
  return { data: context.getImageData(0, 0, width, height).data, width, height }
}
