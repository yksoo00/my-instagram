import { describe, expect, it } from 'vitest'
import { looksLikeUrl, youtubeThumbnails } from './imageUrl'

describe('youtubeThumbnails', () => {
  const id = 'dQw4w9WgXcQ'
  const expected = [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ]

  it('여러 모양의 유튜브 영상 주소에서 영상 ID 를 뽑는다', () => {
    expect(youtubeThumbnails(`https://www.youtube.com/watch?v=${id}&t=30s`)).toEqual(expected)
    expect(youtubeThumbnails(`https://youtu.be/${id}?si=abc`)).toEqual(expected)
    expect(youtubeThumbnails(`https://m.youtube.com/watch?v=${id}`)).toEqual(expected)
    expect(youtubeThumbnails(`https://www.youtube.com/shorts/${id}`)).toEqual(expected)
    expect(youtubeThumbnails(`https://www.youtube.com/embed/${id}`)).toEqual(expected)
  })

  it('유튜브가 아니거나 ID 모양이 아니면 null', () => {
    expect(youtubeThumbnails('https://example.com/a.png')).toBeNull()
    expect(youtubeThumbnails('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(youtubeThumbnails('https://www.youtube.com/')).toBeNull()
    expect(youtubeThumbnails('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeThumbnails('not a url')).toBeNull()
  })
})

describe('looksLikeUrl', () => {
  it('한 줄짜리 http(s) 주소만 인정한다', () => {
    expect(looksLikeUrl('https://example.com/a.png')).toBe(true)
    expect(looksLikeUrl('  http://example.com/a.png  ')).toBe(true)
    expect(looksLikeUrl('ftp://example.com/a.png')).toBe(false)
    expect(looksLikeUrl('example.com/a.png')).toBe(false)
    expect(looksLikeUrl('https://example.com/a b.png')).toBe(false)
    expect(looksLikeUrl('안녕하세요')).toBe(false)
    expect(looksLikeUrl('https://a.com\nhttps://b.com')).toBe(false)
  })
})
