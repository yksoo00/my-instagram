import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 프론트는 항상 /api 로만 부른다. 개발 중에는 FastAPI(8000)로 넘긴다.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
