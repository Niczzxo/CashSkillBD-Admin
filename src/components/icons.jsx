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
export const IOrders = (p) => <Svg size={p.size || 22} d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z M9 7h6 M9 11h6" />
export const ILessons = (p) => <Svg size={p.size || 22} d="M22 10L12 5 2 10l10 5 10-5z M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
export const IMembers = (p) => <Svg size={p.size || 22} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
export const ITeam = (p) => <Svg size={p.size || 22} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 11a4 4 0 1 0-8 0 M16 3a4 4 0 0 1 0 8" />
export const IReviews = (p) => <Svg size={p.size || 22} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
export const ITickets = (p) => <Svg size={p.size || 22} d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z M13 5v2 M13 17v2 M13 11v2" />
export const IInquiries = (p) => <Svg size={p.size || 22} d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6" />
export const ISeminar = (p) => <Svg size={p.size || 22} d="M8 2v4 M16 2v4 M3 8h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
export const IProducts = (p) => <Svg size={p.size || 22} d="M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8" />
export const IVps = (p) => <Svg size={p.size || 22} d="M4 6h16 M4 12h16 M4 18h16 M8 6v12 M16 6v12" />
export const IPayments = (p) => <Svg size={p.size || 22} d="M2 5h20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M2 10h20" />
export const ISupport = (p) => <Svg size={p.size || 22} d="M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
export const IUsers = (p) => <Svg size={p.size || 22} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
export const IChart = (p) => <Svg size={p.size || 22} d="M3 3v18h18 M8 17v-6 M13 17V7 M18 17v-3" />
export const IArrowR = (p) => <Svg size={p.size || 18} d="M5 12h14 M12 5l7 7-7 7" />
