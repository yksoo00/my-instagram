import { describe, expect, it } from 'vitest'
import { layoutTitle } from './titleLayout'
import type { TitleLayoutOptions } from './titleLayout'

// 글자 하나의 폭을 10 으로 본다.
const options: TitleLayoutOptions = {
  maxWidth: 100,
  fontSize: 20,
  lineHeight: 1.5,
  letterSpacing: 0,
  align: 'left',
  measure: (text) => text.length * 10,
}

describe('layoutTitle', () => {
  it('한 줄에 들어가면 조각 하나', () => {
    expect(layoutTitle('가나다', options)).toEqual({
      segments: [{ text: '가나다', emphasis: false, x: 0, y: 0 }],
      height: 30,
    })
  })

  it('낱말 사이에서 줄을 바꾸고 줄 끝 공백은 버린다', () => {
    const { segments, height } = layoutTitle('가나다라마 바사아자차', options)
    expect(segments.map((segment) => [segment.text, segment.y])).toEqual([
      ['가나다라마', 0],
      ['바사아자차', 30],
    ])
    expect(height).toBe(60)
  })

  it('한 줄보다 긴 낱말은 글자 단위로 끊는다', () => {
    const { segments } = layoutTitle('가나다라마바사아자차카타', options)
    expect(segments.map((segment) => segment.text)).toEqual(['가나다라마바사아자차', '카타'])
  })

  it('엔터는 줄을 바꾸고 빈 줄도 높이를 차지한다', () => {
    const { segments, height } = layoutTitle('가\n\n나', options)
    expect(segments.map((segment) => [segment.text, segment.y])).toEqual([
      ['가', 0],
      ['나', 60],
    ])
    expect(height).toBe(90)
  })

  it('별표로 감싼 부분을 강조 조각으로 나누고 별표는 지운다', () => {
    const { segments } = layoutTitle('가*나다*라', options)
    expect(segments).toEqual([
      { text: '가', emphasis: false, x: 0, y: 0 },
      { text: '나다', emphasis: true, x: 10, y: 0 },
      { text: '라', emphasis: false, x: 30, y: 0 },
    ])
  })

  it('가운데·오른쪽 정렬은 남는 폭만큼 민다', () => {
    expect(layoutTitle('가나', { ...options, align: 'center' }).segments[0].x).toBe(40)
    expect(layoutTitle('가나', { ...options, align: 'right' }).segments[0].x).toBe(80)
  })

  it('자간은 글자 수만큼 폭에 더한다', () => {
    const { segments } = layoutTitle('가*나*', { ...options, letterSpacing: 5 })
    expect(segments[1].x).toBe(15)
  })
})
