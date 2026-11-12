// 자르기 상자 계산. 화면 이벤트와 떼어 놓아서 값만으로 검사할 수 있다.

/** 원본 크기에 대한 비율(0~1)로 나타낸 상자 */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** 상자가 이보다 작아지면 사진이 사실상 사라지므로 막는다 (원본 픽셀) */
export const MIN_CROP_PIXELS = 40

export function fullBox(): Box {
  return { left: 0, top: 0, right: 1, bottom: 1 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 끌기 시작 때의 상자(start)를 dx·dy(비율 단위 이동량)만큼 움직인 상자.
 * 사진 밖으로 못 나가고 최소 크기 아래로 못 줄어든다.
 */
export function clampBox(
  start: Box,
  handle: Handle | 'move',
  dx: number,
  dy: number,
  natural: { width: number; height: number },
): Box {
  const minW = MIN_CROP_PIXELS / natural.width
  const minH = MIN_CROP_PIXELS / natural.height

  if (handle === 'move') {
    const width = start.right - start.left
    const height = start.bottom - start.top
    const left = clamp(start.left + dx, 0, 1 - width)
    const top = clamp(start.top + dy, 0, 1 - height)
    return { left, top, right: left + width, bottom: top + height }
  }

  const box = { ...start }
  if (handle.includes('w')) box.left = clamp(start.left + dx, 0, start.right - minW)
  if (handle.includes('e')) box.right = clamp(start.right + dx, start.left + minW, 1)
  if (handle.includes('n')) box.top = clamp(start.top + dy, 0, start.bottom - minH)
  if (handle.includes('s')) box.bottom = clamp(start.bottom + dy, start.top + minH, 1)
  return box
}

/** 비율 상자를 원본 픽셀 영역으로 바꾼다 (정수로 반올림하고 원본 안에 가둔다). */
export function toCropRect(
  box: Box,
  natural: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const x = Math.round(box.left * natural.width)
  const y = Math.round(box.top * natural.height)
  const right = Math.round(box.right * natural.width)
  const bottom = Math.round(box.bottom * natural.height)
  return {
    x,
    y,
    width: Math.max(1, Math.min(natural.width, right) - x),
    height: Math.max(1, Math.min(natural.height, bottom) - y),
  }
}
