import type { Look } from '../../worlds/serena/residents'

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

export function Avatar({ look, size = 44 }: { look: Look; size?: number }) {
  const hair = hex(look.hair)
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="avatar" aria-hidden>
      <circle cx="24" cy="24" r="24" fill={hex(look.shirt)} opacity="0.22" />
      {look.hairStyle === 'long' && <rect x="12" y="16" width="24" height="24" rx="9" fill={hair} />}
      <path d="M10 48c1-9 7-13 14-13s13 4 14 13z" fill={hex(look.shirt)} />
      <circle cx="24" cy="22" r="10" fill={hex(look.skin)} />
      {look.hairStyle === 'bun' && <circle cx="24" cy="9.5" r="4.5" fill={hair} />}
      {look.hairStyle === 'curly' ? (
        [15, 20, 26, 32].map((x, i) => <circle key={x} cx={x + 0.5} cy={i % 2 ? 12.5 : 14} r="4.4" fill={hair} />)
      ) : look.hairStyle === 'bald' ? (
        <path d="M14.5 21a9.5 9.5 0 0 1 2-5M33.5 21a9.5 9.5 0 0 0-2-5" stroke={hair} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M13.6 21.5a10.4 10.4 0 0 1 20.8 0c-3-3.5-8-5-13-3.8-3 .8-5.6 2-7.8 3.8z" fill={hair} />
      )}
      <circle cx="20.5" cy="23" r="1.1" fill="#2E2A26" />
      <circle cx="27.5" cy="23" r="1.1" fill="#2E2A26" />
      <path d="M21.5 27.2c1.5 1.1 3.5 1.1 5 0" stroke="#2E2A26" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      {look.accessory === 'glasses' && (
        <g stroke="#2E2A26" strokeWidth="1" fill="none">
          <circle cx="20.5" cy="23" r="2.8" />
          <circle cx="27.5" cy="23" r="2.8" />
          <path d="M23.3 23h1.4" />
        </g>
      )}
      {look.accessory === 'hat' && (
        <g>
          <ellipse cx="24" cy="15" rx="15" ry="3.2" fill="#D9B36C" />
          <rect x="16" y="6.5" width="16" height="9" rx="4" fill="#E3C07E" />
          <rect x="16" y="12" width="16" height="2" fill="#8A5F40" />
        </g>
      )}
      {look.accessory === 'cap' && <path d="M13.5 17a10.5 10.5 0 0 1 21 0v1h-21zM31 16.5h7a1.5 1.5 0 0 1 0 3h-7z" fill={look.shirt === 0x4f6a8a ? '#2E3A4A' : '#D98B6A'} />}
      {look.accessory === 'bow' && <path d="M12 12l5 3-5 3zM22 12l-5 3 5 3z" fill="#E07A8F" />}
    </svg>
  )
}
