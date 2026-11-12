import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  allSlides,
  coverScale,
  currentTemplateSettings,
  displaySize,
  gridInset,
  useEditor,
  zoomRange,
} from './store'

const initial = useEditor.getState()

function fakeImage(width: number, height: number): HTMLImageElement {
  return { naturalWidth: width, naturalHeight: height } as HTMLImageElement
}

beforeEach(() => {
  vi.useFakeTimers()
  // 앞 테스트의 마지막 변경과 합쳐지지 않게 시간을 충분히 띄운다.
  vi.setSystemTime(Date.now() + 10_000)
  useEditor.setState(initial, true)
})

describe('사진 맞춤', () => {
  it('캔버스를 빈틈 없이 덮는 배율로 가운데에 놓는다', () => {
    useEditor.getState().setImage(fakeImage(2160, 1350), new Blob())
    // 4:5(1080x1350). 세로를 맞추면 가로가 넘친다.
    expect(useEditor.getState().image).toMatchObject({ scale: 1, x: -540, y: 0 })
  })

  it('비율을 바꾸면 다시 맞추고 제목은 바닥과의 거리를 유지한다', () => {
    useEditor.getState().setImage(fakeImage(1080, 1080), new Blob())
    const before = useEditor.getState().title.y
    useEditor.getState().setRatio('1:1')
    expect(useEditor.getState().image).toMatchObject({ scale: 1, x: 0, y: 0 })
    expect(useEditor.getState().title.y).toBe(before - 270)
  })

  it('coverScale 은 가로·세로 중 더 큰 배율', () => {
    expect(coverScale({ element: fakeImage(540, 1350), crop: null }, '4:5')).toBe(2)
  })
})

describe('가로·세로 따로 늘이기', () => {
  const setup = () => {
    useEditor.getState().setImage(fakeImage(1080, 1350), new Blob())
    return useEditor.getState
  }

  it('가로만 늘이면 사진 가운데가 제자리에 머문다', () => {
    const state = setup()
    state().stretchImage({ stretchX: 2 })
    expect(state().image).toMatchObject({ scale: 1, stretchX: 2, stretchY: 1 })
    // 폭 1080 → 2160, 가운데(540)는 그대로라 왼쪽이 540 만큼 밀림
    expect(displaySize(state().image!)).toEqual({ width: 2160, height: 1350 })
    expect(state().image!.x).toBeCloseTo(-540)
    expect(state().image!.y).toBeCloseTo(0)
  })

  it('세로만 줄여도 가운데가 제자리에 머문다', () => {
    const state = setup()
    state().stretchImage({ stretchY: 0.5 })
    expect(displaySize(state().image!)).toEqual({ width: 1080, height: 675 })
    expect(state().image!.y).toBeCloseTo(337.5)
  })

  it('슬라이더를 끄는 동안은 되돌리기 한 단계로 합친다', () => {
    const state = setup()
    const before = state().past.length
    state().stretchImage({ stretchX: 1.2 })
    state().stretchImage({ stretchX: 1.4 })
    state().stretchImage({ stretchX: 1.6 })
    expect(state().past.length).toBe(before + 1)
    state().undo()
    expect(state().image!.stretchX).toBe(1)
  })

  it('채우기·전체 보이게로 맞추면 늘이기가 풀린다', () => {
    const state = setup()
    state().stretchImage({ stretchX: 2, stretchY: 0.5 })
    state().fitImage('cover')
    expect(state().image).toMatchObject({ stretchX: 1, stretchY: 1 })
  })

  it('손잡이로 끈 결과는 한 번에 반영되고 되돌릴 수 있다', () => {
    const state = setup()
    state().transformImage({ x: 10, y: 20, scale: 1, stretchX: 1.5, stretchY: 0.8 })
    expect(state().image).toMatchObject({ x: 10, y: 20, stretchX: 1.5, stretchY: 0.8 })
    state().undo()
    expect(state().image).toMatchObject({ stretchX: 1, stretchY: 1 })
  })

  it('가로 꽉 채우기는 가로만 캔버스 폭까지 늘리고 세로·세로 위치는 그대로 둔다', () => {
    const state = setup()
    state().zoomImage(0.5, 540, 675) // 540x675 로 줄임
    state().moveImage(100, 200)
    state().stretchToEdge('x')
    expect(displaySize(state().image!)).toEqual({ width: 1080, height: 675 })
    expect(state().image).toMatchObject({ x: 0, y: 200, stretchY: 1 })
  })

  it('세로 꽉 채우기는 세로만 캔버스 높이까지 늘리고 가로·가로 위치는 그대로 둔다', () => {
    const state = setup()
    state().zoomImage(0.5, 540, 675)
    state().moveImage(100, 200)
    state().stretchToEdge('y')
    expect(displaySize(state().image!)).toEqual({ width: 540, height: 1350 })
    expect(state().image).toMatchObject({ x: 100, y: 0, stretchX: 1 })
  })

  it('비율에 맞춰 바뀌고, 이미 늘어난 상태에서도 되돌리기 된다', () => {
    const state = setup()
    state().setRatio('9:16') // 1080x1920
    state().stretchToEdge('y')
    expect(displaySize(state().image!).height).toBe(1920)
    state().undo()
    expect(state().image!.stretchY).toBe(1)
  })

  it('확대(휠·슬라이더)는 늘이기를 유지한 채 전체 크기만 바꾼다', () => {
    const state = setup()
    state().stretchImage({ stretchX: 2 })
    state().zoomImage(2, 540, 675)
    expect(state().image).toMatchObject({ scale: 2, stretchX: 2, stretchY: 1 })
  })
})

