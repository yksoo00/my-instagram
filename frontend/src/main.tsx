import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'

// 개발 서버에서는 등록하지 않는다. 설치용 앱은 빌드한 화면(운영)에서만 쓴다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
