import os
import time
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag import responder
from risco import analisar_foto
from gemini import cota_esgotada, mensagem_cota

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000/api/v1")
ORIGENS = [origem.strip() for origem in os.getenv("CORS_ORIGINS", "*").split(",")]

app = FastAPI(title="Guardião IA")
app.add_middleware(CORSMiddleware, allow_origins=ORIGENS, allow_methods=["*"], allow_headers=["*"])

validos = {}


def usuario_logado(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Faça login para continuar.")
    if validos.get(authorization, 0) > time.time():
        return True
    try:
        resposta = requests.get(f"{API_BASE_URL}/me", headers={"Authorization": authorization}, timeout=5)
    except requests.RequestException:
        raise HTTPException(503, "Não consegui validar o login agora.")
    if resposta.status_code != 200:
        raise HTTPException(401, "Sessão inválida ou expirada.")
    if len(validos) > 1000:
        validos.clear()
    validos[authorization] = time.time() + 60
    return True


class Pergunta(BaseModel):
    pergunta: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/duvidas")
def duvidas(dados: Pergunta, logado=Depends(usuario_logado)):
    try:
        resposta, modulo = responder(dados.pergunta)
    except Exception as erro:
        print(erro)
        if cota_esgotada(erro):
            return {"resposta": mensagem_cota(erro), "modulo": None}
        return {"resposta": "Não consegui responder agora. Tente de novo em instantes.", "modulo": None}
    return {"resposta": resposta, "modulo": modulo}


@app.post("/risco/analisar")
def risco(foto: UploadFile = File(...), logado=Depends(usuario_logado)):
    return analisar_foto(foto.file.read())
