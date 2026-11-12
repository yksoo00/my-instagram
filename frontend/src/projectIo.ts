import { api } from './api'
import type { ProjectData } from './api'
import { currentProject, replaceProject } from './store'
import type { ImageState, SlideData } from './store'

// 이미 서버에 올린 사진은 다시 올리지 않는다. 사진(Blob)을 열쇠로 서버 파일 이름을 기억한다.
// 프로젝트를 불러올 때 받아 온 사진도 여기 등록해서, 저장할 때 같은 파일을 가리킨다.
const uploaded = new WeakMap<Blob, string>()

async function serverFile(image: ImageState): Promise<string> {
  const known = uploaded.get(image.blob)
  if (known) return known
  const { file } = await api.uploadImage(image.blob)
  uploaded.set(image.blob, file)
  return file
}

/** 지금 작업을 서버에 저장할 모양으로 만든다. 아직 안 올린 사진은 이때 올린다. */
export async function buildProjectData(): Promise<ProjectData> {
  const project = currentProject()
  const slides: ProjectData['slides'] = []
  for (const slide of project.slides) {
    const image = slide.image
    slides.push({
      image: image
        ? {
            file: await serverFile(image),
            x: image.x,
            y: image.y,
            scale: image.scale,
            stretchX: image.stretchX,
            stretchY: image.stretchY,
            crop: image.crop,
          }
        : null,
      adjust: slide.adjust,
      text: slide.text,
    })
  }
  return { ...project, slides }
}

function readImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const element = new Image()
    element.onload = () => {
      // 다 읽은 그림은 주소를 풀어도 계속 그릴 수 있다.
      URL.revokeObjectURL(url)
      resolve(element)
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('저장된 사진을 읽지 못했습니다.'))
    }
    element.src = url
  })
}

/** 서버의 프로젝트를 받아 편집기에 불러온다. 같은 사진 파일은 한 번만 받는다. */
export async function openProject(id: number): Promise<void> {
  const { data } = await api.getProject(id)
  const images = new Map<string, Promise<{ element: HTMLImageElement; blob: Blob }>>()
  const loadFile = (file: string) => {
    let found = images.get(file)
    if (!found) {
      found = api.downloadImage(file).then(async (blob) => {
        uploaded.set(blob, file)
        return { element: await readImage(blob), blob }
      })
      images.set(file, found)
    }
    return found
  }

  const slides: SlideData[] = await Promise.all(
    data.slides.map(async (slide) => {
      if (!slide.image) return { image: null, adjust: slide.adjust, text: slide.text }
      const { element, blob } = await loadFile(slide.image.file)
      const { x, y, scale, crop, stretchX, stretchY } = slide.image
      return {
        image: {
          element,
          blob,
          crop: crop ?? null,
          x,
          y,
          scale,
          // 늘이기가 생기기 전에 저장한 프로젝트는 원래 비율(1)로 읽는다
          stretchX: stretchX ?? 1,
          stretchY: stretchY ?? 1,
        },
        adjust: slide.adjust,
        text: slide.text,
      }
    }),
  )
  replaceProject({
    ratio: data.ratio,
    gradient: data.gradient,
    title: data.title,
    footer: data.footer,
    numbering: data.numbering,
    slides,
  })
}
