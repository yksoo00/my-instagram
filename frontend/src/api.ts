import type {
  AdjustState,
  FooterState,
  GradientState,
  RatioKey,
  TemplateSettings,
  TitleState,
} from './store'

export interface Template {
  id: number
  name: string
  settings: TemplateSettings
}

/** 서버에 저장되는 프로젝트 모양. 사진은 업로드한 파일 이름으로만 가리킨다. */
export interface ProjectData {
  ratio: RatioKey
  gradient: GradientState
  title: Omit<TitleState, 'text'>
  footer: FooterState
  numbering: boolean
  slides: {
    image: {
      file: string
      x: number
      y: number
      scale: number
      /** 예전에 저장한 프로젝트에는 없다 */
      crop?: { x: number; y: number; width: number; height: number } | null
    } | null
    adjust: AdjustState
    text: string
  }[]
}

export interface ProjectSummary {
  id: number
  name: string
  updated_at: string
}

export interface CustomFont {
  id: number
  name: string
  file: string
}

export interface SavedPhrase {
  id: number
  text: string
}

const OFFLINE_MESSAGE = '서버에 연결하지 못했습니다. 백엔드를 실행했는지 확인하세요.'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      // FormData 는 브라우저가 경계 문자열을 붙여 직접 헤더를 정한다.
      headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error(OFFLINE_MESSAGE)
  }
  // 백엔드가 꺼져 있으면 Vite 프록시가 5xx 를 돌려준다.
  if (response.status >= 500) throw new Error(OFFLINE_MESSAGE)
  if (response.status === 422) throw new Error('입력 값이 올바르지 않습니다.')
  if (response.status === 409) throw new Error('이미 같은 이름이 있습니다.')
  if (response.status === 413) throw new Error('파일이 너무 큽니다. 20MB 이하만 저장할 수 있습니다.')
  if (!response.ok) throw new Error(`요청이 실패했습니다 (${response.status}).`)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const api = {
  listTemplates: () => request<Template[]>('/templates'),
  saveTemplate: (name: string, settings: TemplateSettings) =>
    request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify({ name, settings }),
    }),
  deleteTemplate: (id: number) => request<void>(`/templates/${id}`, { method: 'DELETE' }),

  uploadImage: (blob: Blob) => {
    const form = new FormData()
    form.append('file', blob)
    return request<{ file: string }>('/images', { method: 'POST', body: form })
  },
  /** 서버에 올린 사진 파일. fetch 로 받아 Blob 으로 쓴다. */
  downloadImage: async (file: string): Promise<Blob> => {
    let response: Response
    try {
      response = await fetch(`/api/images/${file}`)
    } catch {
      throw new Error(OFFLINE_MESSAGE)
    }
    if (!response.ok) throw new Error('저장된 사진을 불러오지 못했습니다.')
    return response.blob()
  },
  listProjects: () => request<ProjectSummary[]>('/projects'),
  getProject: (id: number) => request<{ id: number; name: string; data: ProjectData }>(`/projects/${id}`),
  saveProject: (name: string, data: ProjectData) =>
    request<ProjectSummary>('/projects', { method: 'POST', body: JSON.stringify({ name, data }) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  listFonts: () => request<CustomFont[]>('/fonts'),
  uploadFont: (file: File, name: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    return request<CustomFont>('/fonts', { method: 'POST', body: form })
  },
  deleteFont: (id: number) => request<void>(`/fonts/${id}`, { method: 'DELETE' }),

  listPhrases: () => request<SavedPhrase[]>('/phrases'),
  savePhrase: (text: string) =>
    request<SavedPhrase>('/phrases', { method: 'POST', body: JSON.stringify({ text }) }),
  deletePhrase: (id: number) => request<void>(`/phrases/${id}`, { method: 'DELETE' }),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 났습니다.'
}
