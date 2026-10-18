import { useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../components/ui'

// Mapa de blocos do OpenStreetMap, desenhado sem biblioteca externa.
// Projeção Web Mercator: converte latitude e longitude em coordenadas de bloco.
const TILE = 256
const MIN_ZOOM = 10
const MAX_ZOOM = 18

export type MapPin = { id: string; title: string; latitude: number; longitude: number; color: string }

function project(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom
  const radians = (latitude * Math.PI) / 180
  const x = ((longitude + 180) / 360) * scale
  const y = ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale
  return { x, y }
}

function fit(pins: MapPin[], width: number, height: number) {
  const first = pins[0]
  if (!first) return null
  const latitudes = pins.map(pin => pin.latitude)
  const longitudes = pins.map(pin => pin.longitude)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  let zoom = MAX_ZOOM
  while (zoom > MIN_ZOOM) {
    const a = project(north, west, zoom)
    const b = project(south, east, zoom)
    if ((b.x - a.x) * TILE <= width - 80 && (b.y - a.y) * TILE <= height - 80) break
    zoom -= 1
  }
  return { zoom, centerLatitude: (south + north) / 2, centerLongitude: (west + east) / 2 }
}

export function ReportMap({ pins, selectedId, onSelect, height = 420, light = false }: { pins: MapPin[]; selectedId?: string | null; onSelect?: (id: string) => void; height?: number; light?: boolean }) {
  // A largura real é medida no layout: fixá-la faria os pinos caírem fora em colunas estreitas.
  const [width, setWidth] = useState(0)
  const measure = (value: number) => setWidth(current => Math.abs(current - value) < 1 ? current : value)
  // Largura provisória até o onLayout medir: garante que o mapa já apareça na primeira pintura.
  const box = width || 600
  const base = useMemo(() => fit(pins, box, height), [pins, box, height])
  const [zoomOffset, setZoomOffset] = useState(0)
  if (!base) {
    return <View accessibilityRole="image" accessibilityLabel="Mapa sem relatos localizados" style={[styles.frame, light && styles.frameLight, { height }, styles.empty]}>
      <Text style={styles.emptyTitle}>Nenhum relato com localização</Text>
      <Text style={styles.emptyHint}>Os pinos aparecem quando os relatos enviados pelo aplicativo trouxerem latitude e longitude.</Text>
    </View>
  }
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.zoom + zoomOffset))
  const center = project(base.centerLatitude, base.centerLongitude, zoom)
  const originX = center.x * TILE - box / 2
  const originY = center.y * TILE - height / 2
  const firstColumn = Math.floor(originX / TILE)
  const firstRow = Math.floor(originY / TILE)
  const columns = Math.ceil(box / TILE) + 1
  const rows = Math.ceil(height / TILE) + 1
  const limit = 2 ** zoom
  const tiles: { key: string; uri: string; left: number; top: number }[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tileX = firstColumn + column
      const tileY = firstRow + row
      if (tileX < 0 || tileY < 0 || tileX >= limit || tileY >= limit) continue
      tiles.push({ key: zoom + '/' + tileX + '/' + tileY, uri: 'https://tile.openstreetmap.org/' + zoom + '/' + tileX + '/' + tileY + '.png', left: tileX * TILE - originX, top: tileY * TILE - originY })
    }
  }
  return <View onLayout={event => measure(event.nativeEvent.layout.width)} style={[styles.frame, light && styles.frameLight, { height }]}>
    <View accessibilityRole="image" accessibilityLabel={'Mapa com ' + pins.length + ' relatos localizados'} style={StyleSheet.absoluteFill}>
      {tiles.map(tile => <Image key={tile.key} source={{ uri: tile.uri }} style={[styles.tile, { left: tile.left, top: tile.top }]} />)}
      {light ? null : <View style={styles.tint} pointerEvents="none" />}
    </View>
    {pins.map(pin => {
      const point = project(pin.latitude, pin.longitude, zoom)
      const left = point.x * TILE - originX
      const top = point.y * TILE - originY
      if (left < -20 || top < -30 || left > box + 20 || top > height + 20) return null
      const active = pin.id === selectedId
      return <Pressable key={pin.id} accessibilityRole="button" accessibilityLabel={'Abrir relato ' + pin.title} accessibilityState={{ selected: active }} onPress={() => onSelect?.(pin.id)} style={[styles.pin, { left: left - 13, top: top - 30 }, active && styles.pinActive]}>
        <View style={[styles.pinHead, { backgroundColor: pin.color }, active && styles.pinHeadActive]} />
        <View style={[styles.pinTail, { borderTopColor: pin.color }]} />
      </Pressable>
    })}
    <View style={styles.zoom}>
      <Pressable accessibilityRole="button" accessibilityLabel="Aproximar o mapa" disabled={zoom >= MAX_ZOOM} onPress={() => setZoomOffset(value => value + 1)} style={styles.zoomButton}><Text style={styles.zoomText}>+</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Afastar o mapa" disabled={zoom <= MIN_ZOOM} onPress={() => setZoomOffset(value => value - 1)} style={styles.zoomButton}><Text style={styles.zoomText}>−</Text></Pressable>
    </View>
    <Text style={styles.credit}>© OpenStreetMap</Text>
  </View>
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, borderWidth: 1, borderColor: '#303968', overflow: 'hidden', backgroundColor: '#0e143d', alignSelf: 'stretch', flexGrow: 1 },
  frameLight: { borderColor: '#E0D6BD', backgroundColor: '#EDE9F6' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  tint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.background, opacity: 0.18 },
  pin: { position: 'absolute', alignItems: 'center', width: 26, height: 32 },
  pinActive: { transform: [{ scale: 1.25 }] },
  pinHead: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF' },
  pinHeadActive: { borderColor: colors.primary },
  pinTail: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  zoom: { position: 'absolute', right: 12, top: 12, gap: 6 },
  zoomButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151c4bEE', borderWidth: 1, borderColor: '#465184' },
  zoomText: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  credit: { position: 'absolute', right: 8, bottom: 6, color: colors.text, fontSize: 10, opacity: 0.75 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  emptyTitle: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: colors.mutedSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
})
