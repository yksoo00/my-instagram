import { useEffect } from 'react'
import { Canvas } from './Canvas'
import { Panel } from './Panel'
import { loadImageFile } from './store'

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
    window.addEventListener('paste', handlePaste)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
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
