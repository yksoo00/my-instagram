import type { TemplateSettings } from './store'

export interface Template {
  id: number
  name: string
  settings: TemplateSettings
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
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error(OFFLINE_MESSAGE)
  }
  // 백엔드가 꺼져 있으면 Vite 프록시가 5xx 를 돌려준다.
  if (response.status >= 500) throw new Error(OFFLINE_MESSAGE)
  if (response.status === 422) throw new Error('입력 값이 올바르지 않습니다.')
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

  listPhrases: () => request<SavedPhrase[]>('/phrases'),
  savePhrase: (text: string) =>
    request<SavedPhrase>('/phrases', { method: 'POST', body: JSON.stringify({ text }) }),
  deletePhrase: (id: number) => request<void>(`/phrases/${id}`, { method: 'DELETE' }),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 났습니다.'
}
