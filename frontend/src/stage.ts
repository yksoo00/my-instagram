import type Konva from 'konva'
import { CANVAS_WIDTH, RATIOS, allSlides, useEditor } from './store'

/** Canvas 가 그린 Stage. 패널의 저장 버튼이 여기서 꺼내 쓴다. */
export const stageRef: { current: Konva.Stage | null } = { current: null }

/** 지금 그려진 사진 노드. 크기 손잡이 층이 이걸 붙잡는다. */
export const photoNodeRef: { current: Konva.Image | null } = { current: null }


export type ExportFormat = 'png' | 'jpg'

const JPG_QUALITY = 0.95

export function exportImage(format: ExportFormat, name = String(Date.now())): void {
  const stage = stageRef.current
  if (!stage) return
  const height = RATIOS[useEditor.getState().ratio]
  const previous = { width: stage.width(), height: stage.height(), scale: stage.scaleX() }

  // 화면 배율의 역수를 pixelRatio 로 주면 소수 오차로 1079px 이 나올 수 있어서,
  // 잠깐 원래 크기(1080 폭)로 돌려 그린 뒤 되돌린다.
  stage.size({ width: CANVAS_WIDTH, height })
  stage.scale({ x: 1, y: 1 })
  // 크기 손잡이는 편집용 표시라서 저장 그림에 들어가지 않게 잠깐 숨긴다.
  const transformers = stage.find('Transformer')
  transformers.forEach((transformer) => transformer.visible(false))
  // 바탕을 검은 Rect 로 채우므로 JPG 로 저장해도 투명 부분이 없다.
  const url = stage.toDataURL({
    pixelRatio: 1,
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    quality: JPG_QUALITY,
  })
  transformers.forEach((transformer) => transformer.visible(true))
  stage.size({ width: previous.width, height: previous.height })
  stage.scale({ x: previous.scale, y: previous.scale })
  stage.batchDraw()

  const link = document.createElement('a')
  link.href = url
  link.download = `instagram-${name}.${format}`
  link.click()
}

/** React 가 장을 바꿔 그리고 Konva 가 화면에 반영할 때까지 기다린다. */
function afterRender(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/** 사진이 있는 모든 장을 차례로 저장한다. 끝나면 보던 장으로 돌아온다. */
export async function exportAll(format: ExportFormat): Promise<void> {
  const { activeSlide } = useEditor.getState()
  const stamp = Date.now()
  const slides = allSlides()
  for (let index = 0; index < slides.length; index++) {
    if (!slides[index].image) continue
    useEditor.getState().selectSlide(index)
    await afterRender()
    exportImage(format, `${stamp}-${index + 1}`)
  }
  useEditor.getState().selectSlide(activeSlide)
}
