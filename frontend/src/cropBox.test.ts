import { describe, expect, it } from 'vitest'
import { MIN_CROP_PIXELS, clampBox, fullBox, toCropRect } from './cropBox'

const natural = { width: 1000, height: 500 }

describe('clampBox', () => {
  it('변을 끌면 그 변만 움직이고, 사진 밖으로 나가지 않는다', () => {
    const box = clampBox(fullBox(), 'w', 0.2, 0.9, natural)
    expect(box).toEqual({ left: 0.2, top: 0, right: 1, bottom: 1 }) // w 는 세로 이동을 무시
    expect(clampBox(fullBox(), 'e', 0.5, 0, natural).right).toBe(1) // 이미 끝이라 더 못 늘어남
    expect(clampBox({ left: 0.1, top: 0, right: 1, bottom: 1 }, 'w', -0.5, 0, natural).left).toBe(0)
  })

  it('모서리는 두 변을 같이 움직인다', () => {
    const box = clampBox(fullBox(), 'se', -0.3, -0.2, natural)
    expect(box).toMatchObject({ left: 0, top: 0, right: 0.7, bottom: 0.8 })
  })

  it('최소 크기 아래로 줄이지 못한다', () => {
    const box = clampBox(fullBox(), 'e', -1, 0, natural)
    expect(box.right - box.left).toBeCloseTo(MIN_CROP_PIXELS / natural.width)
    const tall = clampBox(fullBox(), 's', 0, -1, natural)
    expect(tall.bottom - tall.top).toBeCloseTo(MIN_CROP_PIXELS / natural.height)
  })

  it('안쪽을 끌면 크기는 그대로 위치만 움직이고, 가장자리에서 멈춘다', () => {
    const start = { left: 0.2, top: 0.2, right: 0.6, bottom: 0.6 }
    const box = clampBox(start, 'move', 0.1, -0.1, natural)
    expect(box.left).toBeCloseTo(0.3)
    expect(box.top).toBeCloseTo(0.1)
    expect(box.right - box.left).toBeCloseTo(0.4)

    const stuck = clampBox(start, 'move', 5, 5, natural)
    expect(stuck.right).toBeCloseTo(1)
    expect(stuck.bottom).toBeCloseTo(1)
    expect(stuck.right - stuck.left).toBeCloseTo(0.4)
  })
})

describe('toCropRect', () => {
  it('비율을 원본 픽셀 정수로 바꾼다', () => {
    expect(toCropRect({ left: 0.1, top: 0.2, right: 0.6, bottom: 0.9 }, natural)).toEqual({
      x: 100,
      y: 100,
      width: 500,
      height: 350,
    })
  })

  it('전체 상자는 원본 전체', () => {
    expect(toCropRect(fullBox(), natural)).toEqual({ x: 0, y: 0, width: 1000, height: 500 })
  })
})
