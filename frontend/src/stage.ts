import type Konva from 'konva'
import { CANVAS_WIDTH, RATIOS, useEditor } from './store'

/** Canvas 가 그린 Stage. 패널의 저장 버튼이 여기서 꺼내 쓴다. */
export const stageRef: { current: Konva.Stage | null } = { current: null }

// 확대 범위. 캔버스를 딱 덮는 배율 대비 몇 배인지.
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 5

export type ExportFormat = 'png' | 'jpg'

const JPG_QUALITY = 0.95

export function exportImage(format: ExportFormat): void {
  const stage = stageRef.current
  if (!stage) return
  const height = RATIOS[useEditor.getState().ratio]
  const previous = { width: stage.width(), height: stage.height(), scale: stage.scaleX() }

  // 화면 배율의 역수를 pixelRatio 로 주면 소수 오차로 1079px 이 나올 수 있어서,
  // 잠깐 원래 크기(1080 폭)로 돌려 그린 뒤 되돌린다.
  stage.size({ width: CANVAS_WIDTH, height })
  stage.scale({ x: 1, y: 1 })
  // 바탕을 검은 Rect 로 채우므로 JPG 로 저장해도 투명 부분이 없다.
  const url = stage.toDataURL({
    pixelRatio: 1,
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    quality: JPG_QUALITY,
  })
  stage.size({ width: previous.width, height: previous.height })
  stage.scale({ x: previous.scale, y: previous.scale })
  stage.batchDraw()

  const link = document.createElement('a')
  link.href = url
  link.download = `instagram-${Date.now()}.${format}`
  link.click()
}
