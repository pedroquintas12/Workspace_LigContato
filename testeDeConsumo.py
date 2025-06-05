import requests
import xml.etree.ElementTree as ET
import json
from app.utils.data import ConsultaBanco

# Carrega as siglas dos estados do arquivo estados.json
with open('estados.json', 'r', encoding='utf-8') as f:
    data_estados = json.load(f)
    SIGLAS_ESTADOS = data_estados.get("estados", [])

# Carrega o JSON dos diários por estado uma única vez (assumindo que esse arquivo existe)
with open('diarios.json', 'r', encoding='utf-8') as f:
    DIARIOS_POR_ESTADO = json.load(f)

def get_text_or_none(element, tag):
    el = element.find(tag)
    return el.text.strip() if el is not None and el.text else None

def get_dados_escritorio(cod_escritorio):

    companies = ConsultaBanco.PuxarCompanies()
    if not companies:
        raise Exception("Nenhuma companhia encontrada no banco de dados.")

    url = "http://online.solucionarelj.com.br:9191/recorte/webservice/20181220/service/nomes.php"
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://online.solucionarelj.com.br:9191/recorte/webservice/20181220/service/nomes.php#getNomesPesquisaResumido"  
    }

    body = f"""<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <getNomesPesquisaResumido>
          <nomeRelacional>{companies[0][2]}</nomeRelacional>
          <token>{companies[0][1]}</token>
          <codEscritorio>{cod_escritorio}</codEscritorio>
        </getNomesPesquisaResumido>
      </soap:Body>
    </soap:Envelope>"""

    response = requests.post(url, data=body.encode("utf-8"), headers=headers)

    if response.status_code != 200:
        raise Exception(f"Erro na requisição SOAP: {response.status_code}")

    root = ET.fromstring(response.content)

    items = root.findall('.//item')

    resultado = []

    for item in items:
        nome_cliente = get_text_or_none(item, 'nome')
        nome_escritorio = get_text_or_none(item, 'nomeEscritorio')
        abrangencias = [abr.text.strip() for abr in item.find('abrangencia').findall('item')] if item.find('abrangencia') else []

        if not nome_cliente and not nome_escritorio:
            continue

        abrangencia_por_estado = {}

        for estado in SIGLAS_ESTADOS:
            diarios_validos_estado = DIARIOS_POR_ESTADO.get(estado, [])
            abrangencias_validas = [abr for abr in abrangencias if estado in abr and abr in diarios_validos_estado]
            if abrangencias_validas:
                abrangencia_por_estado[estado] = abrangencias_validas

        resultado.append({
            "nome_escritorio": nome_escritorio,
            "nome_cliente": nome_cliente,
            "abrangencia": abrangencias,
            "abrangencia_por_estado": abrangencia_por_estado
        })

    return resultado