describe('전체 보이게 / 확대 범위', () => {
  it('전체 보이게는 사진 전체가 캔버스 안에 들어오고 가운데에 놓인다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(2000, 1000), new Blob())
    state().fitImage('contain')
    // 4:5(1080x1350): 가로 맞춤 0.54, 세로 맞춤 1.35 중 작은 쪽
    expect(state().image).toMatchObject({ scale: 0.54, x: 0 })
    expect(state().image!.y).toBeCloseTo((1350 - 1000 * 0.54) / 2)
    state().fitImage('cover')
    expect(state().image!.scale).toBeCloseTo(1.35)
    state().undo()
    expect(state().image!.scale).toBeCloseTo(0.54)
  })

  it('아주 길쭉한 사진은 확대 최소값이 0.5 아래로 내려가 전체가 보인다', () => {
    const wide = { element: fakeImage(3000, 1000), crop: null }
    // 3:1 사진: 채우기 1.35, 전체 보이게 0.36 → 최소 0.36/1.35 ≈ 0.27
    expect(zoomRange(wide, '4:5').min).toBeCloseTo(0.36 / 1.35)
    expect(zoomRange(wide, '4:5').max).toBe(5)
    // 비율이 비슷한 사진은 기본 0.5 유지
    expect(zoomRange({ element: fakeImage(1080, 1350), crop: null }, '4:5').min).toBe(0.5)
  })
})

describe('자르기', () => {
  it('자른 영역 크기로 캔버스를 덮게 다시 맞춘다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(2000, 1000), new Blob())
    // 4:5(1080x1350). 원본 전체는 세로를 맞춰 배율 1.35, 자른 정사각형 1000x1000 은 가로·세로 중 큰 1.35
    state().setCrop({ x: 500, y: 0, width: 1000, height: 1000 })
    expect(state().image!.crop).toEqual({ x: 500, y: 0, width: 1000, height: 1000 })
    expect(state().image!.scale).toBeCloseTo(1.35)
    expect(state().image!.x).toBeCloseTo((1080 - 1000 * 1.35) / 2)
  })

  it('해제하면 원본 전체로 돌아가고, 되돌리기도 된다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(2000, 1000), new Blob())
    state().setCrop({ x: 0, y: 0, width: 500, height: 500 })
    state().setCrop(null)
    expect(state().image!.crop).toBeNull()
    state().undo()
    expect(state().image!.crop).toEqual({ x: 0, y: 0, width: 500, height: 500 })
  })

  it('비율을 바꿔도 자른 영역이 유지된다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(2000, 1000), new Blob())
    state().setCrop({ x: 0, y: 0, width: 600, height: 600 })
    state().setRatio('1:1')
    expect(state().image!.crop).toEqual({ x: 0, y: 0, width: 600, height: 600 })
    expect(state().image!.scale).toBeCloseTo(1080 / 600)
  })
})

