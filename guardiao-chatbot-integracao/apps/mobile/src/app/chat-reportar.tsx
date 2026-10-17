import { useRouter } from 'expo-router';
import RelatoChat from '../features/chatbot/screens/RelatoChat';
import { useNomeUsuario } from '../features/chatbot/adaptador';

export default function ChatReportar() {
  const router = useRouter();
  const nome = useNomeUsuario();
  return <RelatoChat nome={nome} onFechar={() => router.back()} />;
}
