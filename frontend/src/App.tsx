import { useEffect } from 'react'
import { Canvas } from './Canvas'
import { Panel } from './Panel'
import { loadImageFile, useEditor } from './store'

function App() {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0]
      if (file) loadImageFile(file)
    }
    const handleDragOver = (event: DragEvent) => event.preventDefault()
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer?.files[0]
      if (file) loadImageFile(file)
    }
    // 입력칸 안에서도 편집기 되돌리기로 통일한다. 브라우저 기본 되돌리기는 상태와 어긋난다.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      const { undo, redo } = useEditor.getState()
      if (key === 'y' || event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <main className="app">
      <Canvas />
      <Panel />
    </main>
  )
}

export default App
