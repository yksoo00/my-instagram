import { loadImageBlob, useEditor } from './store'

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * 유튜브 영상 주소면 그 영상의 대표 이미지(썸네일) 주소들을 돌려준다. 그 외는 null.
 * 앞쪽이 큰 화질이고, 영상에 따라 없을 수 있어 못 받으면 뒤쪽으로 내려간다.
 */
export function youtubeThumbnails(address: string): string[] | null {
  let url: URL
  try {
    url = new URL(address.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (host === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)
      id = match ? match[1] : null
    }
  }
  if (!id || !YOUTUBE_ID.test(id)) return null
  return [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ]
}

/** 붙여넣은 글이 이미지 주소처럼 보이는지. 한 줄짜리 http(s) 주소만 인정한다. */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.includes('\n') || trimmed.includes(' ')) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchFromServer(url: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch('/api/images/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 백엔드를 실행했는지 확인하세요.')
  }
  if (!response.ok) {
    // 서버가 한국어 사유를 detail 로 준다. 서버가 꺼져 있으면 프록시의 5xx 라서 안내를 바꾼다.
    const detail = await response
      .json()
      .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? body.detail : null))
      .catch(() => null)
    if (detail) throw new Error(detail)
    throw new Error(
      response.status >= 500
        ? '서버에 연결하지 못했습니다. 백엔드를 실행했는지 확인하세요.'
        : `이미지를 가져오지 못했습니다 (${response.status}).`,
    )
  }
  return response.blob()
}

/** WEBP·GIF 는 편집기가 저장하지 못하므로 PNG 로 바꾼다(GIF 는 첫 장면). JPG·PNG 는 그대로. */
export async function toStorableBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png' || blob.type === 'image/jpeg') return blob
  const url = URL.createObjectURL(blob)
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = element.naturalWidth
    canvas.height = element.naturalHeight
    canvas.getContext('2d')?.drawImage(element, 0, 0)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (png) => (png ? resolve(png) : reject(new Error('이미지를 변환하지 못했습니다.'))),
        'image/png',
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 이미지 주소에서 사진을 가져와 지금 장에 넣는다. 실패하면 이유를 오류 문구로 남기고 false. */
export async function importImageFromUrl(address: string): Promise<boolean> {
  const { setError } = useEditor.getState()
  setError(null)
  try {
    const candidates = youtubeThumbnails(address) ?? [address.trim()]
    let blob: Blob | null = null
    let lastError: unknown = null
    for (const candidate of candidates) {
      try {
        blob = await fetchFromServer(candidate)
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!blob) throw lastError
    await loadImageBlob(await toStorableBlob(blob))
    return true
  } catch (error) {
    setError(error instanceof Error ? error.message : '이미지를 가져오지 못했습니다.')
    return false
  }
}
