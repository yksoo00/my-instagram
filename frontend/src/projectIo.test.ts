import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { buildProjectData } from './projectIo'
import { useEditor } from './store'

vi.mock('./api', () => ({
  api: { uploadImage: vi.fn() },
}))

const initial = useEditor.getState()
const upload = vi.mocked(api.uploadImage)

function image(blob: Blob) {
  return { element: {} as HTMLImageElement, blob, x: 1, y: 2, scale: 3 }
}

beforeEach(() => {
  useEditor.setState(initial, true)
  upload.mockReset()
  upload.mockImplementation(async () => ({ file: `${'a'.repeat(31)}${upload.mock.calls.length}.png` }))
})

describe('buildProjectData', () => {
  it('사진을 올리고 파일 이름·위치로 바꾼다. 제목 글은 장별 text 로만 담는다', async () => {
    useEditor.setState({
      image: image(new Blob(['a'])),
      slides: [{ image: null, adjust: { brightness: 0, contrast: 0 }, text: '' }],
    })
    useEditor.getState().setTitle({ text: '첫 장' })

    const data = await buildProjectData()
    expect(data.slides).toEqual([
      {
        image: { file: `${'a'.repeat(31)}1.png`, x: 1, y: 2, scale: 3 },
        adjust: { brightness: 0, contrast: 0 },
        text: '첫 장',
      },
    ])
    expect(data.title).not.toHaveProperty('text')
  })

  it('같은 사진은 두 번째 저장부터 다시 올리지 않는다', async () => {
    useEditor.setState({ image: image(new Blob(['b'])) })
    await buildProjectData()
    await buildProjectData()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('사진 없는 장은 image 가 null', async () => {
    const data = await buildProjectData()
    expect(data.slides[0].image).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })
})
