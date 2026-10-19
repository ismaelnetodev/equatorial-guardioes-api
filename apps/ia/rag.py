import os
import re
import hashlib
from pathlib import Path
from threading import Lock
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from gemini import texto_da

load_dotenv()

CHAVE = os.getenv("GEMINI_API_KEY")
MODELO = os.getenv("GEMINI_CHAT_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MODELO_EMBEDDING = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
BASE = Path(__file__).resolve().parent / "base_conhecimento"
PDF = BASE / "rag_guardioes_da_energia.pdf"
GUIA = BASE / "plataforma.md"
AJUDA_PLATAFORMA = GUIA.read_text(encoding="utf-8")

MODULOS = {
    0: "Módulo inicial da trilha",
    1: "Regra de ouro e como comunicar",
    2: "Fio, cabo ou ramal partido ou caído",
    3: "Poste avariado ou inclinado",
    4: "Cabos baixos, soltos ou desnivelados",
    5: "Objeto ou animal na rede",
    6: "Gambiarra e ligações improvisadas",
    7: "Fogo, fumaça e equipamento com falha",
}

PROMPT = ChatPromptTemplate.from_template(
    """Você é o Guardião IA, assistente do programa Guardiões da Energia.
Use APENAS as informações do contexto abaixo.
Para dúvidas sobre cadastro, navegação, pontos, perfil e relatos, priorize o Guia atual da plataforma. Ele prevalece sobre informações antigas do PDF. O módulo inicial para liberar relatos é o módulo 0; não o confunda com a numeração dos temas de segurança do PDF. Não encaminhe a pessoa para procurar no aplicativo uma instrução que já está no guia.
Se a informação não estiver no contexto, diga com clareza que não tem essa informação e sugira procurar o aplicativo ou os canais oficiais. Nunca invente pontos, prazos, telefones, datas ou regras.
Se a dúvida for sobre o conteúdo de um módulo (o que é ensinado, como reconhecer ou agir diante de um risco), diga que a pessoa encontra isso na trilha de capacitação do aplicativo e indique o número do módulo: 1 conduta geral e como fazer o relato, 2 fio ou cabo partido ou caído, 3 poste avariado ou inclinado, 4 cabos baixos, soltos ou desnivelados, 5 objeto ou animal na rede, 6 gambiarra e ligação improvisada, 7 fogo, fumaça, faíscas, transformador ou isolador.
Nunca prometa desconto ou crédito na conta de luz: benefícios na fatura não estão confirmados.
Se a pessoa descrever um perigo acontecendo agora, priorize a segurança: diga para se afastar, não tocar em fios, cabos, postes ou em quem esteja em contato com a rede, e avisar. Com vítimas, ligar para o SAMU (192) e os Bombeiros (193). Com fogo ou risco imediato, ligar para os Bombeiros (193) e avisar a Equatorial.
Responda em português do Brasil, em linguagem simples, acolhedora e em até 3 frases curtas.

Guia atual da plataforma: {platform_guide}

Contexto complementar do programa: {context}

Pergunta: {question}

Resposta:"""
)

llm = ChatGoogleGenerativeAI(model=MODELO, google_api_key=CHAVE, max_retries=1)
chain = PROMPT | llm

_banco = None
_cache = {}
_banco_lock = Lock()


def criar_banco_vetores():
    embedding = GoogleGenerativeAIEmbeddings(model=MODELO_EMBEDDING, google_api_key=CHAVE)
    # Uma nova fonte/modelo usa outra coleção; não reutiliza conteúdo desatualizado.
    versao = hashlib.sha256(PDF.read_bytes() + GUIA.read_bytes() + MODELO_EMBEDDING.encode()).hexdigest()[:16]
    banco = Chroma(collection_name=f"guardioes-{versao}", embedding_function=embedding,
                   persist_directory=os.getenv("CHROMA_DB_DIR", str(BASE.parent / "chroma_db")))
    paginas = PyPDFLoader(str(PDF)).load()
    paginas.append(Document(page_content=AJUDA_PLATAFORMA, metadata={"source": str(GUIA)}))
    separador = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    blocos = separador.split_documents(paginas)
    existentes = set(banco.get()["ids"])
    faltantes = [(str(i), bloco) for i, bloco in enumerate(blocos) if str(i) not in existentes]
    if faltantes:
        # IDs estáveis permitem retomar uma indexação interrompida sem duplicar trechos.
        banco.add_documents([bloco for _, bloco in faltantes], ids=[id for id, _ in faltantes])
    return banco


def buscador():
    global _banco
    with _banco_lock:
        if _banco is None:
            _banco = criar_banco_vetores()
    return _banco.as_retriever(search_kwargs={"k": 4})


def responder(pergunta):
    chave = pergunta.strip().lower()
    if chave in _cache:
        return _cache[chave]
    blocos = buscador().invoke(pergunta)
    contexto = "\n\n".join(bloco.page_content for bloco in blocos)
    resposta = texto_da(chain.invoke({"context": contexto, "platform_guide": AJUDA_PLATAFORMA, "question": pergunta}))
    modulo = None
    achado = re.search(r"Módulo (\d)", resposta)
    if achado and int(achado.group(1)) in MODULOS:
        numero = int(achado.group(1))
        modulo = f"Módulo {numero} · {MODULOS[numero]}"
    _cache[chave] = (resposta, modulo)
    return resposta, modulo
