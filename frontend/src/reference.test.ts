import { describe, expect, it } from 'vitest'
import { analyzeReference } from './reference'
import type { Pixels } from './reference'

type Rgb = [number, number, number]

/** 픽셀 함수로 합성 이미지를 만든다. 실제 사진 대신 구조가 알려진 그림으로 검사한다. */
function make(width: number, height: number, paint: (x: number, y: number) => Rgb): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y)
      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

/** 위쪽은 회색 200, 아래 절반은 바닥으로 갈수록 어두워지는 사진 */
function photo(y: number, height: number): Rgb {
  const start = height / 2
  if (y < start) return [200, 200, 200]
  const v = 200 - ((y - start) / (height - start)) * 180
  return [v, v, v]
}

describe('analyzeReference', () => {
  const W = 100
  const H = 125 // 4:5

  it('비율을 가장 가까운 규격으로 고른다', () => {
    const flat = (w: number, h: number) => analyzeReference(make(w, h, () => [120, 120, 120])).ratio
    expect(flat(100, 125)).toBe('4:5')
    expect(flat(100, 100)).toBe('1:1')
    expect(flat(90, 160)).toBe('9:16')
  })

  it('하단이 어두워진 정도로 그라데이션 높이·농도를 짐작한다', () => {
    const { gradient } = analyzeReference(make(W, H, (_, y) => photo(y, H)))
    expect(gradient.height).toBeGreaterThan(0.35)
    expect(gradient.height).toBeLessThan(0.65)
    expect(gradient.opacity).toBeGreaterThan(0.7)
  })

  it('어두워지지 않은 사진은 그라데이션 없음', () => {
    const { gradient } = analyzeReference(make(W, H, () => [180, 180, 180]))
    expect(gradient.height).toBe(0)
  })

  it('가운데 정렬된 흰 제목 한 줄의 위치·크기·색을 읽는다', () => {
    // 가로 30~70, 세로 95~106 (12행) 흰 글자 덩어리
    const pixels = make(W, H, (x, y) =>
      y >= 95 && y <= 106 && x >= 30 && x <= 70 ? [255, 255, 255] : photo(y, H),
    )
    const { title } = analyzeReference(pixels)
    expect(title).not.toBeNull()
    expect(title!.align).toBe('center')
    expect(title!.color).toBe('#ffffff')
    expect(title!.lineCount).toBe(1)
    // 1080 폭 기준: 글자 높이 12행 ≈ 12/0.9*10.8 ≈ 144px
    expect(title!.fontSize).toBeGreaterThan(130)
    expect(title!.fontSize).toBeLessThanOrEqual(160)
    // 덩어리 윗끝 95행 → 약 1026px 에서 위쪽 여백만큼 올라간 값
    expect(title!.y).toBeGreaterThan(1000)
    expect(title!.y).toBeLessThan(1030)
    expect(title!.accentColor).toBeNull()
  })

  it('왼쪽에 붙은 글자는 왼쪽 정렬, 오른쪽은 오른쪽 정렬', () => {
    const at = (x0: number, x1: number) =>
      analyzeReference(
        make(W, H, (x, y) => (y >= 95 && y <= 106 && x >= x0 && x <= x1 ? [255, 255, 255] : photo(y, H))),
      ).title!.align
    expect(at(8, 45)).toBe('left')
    expect(at(55, 92)).toBe('right')
  })

  it('두 줄이면 줄 간격으로 글자 크기를 구하고 줄 수를 센다', () => {
    // 줄 높이 8행, 줄 시작 간격 14행 → 글자 크기 ≈ 14/1.25*10.8 ≈ 121px
    const rows = (y: number) => (y >= 85 && y <= 92) || (y >= 99 && y <= 106)
    const pixels = make(W, H, (x, y) => (rows(y) && x >= 20 && x <= 80 ? [255, 255, 255] : photo(y, H)))
    const { title } = analyzeReference(pixels)
    expect(title!.lineCount).toBe(2)
    expect(title!.fontSize).toBeGreaterThan(110)
    expect(title!.fontSize).toBeLessThan(135)
  })

  it('채도 높은 강조 글자가 충분하면 강조색을 읽는다', () => {
    // 글자가 한 줄의 절반을 넘으면 줄 중앙값이 글자색이 돼 버리므로 폭 41 로 둔다. 흰색 21 + 노랑 20
    const pixels = make(W, H, (x, y) => {
      if (y < 95 || y > 106 || x < 30 || x > 70) return photo(y, H)
      return x < 51 ? [255, 255, 255] : [255, 212, 0]
    })
    const { title } = analyzeReference(pixels)
    expect(title!.accentColor).toBe('#ffd400')
  })

  it('글자가 없으면 title 이 null', () => {
    expect(analyzeReference(make(W, H, (_, y) => photo(y, H))).title).toBeNull()
  })
})
