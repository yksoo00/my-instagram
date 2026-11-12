import { beforeEach, describe, expect, it, vi } from 'vitest'
import { coverScale, currentTemplateSettings, gridInset, useEditor } from './store'

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
    useEditor.getState().setImage(fakeImage(2160, 1350))
    // 4:5(1080x1350). 세로를 맞추면 가로가 넘친다.
    expect(useEditor.getState().image).toMatchObject({ scale: 1, x: -540, y: 0 })
  })

  it('비율을 바꾸면 다시 맞추고 제목은 바닥과의 거리를 유지한다', () => {
    useEditor.getState().setImage(fakeImage(1080, 1080))
    const before = useEditor.getState().title.y
    useEditor.getState().setRatio('1:1')
    expect(useEditor.getState().image).toMatchObject({ scale: 1, x: 0, y: 0 })
    expect(useEditor.getState().title.y).toBe(before - 270)
  })

  it('coverScale 은 가로·세로 중 더 큰 배율', () => {
    expect(coverScale(fakeImage(540, 1350), '4:5')).toBe(2)
  })
})

describe('확대', () => {
  it('기준점이 화면에서 제자리에 머문다', () => {
    useEditor.getState().setImage(fakeImage(1080, 1350))
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
