import { useRouter } from 'expo-router';
import DuvidasChat from '../features/chatbot/screens/DuvidasChat';
import { useNomeUsuario } from '../features/chatbot/adaptador';

export default function ChatDuvidas() {
  const router = useRouter();
  const nome = useNomeUsuario();
  return <DuvidasChat nome={nome} onFechar={() => router.back()} />;
}
