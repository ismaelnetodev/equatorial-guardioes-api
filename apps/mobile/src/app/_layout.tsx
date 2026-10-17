import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { ScrollView } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { LoadFailure } from '../components/load-failure'

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#0B1240' }}><StatusBar style="light" /><ScrollView contentContainerStyle={{ flexGrow: 1 }}><LoadFailure standalone onRetry={() => { void retry() }} /></ScrollView></SafeAreaView></SafeAreaProvider>
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
