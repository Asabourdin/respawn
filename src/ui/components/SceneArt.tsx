import { useCallback, useEffect, useState } from 'react'
import type { Phase } from '../../content/schema'
import { bgPath, drawBg, loadAsset, peekAsset } from '../art/bg'
import { hash, type Frame } from '../art/gfx'
import { assetKeyFor, resolveArt, SCENE_ALT, SCENES, type SceneKey } from '../art/scenes'
import { PixelCanvas } from './PixelCanvas'

const SEEDS: Partial<Record<SceneKey, number>> = {}
function seedOf(k: SceneKey) {
  return (SEEDS[k] ??= Math.floor(hash(k.length * 131 + k.charCodeAt(0) * 7) * 10000))
}

/** Loads a public asset once (cached, misses included). null while loading or missing. */
export function useAsset(path: string, alt?: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() => peekAsset(path))
  useEffect(() => {
    let alive = true
    setImg(peekAsset(path))
    void loadAsset(path, alt).then((i) => {
      if (alive) setImg(i)
    })
    return () => {
      alive = false
    }
  }, [path, alt])
  return img
}

/**
 * The scene picture. Uses the generated background for `art` when it exists (integer ×2,
 * pixelated, sky palette-swapped by the planet pace + rising water line), else the procedural
 * scene (×3). Both are 216 CSS px tall and bottom-aligned so cropping never hides the water.
 */
export function SceneArt({ art, phase, pace, className }: { art?: string; phase?: Phase; pace: number; className?: string }) {
  const key = resolveArt(art, phase)
  const asset = assetKeyFor(art, phase)
  const { path, alt } = bgPath(asset)
  const img = useAsset(path, alt)
  const drawImg = useCallback((f: Frame) => img && drawBg(f, img), [img])
  return (
    <div className={'flex items-end overflow-hidden bg-night ' + (className ?? 'relative')}>
      {img ? (
        <PixelCanvas draw={drawImg} h={108} scale={2} pace={pace} fps={6} label={SCENE_ALT[key]} className="w-full shrink-0" />
      ) : (
        <PixelCanvas draw={SCENES[key]} h={72} scale={3} pace={pace} seed={seedOf(key)} label={SCENE_ALT[key]} className="w-full shrink-0" />
      )}
    </div>
  )
}
