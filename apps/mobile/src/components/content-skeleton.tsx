import { StyleSheet, View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

type Variant = 'reports' | 'detail' | 'profile' | 'ranking' | 'points' | 'module' | 'quiz' | 'training' | 'result' | 'list'
type Block = readonly [number, number, number, number, number]
const line = (y: number, width = 280): Block => [0, y, width, 14, 7]
const rows = (count: number, start: number, height: number, gap: number): Block[] => Array.from({ length: count }, (_, index) => [0, start + index * (height + gap), 320, height, 16])
const layouts: Record<Variant, { height: number; blocks: readonly Block[] }> = {
  reports: { height: 466, blocks: [[0, 0, 320, 72, 18], line(96, 90), ...rows(3, 130, 104, 12)] },
  detail: { height: 430, blocks: [[0, 0, 110, 25, 12], [122, 0, 90, 25, 12], [0, 43, 320, 130, 18], line(197, 120), ...rows(3, 229, 32, 12), [0, 373, 320, 52, 16]] },
  profile: { height: 465, blocks: [[122, 0, 76, 76, 38], [60, 96, 200, 22, 11], [100, 130, 120, 14, 7], [110, 160, 100, 26, 13], [40, 212, 240, 22, 11], [60, 250, 200, 18, 9], [0, 306, 320, 150, 18]] },
  ranking: { height: 462, blocks: [[0, 0, 320, 96, 16], ...rows(4, 120, 68, 12)] },
  points: { height: 460, blocks: [[0, 0, 320, 180, 18], line(206, 80), ...rows(2, 244, 96, 12)] },
  module: { height: 550, blocks: [[0, 0, 320, 190, 18], line(214, 260), line(242, 190), [0, 282, 320, 92, 18], ...rows(2, 394, 62, 14)] },
  quiz: { height: 490, blocks: [line(0, 100), [0, 34, 300, 24, 12], [0, 70, 240, 24, 12], ...rows(4, 124, 58, 12), [0, 428, 320, 52, 16]] },
  training: { height: 500, blocks: [[0, 0, 250, 24, 12], [0, 50, 320, 200, 18], line(278), line(306), line(334, 240), [0, 398, 320, 52, 16]] },
  result: { height: 490, blocks: [[90, 0, 140, 140, 28], [30, 172, 260, 26, 13], [10, 224, 300, 14, 7], [40, 250, 240, 14, 7], [80, 294, 160, 28, 14], ...rows(2, 354, 52, 12)] },
  list: { height: 310, blocks: rows(5, 0, 50, 12) },
}

export function ContentSkeleton({ variant, label = 'Carregando conteúdo', surface = 'screen' }: { variant: Variant; label?: string; surface?: 'screen' | 'sheet' }) {
  const layout = layouts[variant]
  return <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.container}>
    <View style={{ width: '100%', aspectRatio: 320 / layout.height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 320 ${layout.height}`}>
        {layout.blocks.map(([x, y, width, height, radius], index) => <Rect key={index} x={x} y={y} width={width} height={height} rx={radius} fill={surface === 'sheet' ? '#222C70' : '#141C55'} />)}
      </Svg>
    </View>
  </View>
}

const styles = StyleSheet.create({ container: { width: '100%', maxWidth: 360, alignSelf: 'center', paddingVertical: 20 } })