describe('확대', () => {
  it('기준점이 화면에서 제자리에 머문다', () => {
    useEditor.getState().setImage(fakeImage(1080, 1350), new Blob())
    useEditor.getState().zoomImage(2, 540, 675)
    expect(useEditor.getState().image).toMatchObject({ scale: 2, x: -540, y: -675 })
  })
})

describe('되돌리기', () => {
  it('되돌리고 다시 실행한다', () => {
    useEditor.getState().setRatio('1:1')
    useEditor.getState().undo()
    expect(useEditor.getState().ratio).toBe('4:5')
    useEditor.getState().redo()
    expect(useEditor.getState().ratio).toBe('1:1')
  })

  it('같은 값의 연속 변경은 한 단계로 합친다', () => {
    const { setTitle } = useEditor.getState()
    setTitle({ fontSize: 90 })
    vi.advanceTimersByTime(100)
    setTitle({ fontSize: 100 })
    expect(useEditor.getState().past).toHaveLength(1)
    useEditor.getState().undo()
    expect(useEditor.getState().title.fontSize).toBe(84)
  })

  it('간격이 벌어지거나 다른 값이면 따로 쌓는다', () => {
    const { setTitle } = useEditor.getState()
    setTitle({ fontSize: 90 })
    vi.advanceTimersByTime(1000)
    setTitle({ fontSize: 100 })
    setTitle({ color: '#ff0000' })
    expect(useEditor.getState().past).toHaveLength(3)
  })

  it('새로 바꾸면 다시 실행 목록을 비운다', () => {
    useEditor.getState().setRatio('1:1')
    useEditor.getState().undo()
    useEditor.getState().setRatio('9:16')
    expect(useEditor.getState().future).toHaveLength(0)
  })
})

