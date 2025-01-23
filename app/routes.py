from datetime import datetime
from flask import Blueprint, jsonify, request
from app.utils.data import ConsultaBanco, InserirBanco
from flask import jsonify, request
import threading 

main_bp = Blueprint('main',__name__)


from flask import jsonify, request
from datetime import datetime
import threading

@main_bp.route('/registro', methods=['POST'])
def registro():
    dataAtual = datetime.now()
    data = request.get_json()

    # Validação dos dados de entrada
    username = data.get('username')
    password = data.get('password')
    origin = data.get('origin')

    if not username:
        response = jsonify({"error": "Campo 'username' obrigatório!"})
        response.status_code = 400  # Bad Request
        return response

    if not password:
        response = jsonify({"error": "Campo 'password' obrigatório!"})
        response.status_code = 400  # Bad Request
        return response

    if not origin:
        response = jsonify({"error": "Campo 'origin' obrigatório!"})
        response.status_code = 400  # Bad Request
        return response

    if ConsultaBanco.BuscarUsuario(username) == True:
        return jsonify({"error": f"Usuario '{username}' ja registrado!"}),500

    dataOBJ = dataAtual.strftime("%Y-%m-%d %H:%M:%S")

    # Cria um dicionário para armazenar o resultado
    result_holder = {}

    # Função para inserir o usuário em um thread separado
    def inserir_usuario():
        nonlocal result_holder  # Permite modificar result_holder dentro do escopo da função
        try:
            result = InserirBanco.NovoUsuario(username, password, origin, dataOBJ)
            status_result, code = result

            # Verifica se status_result é um dicionário de erro
            if isinstance(status_result, dict):
                status_message = status_result.get('status', 'unknown')
                message = status_result.get('message', 'Erro desconhecido')  # Mensagem padrão se não houver
                codigo_api = code
                result_holder["result"] = {
                    "error": message,
                    "codigo": codigo_api,
                    "status": status_message
                }
            else:
                status_message = status_result
                codigo_api = 200  # Supondo que 200 é o código de sucesso
                result_holder["result"] = {
                    "status": status_message,
                    "message": "Usuário registrado com sucesso.",
                    "code": codigo_api,
                }
        except Exception as e:
            result_holder["result"] = {
                "error": str(e),
                "codigo": 500,
                "status": "Erro ao inserir usuário"
            }

    # Inicia a tarefa de inserção em um thread separado
    thread = threading.Thread(target=inserir_usuario)
    thread.start()
    thread.join()  # Espera o thread terminar antes de continuar

    return jsonify(result_holder["result"])