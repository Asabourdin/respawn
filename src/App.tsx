import { lazy, Suspense } from 'react'
import { Game } from './ui/Game'

const Gallery = lazy(() => import('./ui/dev/Gallery'))

/** Query/hash routing only (GitHub Pages sub-path): `?gallery` shows every screen and state. */
export default function App() {
  const isGallery = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gallery')
  if (isGallery) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    )
  }
  return <Game />
}
