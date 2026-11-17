import { useCallback, useEffect, useRef, useState } from 'react'
import type { Phase } from '../../content/schema'
import { BG_H, BG_W, bgPath, drawBg, loadAsset, peekAsset } from '../art/bg'
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
    void loadAsset(path, alt).then((i) => {
      if (alive) setImg(i)
    })
    return () => {
      alive = false
    }
  }, [path, alt])
  return img && img.src.endsWith(path) ? img : peekAsset(path)
}

function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect
      setBox({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

/**
 * The scene picture. Uses the generated background (public/assets/bg) when it exists, else the
 * procedural scene. Always integer-scaled and pixelated.
 * - strip (phone/tablet): fills the box at ×2 (×3 from 600 px wide), cropped around the centre.
 * - fit (desktop): the whole 320×180 picture at the largest integer scale that fits, letterboxed.
 */
export function SceneArt({
  art,
  phase,
  pace,
  className,
  fit = false,
}: {
  art?: string
  phase?: Phase
  pace: number
  className?: string
  fit?: boolean
}) {
  const key = resolveArt(art, phase)
  const { path, alt } = bgPath(assetKeyFor(art, phase))
  const img = useAsset(path, alt)
  const [ref, box] = useBox<HTMLDivElement>()
  const drawImg = useCallback((f: Frame) => img && drawBg(f, img), [img])
  const label = SCENE_ALT[key]

  let canvas: React.ReactNode = null
  if (box.w > 0 && box.h > 0) {
    if (img) {
      if (fit) {
        const s = Math.max(1, Math.floor(Math.min(box.w / BG_W, box.h / BG_H)))
        canvas = <PixelCanvas draw={drawImg} w={BG_W} h={BG_H} scale={s} pace={pace} fps={6} label={label} />
      } else {
        const s = box.w >= 600 ? 3 : 2
        canvas = <PixelCanvas draw={drawImg} w={Math.ceil(box.w / s)} h={Math.ceil(box.h / s)} scale={s} pace={pace} fps={6} label={label} />
      }
    } else if (fit) {
      const s = Math.max(2, Math.min(Math.floor(box.h / 72), Math.floor(box.w / 130)))
      canvas = <PixelCanvas draw={SCENES[key]} w={Math.floor(box.w / s)} h={72} scale={s} pace={pace} seed={seedOf(key)} label={label} />
    } else {
      canvas = <PixelCanvas draw={SCENES[key]} w={Math.ceil(box.w / 3)} h={72} scale={3} pace={pace} seed={seedOf(key)} label={label} />
    }
  }
  return (
    <div
      ref={ref}
      className={'flex justify-center overflow-hidden bg-night ' + (fit || img ? 'items-center ' : 'items-end ') + (className ?? 'relative')}
    >
      {canvas}
    </div>
  )
}
