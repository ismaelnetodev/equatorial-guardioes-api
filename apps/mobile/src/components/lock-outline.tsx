import { Path, Svg } from 'react-native-svg'
import { colors } from './ui'

export function LockOutline({ color = colors.mutedSecondary, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 10h14v11H5z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  )
}
