MENSAGEM_DIA = "Os tokens da IA do MVP acabaram por hoje, volte amanhã."
MENSAGEM_MINUTO = "A IA está com muitas solicitações. Aguarde um minuto e tente de novo."


def cota_esgotada(erro):
    texto = str(erro)
    return "RESOURCE_EXHAUSTED" in texto or "429" in texto or "quota" in texto.lower()


def mensagem_cota(erro):
    return MENSAGEM_MINUTO if "PerMinute" in str(erro) else MENSAGEM_DIA


def texto_da(resposta):
    conteudo = resposta.content
    if isinstance(conteudo, str):
        return conteudo
    return "".join(parte.get("text", "") if isinstance(parte, dict) else str(parte) for parte in conteudo)
