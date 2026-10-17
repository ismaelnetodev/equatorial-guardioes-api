import { ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

// Coordinates follow the 360 px reference, below the system status bar.
const blocks = [
  [20, 28, 52, 52, 26],
  [84, 32, 140, 20, 10],
  [84, 60, 80, 16, 8],
  [20, 94, 320, 66, 16],
  [20, 174, 320, 92, 18],
  [56, 272, 68, 68, 18],
  [140, 294, 120, 14, 7],
  [140, 314, 90, 12, 6],
  [146, 384, 68, 68, 18],
  [230, 406, 120, 14, 7],
  [230, 426, 90, 12, 6],
  [236, 496, 68, 68, 18],
  [100, 518, 120, 14, 7],
  [120, 538, 90, 12, 6],
  [146, 608, 68, 68, 18],
  [230, 630, 120, 14, 7],
  [230, 650, 90, 12, 6],
] as const

export function TrailSkeleton() {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View accessible accessibilityLabel="Carregando trilha" accessibilityState={{ busy: true }} style={styles.canvas}>
      <Svg width="100%" height="100%" viewBox="0 0 360 688" accessible={false}>
        {blocks.map(([x, y, width, height, radius], index) => <Rect key={index} x={x} y={y} width={width} height={height} rx={radius} fill="#141C55" />)}
      </Svg>
    </View>
  </ScrollView>
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: '#0B1240', alignItems: 'center' },
  canvas: { width: '100%', maxWidth: 360, aspectRatio: 360 / 688 },
})
