import { Image } from 'react-native'
import { colors } from './ui'

const icons = {
  pole: require('../../assets/trail-pole.png'), star: require('../../assets/trail-star.png'),
  lock: require('../../assets/trail-lock.png'), eye: require('../../assets/trail-eye.png'),
  route: require('../../assets/trail-route.png'), bolt: require('../../assets/trail-bolt.png'),
  trophy: require('../../assets/trail-trophy.png'), user: require('../../assets/trail-user.png'),
  shield: require('../../assets/trail-shield.png'), help: require('../../assets/trail-help.png'), check: require('../../assets/trail-check.png'),
}
export function AppIcon({ name, size = 24, color = colors.muted }: { name: keyof typeof icons; size?: number; color?: string }) {
  return <Image source={icons[name]} accessible={false} style={{ width: size, height: size, tintColor: color }} />
}
