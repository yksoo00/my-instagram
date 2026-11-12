import { useState } from 'react'
import { importImageFromUrl, looksLikeUrl } from './imageUrl'

/** 이미지 주소(또는 유튜브 영상 주소)를 붙여넣어 사진으로 가져온다. */
export function UrlImport() {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = looksLikeUrl(address)

  const submit = async () => {
    setBusy(true)
    const ok = await importImageFromUrl(address)
    setBusy(false)
    if (ok) setAddress('')
  }

  return (
    <div className="url-import">
      <label>
        이미지 주소로 가져오기
        <input
          type="text"
          value={address}
          placeholder="https://… 이미지 주소 / 유튜브 영상 주소"
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && valid && !busy) void submit()
          }}
        />
      </label>
      <button type="button" disabled={!valid || busy} onClick={() => void submit()}>
        {busy ? '가져오는 중...' : '주소에서 가져오기'}
      </button>
      <p className="hint">
        웹 이미지는 오른쪽 클릭 → "이미지 주소 복사". 유튜브는 영상 주소를 넣으면 대표 이미지를
        가져옵니다. 인스타·페이스북 게시물 주소는 이미지 주소가 아니라서 안 됩니다. 이 경우
        캡처해서 Ctrl+V 하세요. 저작권은 직접 확인하세요.
      </p>
    </div>
  )
}