describe('슬라이드', () => {
  it('장마다 사진·글은 따로, 제목 모양은 같이 쓴다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(1080, 1350), new Blob())
    state().setTitle({ text: '첫 장', fontSize: 100 })
    state().addSlide()
    expect(state()).toMatchObject({ activeSlide: 1, image: null })
    expect(state().title).toMatchObject({ text: '제목을 입력하세요', fontSize: 100 })

    state().setTitle({ text: '둘째 장' })
    state().selectSlide(0)
    expect(state().title.text).toBe('첫 장')
    expect(state().image).not.toBeNull()
    expect(allSlides().map((slide) => slide.text)).toEqual(['첫 장', '둘째 장'])
  })

  it('다른 장으로 가도 기록이 남고, 되돌리면 그 작업이 있던 장이 열린다', () => {
    const state = useEditor.getState
    state().setTitle({ text: '첫 장 글' })
    state().addSlide()
    state().setTitle({ text: '둘째 장 글' })

    state().undo() // 둘째 장 글 되돌림
    expect(state()).toMatchObject({ activeSlide: 1 })
    expect(state().title.text).toBe('제목을 입력하세요')

    state().undo() // 장 추가 되돌림
    expect(state().slides).toHaveLength(1)
    expect(state().title.text).toBe('첫 장 글')

    state().undo() // 첫 장 글 되돌림
    expect(state().title.text).toBe('제목을 입력하세요')

    state().redo()
    state().redo()
    state().redo()
    expect(state()).toMatchObject({ activeSlide: 1 })
    expect(state().title.text).toBe('둘째 장 글')
    state().selectSlide(0)
    expect(state().title.text).toBe('첫 장 글')
  })

  it('1번 장 작업을 한 뒤 2번 장을 보다가 되돌리면 1번 장으로 돌아가 되돌린다', () => {
    const state = useEditor.getState
    state().addSlide()
    state().selectSlide(0)
    state().setTitle({ text: '고침' })
    state().selectSlide(1)
    state().undo()
    expect(state().activeSlide).toBe(0)
    expect(state().title.text).toBe('제목을 입력하세요')
  })

  it('장을 지운 것도 되돌린다', () => {
    const state = useEditor.getState
    state().setTitle({ text: 'A' })
    state().addSlide()
    state().setTitle({ text: 'B' })
    state().removeSlide(1)
    state().undo()
    expect(state().slides).toHaveLength(2)
    expect(state().title.text).toBe('B')
  })

  it('비율을 바꾸면 다른 장의 사진도 다시 맞춘다', () => {
    const state = useEditor.getState
    state().setImage(fakeImage(1080, 1080), new Blob())
    state().addSlide()
    state().setRatio('1:1')
    state().selectSlide(0)
    expect(state().image).toMatchObject({ scale: 1, x: 0, y: 0 })
  })

  it('장을 지우면 보던 장이 알맞게 바뀐다', () => {
    const state = useEditor.getState
    state().setTitle({ text: 'A' })
    state().addSlide()
    state().setTitle({ text: 'B' })
    state().addSlide()
    state().setTitle({ text: 'C' })

    state().removeSlide(0) // 앞 장을 지우면 보던 장(C) 번호만 당겨진다
    expect(state()).toMatchObject({ activeSlide: 1 })
    expect(state().title.text).toBe('C')

    state().removeSlide(1) // 보던 장을 지우면 이웃으로 간다
    expect(state().activeSlide).toBe(0)
    expect(state().title.text).toBe('B')

    state().removeSlide(0) // 마지막 한 장은 못 지운다
    expect(state().slides).toHaveLength(1)
  })
})

describe('프로필 격자 안전 영역', () => {
  it('4:5 는 좌우가, 9:16 은 상하가 잘린다', () => {
    expect(gridInset('4:5')).toEqual({ x: 33.75, y: 0 })
    expect(gridInset('1:1')).toEqual({ x: 135, y: 0 })
    expect(gridInset('9:16')).toEqual({ x: 0, y: 240 })
  })
})

describe('보정·푸터', () => {
  it('되돌리기 대상이다', () => {
    useEditor.getState().setAdjust({ brightness: 0.3 })
    useEditor.getState().setFooter({ text: '@me' })
    useEditor.getState().undo()
    expect(useEditor.getState().footer.text).toBe('')
    useEditor.getState().undo()
    expect(useEditor.getState().adjust.brightness).toBe(0)
  })

  it('푸터는 템플릿에 들어가고, 푸터 없는 옛 템플릿은 지금 푸터를 유지한다', () => {
    useEditor.getState().setFooter({ text: '@me', fontSize: 40 })
    const settings = currentTemplateSettings()
    expect(settings.footer).toEqual({ text: '@me', fontSize: 40 })

    useEditor.getState().setFooter({ text: '다른 글' })
    const { footer: _footer, ...old } = settings
    useEditor.getState().applyTemplate(old)
    expect(useEditor.getState().footer.text).toBe('다른 글')

    useEditor.getState().applyTemplate(settings)
    expect(useEditor.getState().footer.text).toBe('@me')
  })
})

describe('템플릿', () => {
  it('제목 글은 빼고 저장하고, 적용해도 지금 제목 글은 그대로 둔다', () => {
    useEditor.getState().setTitle({ text: '처음 글', fontSize: 120 })
    const settings = currentTemplateSettings()
    expect(settings.title).not.toHaveProperty('text')

    useEditor.getState().setTitle({ text: '다른 글', fontSize: 50 })
    useEditor.getState().applyTemplate({ ...settings, ratio: '9:16' })
    expect(useEditor.getState().title).toMatchObject({ text: '다른 글', fontSize: 120 })
    expect(useEditor.getState().ratio).toBe('9:16')
  })
})
