import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { TrailModule } from '../features/trails/trails.api'
import { colors } from './ui'
import { AppIcon } from './app-icon'

export function TrailPath({ modules, onSelect }: { modules: TrailModule[]; onSelect: (module: TrailModule) => void }) {
  const pathWidth = Math.min(useWindowDimensions().width, 430) - 40
  return <View style={styles.path}>
    {modules.map((module, index) => {
      const locked = module.status === 'blocked'
      const completed = module.status === 'completed'
      const first = index === 0
      const inProgress = module.status === 'in_progress'
      const leftLabel = index % 2 === 0 && !first
      const middle = pathWidth * 0.39 + 34
      const right = pathWidth - 70
      const start = index === 1 ? 71 : leftLabel ? middle : right
      const end = leftLabel ? right : middle
      return <View key={module.id}>
        {index > 0 ? <View accessible={false} style={styles.connector}>{Array.from({ length: 17 }, (_, dot) => {
          const t = dot / 16
          const curve = 3 * (1 - t) * t * t + t * t * t
          const y = 3 * (1 - t) * (1 - t) * t * 38 + t * t * t * 38
          return <View key={dot} style={[styles.connectorDot, modules[index - 1]?.status === 'completed' && styles.finishedConnector, { left: start + (end - start) * curve - 2, top: y - 2 }]} />
        })}</View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Módulo ${index}: ${module.title}. ${locked ? 'Bloqueado' : completed ? 'Concluído' : module.status === 'in_progress' ? 'Continuar' : 'Comece por aqui'}`} onPress={() => onSelect(module)} style={[styles.row, { paddingLeft: pathWidth * 0.39 }, first && styles.firstRow, leftLabel && styles.reverse]}>
          <View style={[styles.nodeSlot, first && styles.firstSlot]}>
            {completed && index < 2 ? <Image source={index === 0 ? require('../../assets/trail-node-completed.png') : require('../../assets/trail-node-cable-completed.png')} accessible={false} style={styles.completedArt} /> : first && !locked && !completed ? <Image source={require('../../assets/trail-node.png')} accessible={false} style={styles.firstNode} /> : inProgress && index === 2 ? <Image source={require('../../assets/trail-node-pole.png')} accessible={false} style={styles.currentArt} /> : <View style={[styles.node, completed && styles.completed, !locked && !completed && styles.available]}><AppIcon name={locked ? 'lock' : index === 0 ? 'eye' : index === 2 ? 'pole' : 'bolt'} size={30} color={locked ? '#858bad' : colors.background} />{completed ? <View style={styles.checkBadge}><AppIcon name="check" size={14} color={colors.text} /></View> : null}</View>}
          </View>
          <View style={[styles.label, leftLabel && styles.alignRight]}>
            <Text style={[styles.moduleNumber, !locked && styles.yellow]}>MÓDULO {index}</Text>
            <Text style={[styles.title, locked && styles.dim]}>{module.title}</Text>
            <Text style={[styles.status, !locked && !completed && styles.yellow]}>{locked ? 'Bloqueado' : completed ? 'Concluído' : inProgress ? 'Em andamento' : first ? 'Comece por aqui' : 'Disponível'}</Text>
          </View>
        </Pressable>
      </View>
    })}
  </View>
}

const styles = StyleSheet.create({
  path: { paddingTop: 28, paddingBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 96, minHeight: 72 }, firstRow: { paddingLeft: 28 }, reverse: { flexDirection: 'row-reverse', paddingLeft: 0, paddingRight: 36 },
  node: { width: 68, height: 68, backgroundColor: '#222c70', borderRadius: 19, justifyContent: 'center', alignItems: 'center' }, available: { backgroundColor: colors.primary, borderRadius: 34, borderWidth: 3, borderColor: '#ffe19b' }, completed: { backgroundColor: '#16bdb6' }, firstNode: { width: 86, height: 87 },
  nodeSlot: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center' }, firstSlot: { width: 86, height: 87 }, completedArt: { width: 74, height: 74 }, currentArt: { width: 86, height: 88 }, checkBadge: { position: 'absolute', right: -3, top: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.background, backgroundColor: '#10b978', alignItems: 'center', justifyContent: 'center' }, finishedConnector: { backgroundColor: '#16bdb6' },
  label: { flex: 1, gap: 4 }, alignRight: { alignItems: 'flex-end' }, moduleNumber: { color: '#858bad', fontSize: 10, letterSpacing: 0.7 }, title: { color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '700' }, status: { color: colors.muted, fontSize: 12 }, dim: { color: '#858bad' }, yellow: { color: colors.primary },
  connector: { height: 38 }, connectorDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border },
})
