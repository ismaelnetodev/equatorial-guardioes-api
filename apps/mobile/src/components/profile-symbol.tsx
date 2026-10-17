import { Circle, Path, Rect, Svg } from 'react-native-svg'
import { colors } from './ui'

export type ProfileSymbolName = 'edit' | 'report' | 'gift' | 'invite' | 'book' | 'lock' | 'logout' | 'copy' | 'shield' | 'eye' | 'check'

export function ProfileSymbol({ name, size = 22, color = colors.muted }: { name: ProfileSymbolName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'edit' ? <Path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {name === 'report' ? <><Path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'gift' ? <><Path d="M3 10h18v11H3zM2 7h20v4H2zM12 7v14M12 7H8.5a2.5 2.5 0 1 1 2.4-3.2L12 7Zm0 0h3.5a2.5 2.5 0 1 0-2.4-3.2L12 7Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" /></> : null}
      {name === 'invite' ? <><Circle cx="9" cy="8" r="3" stroke={color} strokeWidth={1.8} /><Path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M17 5.5a3 3 0 0 1 0 5.8M17 14h1a3.5 3.5 0 0 1 3.5 3.5V20" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></> : null}
      {name === 'book' ? <><Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'lock' ? <><Rect x="4" y="10" width="16" height="11" rx="2" stroke={color} strokeWidth={1.8} /><Path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></> : null}
      {name === 'logout' ? <><Path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></> : null}
      {name === 'copy' ? <><Rect x="8" y="8" width="12" height="13" rx="2" stroke={color} strokeWidth={1.8} /><Path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" stroke={color} strokeWidth={1.8} /></> : null}
      {name === 'shield' ? <Path d="m12 2 8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" /> : null}
      {name === 'eye' ? <><Path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" stroke={color} strokeWidth={1.8} /><Circle cx="12" cy="12" r="2.5" stroke={color} strokeWidth={1.8} /></> : null}
      {name === 'check' ? <Path d="m5 12 4.5 4.5L19 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  )
}
