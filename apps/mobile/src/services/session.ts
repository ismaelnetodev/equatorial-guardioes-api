import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const tokenKey = 'guardioes.accessToken'
let webToken: string | null = null

export async function getAccessToken(): Promise<string | null> {
  return Platform.OS === 'web' ? webToken : SecureStore.getItemAsync(tokenKey)
}

export async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') { webToken = token; return }
  await SecureStore.setItemAsync(tokenKey, token)
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === 'web') { webToken = null; return }
  await SecureStore.deleteItemAsync(tokenKey)
}
