import { useState } from 'react'
import { assetUrl } from '../assets'

/** A generated pixel sprite at an integer scale (hidden if the file is missing). */
export function PixelImg({
  path,
  size,
  scale = 1,
  alt = '',
  className,
}: {
  path: string
  /** Native size in px (square sprites). */
  size: number
  scale?: number
  alt?: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  return (
    <img
      src={assetUrl(path)}
      width={size * scale}
      height={size * scale}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      onError={() => setBroken(true)}
      className={'pixel inline-block shrink-0 select-none ' + (className ?? '')}
      style={{ imageRendering: 'pixelated', width: size * scale, height: size * scale }}
    />
  )
}

/** 48 px character bust in a small pixel frame. */
export function Bust({ path, name, scale = 1 }: { path: string; name: string; scale?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center bg-pine p-[3px] shadow-[0_0_0_3px_var(--color-night)]">
      <PixelImg path={path} size={48} scale={scale} alt={`Portrait of ${name}`} />
    </span>
  )
}
