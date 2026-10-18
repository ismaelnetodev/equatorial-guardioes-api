import os
import re
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from gemini import texto_da

load_dotenv()

CHAVE = os.getenv("GEMINI_API_KEY")
MODELO = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MODELO_EMBEDDING = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
PDF = "base_conhecimento/rag_guardioes_da_energia.pdf"

MODULOS = {
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
Se a informação não estiver no contexto, diga com clareza que não tem essa informação e sugira procurar o aplicativo ou os canais oficiais. Nunca invente pontos, prazos, telefones, datas ou regras.
Se a dúvida for sobre o conteúdo de um módulo (o que é ensinado, como reconhecer ou agir diante de um risco), diga que a pessoa encontra isso na trilha de capacitação do aplicativo e indique o número do módulo: 1 conduta geral e como fazer o relato, 2 fio ou cabo partido ou caído, 3 poste avariado ou inclinado, 4 cabos baixos, soltos ou desnivelados, 5 objeto ou animal na rede, 6 gambiarra e ligação improvisada, 7 fogo, fumaça, faíscas, transformador ou isolador.
Nunca prometa desconto ou crédito na conta de luz: benefícios na fatura não estão confirmados.
Se a pessoa descrever um perigo acontecendo agora, priorize a segurança: diga para se afastar, não tocar em fios, cabos, postes ou em quem esteja em contato com a rede, e avisar. Com vítimas, ligar para o SAMU (192) e os Bombeiros (193). Com fogo ou risco imediato, ligar para os Bombeiros (193) e avisar a Equatorial.
Responda em português do Brasil, em linguagem simples, acolhedora e em até 3 frases curtas.

Contexto: {context}

Pergunta: {question}

Resposta:"""
)

llm = ChatGoogleGenerativeAI(model=MODELO, google_api_key=CHAVE, max_retries=1)
chain = PROMPT | llm

_banco = None
_cache = {}


def criar_banco_vetores():
    embedding = GoogleGenerativeAIEmbeddings(model=MODELO_EMBEDDING, google_api_key=CHAVE)
    banco = Chroma(collection_name="guardioes", embedding_function=embedding, persist_directory="chroma_db")
    if not banco.get()["ids"]:
        paginas = PyPDFLoader(PDF).load()
        separador = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        banco.add_documents(separador.split_documents(paginas))
    return banco


def buscador():
    global _banco
    if _banco is None:
        _banco = criar_banco_vetores()
    return _banco.as_retriever(search_kwargs={"k": 4})


def responder(pergunta):
    chave = pergunta.strip().lower()
    if chave in _cache:
        return _cache[chave]
    blocos = buscador().invoke(pergunta)
    contexto = "\n\n".join(bloco.page_content for bloco in blocos)
    resposta = texto_da(chain.invoke({"context": contexto, "question": pergunta}))
    modulo = None
    achado = re.search(r"Módulo (\d)", resposta)
    if achado and int(achado.group(1)) in MODULOS:
        numero = int(achado.group(1))
        modulo = f"Módulo {numero} · {MODULOS[numero]}"
    _cache[chave] = (resposta, modulo)
    return resposta, modulo
