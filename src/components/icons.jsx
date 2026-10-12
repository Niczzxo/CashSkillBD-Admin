// Premium SVG icons for admin panel
function Svg({ d, size = 30 }) {
  const id = 'g' + d.length + size
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff8a8a" />
          <stop offset="100%" stopColor="#e8232a" />
        </linearGradient>
      </defs>
      <path d={d} stroke={`url(#${id})`} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const IBox = (p) => <Svg size={p.size || 30} d="M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8" />
export const IClock = (p) => <Svg size={p.size || 30} d="M12 7v5l3 3 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
export const IMoney = (p) => <Svg size={p.size || 30} d="M12 2v20 M17 6.5c0-2-2.2-3-5-3s-5 1-5 3 2 2.5 5 3 5 1 5 3-2.2 3-5 3-2.8 0-5-1" />
export const IWarn = (p) => <Svg size={p.size || 30} d="M12 3l10 17H2L12 3z M12 10v4 M12 17.5v.5" />
export const IDash = (p) => <Svg size={p.size || 30} d="M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z" />
export const IGear = (p) => <Svg size={p.size || 30} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
