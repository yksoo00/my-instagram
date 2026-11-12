import { useState } from 'react'
import { Section } from './Section'

const OFFLINE = '서버에 연결하지 못했습니다. 백엔드를 실행했는지 확인하세요.'

async function failure(response: Response, fallback: string): Promise<Error> {
  // 서버가 한국어 사유를 detail 로 준다
  const detail = await response
    .json()
    .then((body: { detail?: unknown }) => (typeof body.detail === 'string' ? body.detail : null))
    .catch(() => null)
  return new Error(response.status >= 500 ? OFFLINE : (detail ?? fallback))
}

/** 템플릿·프로젝트·사진·글꼴 전체(data 폴더)를 zip 하나로 받고, 그 zip 으로 되돌린다. */
export function Backup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 났습니다.')
    } finally {
      setBusy(false)
    }
  }

  const download = () =>
    run(async () => {
      let response: Response
      try {
        response = await fetch('/api/backup')
      } catch {
        throw new Error(OFFLINE)
      }
      if (!response.ok) throw await failure(response, '백업을 만들지 못했습니다.')
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'insta-studio-backup.zip'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = name
      link.click()
      URL.revokeObjectURL(link.href)
      setMessage(`${name} 을(를) 받았습니다. 안전한 곳에 보관하세요.`)
    })

  const restore = (file: File) => {
    const ok = window.confirm(
      `"${file.name}" 으로 복원할까요?\n\n지금 저장된 템플릿·프로젝트·사진·글꼴이 모두 이 백업 내용으로 바뀝니다.\n(바꾸기 전 데이터는 data/backups 폴더에 자동으로 남습니다.)`,
    )
    if (!ok) return
    void run(async () => {
      const form = new FormData()
      form.append('file', file)
      let response: Response
      try {
        response = await fetch('/api/backup/restore', { method: 'POST', body: form })
      } catch {
        throw new Error(OFFLINE)
      }
      if (!response.ok) throw await failure(response, '복원하지 못했습니다.')
      // 화면에 떠 있는 작업·글꼴 목록이 옛 데이터라서 새로 읽는다.
      window.alert('복원했습니다. 화면을 새로 고칩니다.')
      window.location.reload()
    })
  }

  return (
    <Section title="백업·복원">
      <p className="hint">
        템플릿, 프로젝트, 올린 사진, 내 글꼴이 이 컴퓨터의 data 폴더에 저장됩니다. 컴퓨터를
        바꾸거나 폴더가 지워지면 사라지므로 가끔 백업 파일을 받아 두세요.
      </p>
      <button type="button" disabled={busy} onClick={() => void download()}>
        {busy ? '처리 중...' : '백업 파일 받기'}
      </button>
      <label>
        백업에서 복원 (.zip)
        <input
          type="file"
          accept=".zip"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) restore(file)
          }}
        />
      </label>
      {message && <p className="hint">{message}</p>}
      {error && <p className="error">{error}</p>}
    </Section>
  )
}
