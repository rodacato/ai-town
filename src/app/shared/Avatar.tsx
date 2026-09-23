import type { Look } from '../../core/world/content'

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

export function Avatar({ look, size = 44 }: { look: Look; size?: number }) {
  const hair = hex(look.hair)
  const skin = hex(look.skin)
  const a = look.ancestry
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="avatar" aria-hidden>
      <circle cx="24" cy="24" r="24" fill={hex(look.shirt)} opacity="0.22" />
      {look.hairStyle === 'long' && <rect x="12" y="16" width="24" height="24" rx="9" fill={hair} />}
      <path d="M10 48c1-9 7-13 14-13s13 4 14 13z" fill={hex(look.shirt)} />
      {look.accessory === 'holy-symbol' && <circle cx="24" cy="41" r="2.6" fill="#E3B94F" />}
      {a === 'elf' && (
        <>
          <path d="M14.5 21 7 12.5 16 18z" fill={skin} />
          <path d="M33.5 21 41 12.5 32 18z" fill={skin} />
        </>
      )}
      <circle cx="24" cy="22" r="10" fill={skin} />
      {look.hairStyle === 'bun' && <circle cx="24" cy="9.5" r="4.5" fill={hair} />}
      {look.hairStyle === 'curly' ? (
        [15, 20, 26, 32].map((x, i) => <circle key={x} cx={x + 0.5} cy={i % 2 ? 12.5 : 14} r="4.4" fill={hair} />)
      ) : look.hairStyle === 'bald' ? (
        <path d="M14.5 21a9.5 9.5 0 0 1 2-5M33.5 21a9.5 9.5 0 0 0-2-5" stroke={hair} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M13.6 21.5a10.4 10.4 0 0 1 20.8 0c-3-3.5-8-5-13-3.8-3 .8-5.6 2-7.8 3.8z" fill={hair} />
      )}
      {a === 'tiefling' && (
        <g fill="none" stroke="#3A2A3A" strokeWidth="2.6" strokeLinecap="round">
          <path d="M18 13.5c-2-3-5-4-7-3" />
          <path d="M30 13.5c2-3 5-4 7-3" />
        </g>
      )}
      <circle cx="20.5" cy="23" r="1.1" fill="#2E2A26" />
      <circle cx="27.5" cy="23" r="1.1" fill="#2E2A26" />
      {a === 'gnome' && <circle cx="24" cy="26" r="2.4" fill={skin} stroke="#2E2A26" strokeOpacity="0.15" />}
      {look.beard ? (
        <path d="M15 24c0 8 4 12 9 12s9-4 9-12c-2 3-5 4-9 4s-7-1-9-4z" fill={hex(look.beard)} />
      ) : (
        <path d="M21.5 27.2c1.5 1.1 3.5 1.1 5 0" stroke="#2E2A26" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      )}
      {a === 'halforc' && (
        <>
          <path d="M20.6 29.5 21.4 26.3 22.4 29.5z" fill="#FBF6EE" />
          <path d="M25.6 29.5 26.6 26.3 27.4 29.5z" fill="#FBF6EE" />
        </>
      )}
      <Accessory look={look} />
    </svg>
  )
}

function Accessory({ look }: { look: Look }) {
  switch (look.accessory) {
    case 'glasses':
      return (
        <g stroke="#2E2A26" strokeWidth="1" fill="none">
          <circle cx="20.5" cy="23" r="2.8" />
          <circle cx="27.5" cy="23" r="2.8" />
          <path d="M23.3 23h1.4" />
        </g>
      )
    case 'monocle':
      return (
        <g stroke="#E3B94F" strokeWidth="1" fill="none">
          <circle cx="27.5" cy="23" r="3" />
          <path d="M30.3 24.5c1.5 3 .5 6-2 8" />
        </g>
      )
    case 'hat':
    case 'straw-hat':
      return (
        <g>
          <ellipse cx="24" cy="15" rx="15" ry="3.2" fill="#D9B36C" />
          <rect x="16" y="6.5" width="16" height="9" rx="4" fill="#E3C07E" />
          <rect x="16" y="12" width="16" height="2" fill={look.accessory === 'hat' ? '#8A5F40' : '#B23A48'} />
        </g>
      )
    case 'helmet':
      return (
        <g>
          <path d="M13 19a11 11 0 0 1 22 0z" fill="#9AA3AD" />
          <rect x="13" y="18" width="22" height="2.4" fill="#7D8690" />
          <rect x="23" y="18" width="2" height="8" fill="#7D8690" />
          <circle cx="24" cy="8.5" r="1.8" fill="#B23A48" />
        </g>
      )
    case 'wizard-hat':
      return (
        <g>
          <ellipse cx="24" cy="14.5" rx="16" ry="3.5" fill="#34467F" />
          <path d="M15 14 33 14 27 5 20 -2z" fill="#3F5395" />
          <circle cx="25" cy="9" r="1.4" fill="#E3B94F" />
        </g>
      )
    case 'leaf-crown':
      return (
        <g>
          {[14, 18, 22, 26, 30, 34].map((x, i) => (
            <ellipse key={x} cx={x} cy={i === 0 || i === 5 ? 15 : 12.5} rx="2.6" ry="1.6" fill={i % 2 ? '#7FA876' : '#9CC184'} />
          ))}
          <circle cx="24" cy="11" r="1.4" fill="#F2A7A0" />
        </g>
      )
    case 'tiara':
      return <path d="M18 13 19.5 8.5 22 12 24 7 26 12 28.5 8.5 30 13z" fill="#E3B94F" />
    case 'cap':
      return <path d="M13.5 17a10.5 10.5 0 0 1 21 0v1h-21zM31 16.5h7a1.5 1.5 0 0 1 0 3h-7z" fill="#D98B6A" />
    case 'bow':
      return <path d="M12 12l5 3-5 3zM22 12l-5 3 5 3z" fill="#E07A8F" />
    default:
      return null
  }
}
