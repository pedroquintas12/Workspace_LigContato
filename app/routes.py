from datetime import datetime, time
from flask import Blueprint, Response, json, jsonify, make_response, render_template, request
from app.utils.data import ConsultaBanco, InserirBanco
from flask import jsonify, request
import threading 
from config.db_connection import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from modules.auth.JWT.filter.JWTAuthentication import JWTUtil, token_required
from time import sleep
from app.utils.date_utils import formatar_data

main_bp = Blueprint('main',__name__)

@main_bp.route('/register', methods=['POST'])
def register():
    dataAtual = datetime.now()
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")
    origin = data.get("origin")

    # Validação básica
    if not username or not password or not role:
        return jsonify({"message": "Todos os campos são obrigatórios."}), 400

    if ConsultaBanco.BuscarUsuario(username):
        return jsonify({"message": "Usuário já registrado."}), 400

    # Criptografa a senha antes de salvar
    hashed_password = generate_password_hash(password)

    dataOBJ = dataAtual.strftime("%Y-%m-%d %H:%M:%S")

    # Cria um dicionário para armazenar o resultado
    result_holder = {}

    # Função para inserir o usuário em um thread separado
    def inserir_usuario():
        nonlocal result_holder  # Permite modificar result_holder dentro do escopo da função
        try:
            result = InserirBanco.NovoUsuario(username, hashed_password,origin,role, dataOBJ)
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

@main_bp.route('/login', methods=['POST', 'GET'])
def login():
    if request.method == "GET":
        return render_template("login.html")
    
    if request.method == "POST":
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        origin = data.get("origin")

        # Cria um dicionário para armazenar o resultado
        result_holder = {}

        try:
            # Busca o usuário no banco de dados
            user = ConsultaBanco.BuscarUsuario(username)
            if not user:
                result_holder["result"] = {
                    "error": "Usuário não encontrado.",
                    "codigo": 404,
                    "status": "Falha no login"
                }
                return jsonify(result_holder["result"]), 404

            # Valida a senha criptografada
            if not check_password_hash(user[2], password):
                result_holder["result"] = {
                    "error": "Senha inválida.",
                    "codigo": 401,
                    "status": "Falha no login"
                }
                return jsonify(result_holder["result"]), 401

            jwt_util = JWTUtil()  # Cria uma instância da classe JWTUtil
            # Autenticação bem-sucedida
            token = jwt_util.generate_token(username, origin, user[3])
            result_holder["result"] = {
                "id": user[0],
                "username": username,
                "token": token,
                "origin": origin
            }

            # Criar uma resposta e adicionar o cookie
            resp = make_response(jsonify(result_holder["result"]))
            resp.set_cookie('api.token', token, httponly=True)
            return resp

        except Exception as e:
            result_holder["result"] = {
                "error": str(e),
                "codigo": 500,
                "status": "Erro durante o login"
            }
            return jsonify(result_holder["result"]), 500


# Rota para a página do funcionário
@main_bp.route('/')
def index():
    return render_template('index.html')

# Rota para a página do administrador
@main_bp.route('/admin')
def admin():
    return render_template('index.html')

# Rota para registrar uma ação do usuário
@main_bp.route('/api/actions/registrar', methods=['POST'])
@token_required
def registrar_acao():
    data = request.json
    usuario = data.get('usuario')
    estado = data.get('estado')
    diario = data.get('diario')
    status = data.get('status')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO log_actions (username, estado, diario, status)
        VALUES (%s, %s, %s, %s)
    ''', (usuario, estado, diario, status))
    conn.commit()
    conn.close()

    return jsonify({"message": "Ação registrada com sucesso!"}), 201

# Rota para listar todas as ações
@main_bp.route('/api/actions/listar')
def listar_acoes():
    status = request.args.get('status')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # Retorna os resultados como dicionários
    if status:
        cursor.execute('SELECT * FROM log_actions WHERE status = %s order by ID_log', (status,))
    else:
        cursor.execute('SELECT * FROM log_actions order by ID_log desc')
    acoes = cursor.fetchall()
    indexed_data = {i: registro for i, registro in enumerate(acoes)}

    for registro in indexed_data.values():
        registro['inicio'] = formatar_data(registro['inicio'])
        registro['fim'] = formatar_data(registro['fim'])


    listnmes = [indexed_data[i] for i in sorted(indexed_data)]
    conn.close()

    return jsonify(acoes)

@main_bp.route('/api/actions/finalizar/<int:id>', methods=['PUT'])
@token_required
def finalizar_acao(id):
    # Obter o tempo de início da ação
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT inicio FROM log_actions WHERE ID_log = %s', (id,))
    action = cursor.fetchone()

    if action:
        inicio = action[0]
        fim = datetime.now()

        # Calcular o tempo decorrido em segundos
        tempo_decorrido = (fim - inicio).total_seconds()

        # Atualizar o status para 'F' (finalizado) e salvar o tempo decorrido
        cursor.execute('''
            UPDATE log_actions
            SET status = 'F', fim = %s, tempo_decorrido = %s
            WHERE ID_log = %s
        ''', (fim, tempo_decorrido, id))
        conn.commit()

    conn.close()
    return jsonify({"message": "Ação finalizada com sucesso!"})

# Rota para SSE (atualização em tempo real)
@main_bp.route('/api/actions/stream')
def stream_acoes():
    def gerar_eventos():
        while True:
            try:
                # Consulta ao banco para buscar as ações do dia
                data = datetime.now()
                ano = data.year
                mes = str(data.month).zfill(2)
                dia = str(data.day).zfill(2)

                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(f"SELECT * FROM log_actions WHERE DATE(inicio) = '{ano}-{mes}-{dia}'")
                acoes = cursor.fetchall()
                indexed_data = {i: registro for i, registro in enumerate(acoes)}

                for registro in indexed_data.values():
                    registro['inicio'] = formatar_data(registro['inicio'])
                    registro['fim'] = formatar_data(registro['fim'])

                
                listnmes = [indexed_data[i] for i in sorted(indexed_data)]

                conn.close()

                # Envia os dados no formato esperado pelo SSE
                yield f"data: {json.dumps(listnmes)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            

    return Response(gerar_eventos(), mimetype="text/event-stream")

