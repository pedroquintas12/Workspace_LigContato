from datetime import datetime, time
from flask import Blueprint, Response, json, jsonify, make_response, redirect, render_template, request
from app.utils.data import ConsultaBanco, InserirBanco
from flask import jsonify, request
import threading 
from config.db_connection import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from modules.auth.JWT.filter.JWTAuthentication import JWTUtil, token_required, obter_token
from app.utils.date_utils import formatar_data
from time import sleep 
from config.logger_config import logger

main_bp = Blueprint('main',__name__)
jwt_util = JWTUtil()  # Cria uma instância da classe JWTUtil


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

@main_bp.route('/login', methods=['POST'])
def login():
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
        
        if user[5] != "L":
            result_holder["result"] = {
                "error": "Usuário bloqueado.",
                "codigo": 404,
                "status": "Falha no login"
            }
            return jsonify(result_holder["result"]), 404

        # Atualiza a última data de login e status no banco de dados
        conn = get_db_connection()
        cursor = conn.cursor()
        data_hora_login = datetime.now()
        
        cursor.execute('''
            UPDATE auth 
            SET last_login = %s, status_logado = 'L' 
            WHERE username = %s
        ''', (data_hora_login, username))
        conn.commit()
        conn.close()

        # Gera o token JWT
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


@main_bp.route('/logout')
def logout():
    response = make_response(redirect('/signin'))
    
    # Atualiza a última data de login e status no banco de dados
    conn = get_db_connection()
    cursor = conn.cursor()
    data_hora_login = datetime.now()
    
    cursor.execute('''
        UPDATE auth 
        SET last_logout = %s, status_logado = 'N' 
        WHERE username = %s
    ''', (data_hora_login, jwt_util.get_username(obter_token())))
    conn.commit()
    conn.close()
    
    # Deleta todos os cookies (precisa passar o path correto)
    cookies = request.cookies
    for cookie_name in cookies:
        response.delete_cookie(cookie_name, path='/')
    
    return response

# Carregar o arquivo JSON com os diários por estado
with open('diarios.json', 'r') as f:
    diarios_data = json.load(f)

@main_bp.route('/api/diarios', methods=['GET'])
def get_diarios():
    # Obtém os estados passados como uma string separada por vírgula
    estados_param = request.args.get('publicationsState')

    if not estados_param:
        return jsonify({"error": "Nenhum estado fornecido"}), 400

    # Divide a string de estados em uma lista
    estados = estados_param.split(',')

    result = {}

    # Para cada estado, verificar se ele existe no arquivo JSON
    for estado in estados:
        estado = estado.strip()  # Remove espaços extras, se houver
        if estado not in diarios_data:
            result[estado] = {"error": "Estado não encontrado"}
        else:
            result[estado] = diarios_data[estado]

    return jsonify(result), 200

# Rota para registrar uma ação do usuário
@main_bp.route('/api/actions/registrar', methods=['POST'])
@token_required
def registrar_acao():
    data = request.json
    usuario = jwt_util.get_username(obter_token())
    estado = data.get('estado')
    diario = data.get('diario')
    status = "L"

    result_holder = {}

    if not estado and not diario:
        result_holder["result"] = {
            "error": "Obrigatorio todos os campos.",
            "codigo": 404,
            "status": "Falha ao registrar estado e diario"
        }
        return jsonify(result_holder["result"]), 404

    conn = get_db_connection()
    cursor = conn.cursor()
    # Verifica se já existe um registro ativo para o mesmo usuário, estado e diário
    cursor.execute('''
        SELECT username FROM log_actions 
        WHERE estado = %s AND diario = %s AND status = 'L'
    ''', (estado, diario))

    existing_action = cursor.fetchone()

    if existing_action:
        conn.close()

        if usuario == existing_action[0]:
            return jsonify({
            "error": f"Você está lendo esse diario",
            "codigo": 409,  # Código 409 indica conflito
            "status": "Duplicidade detectada"
        }), 409

        return jsonify({
            "error": f"{existing_action[0]} está lendo esse diario",
            "codigo": 409,  # Código 409 indica conflito
            "status": "Duplicidade detectada"
        }), 409

    cursor.execute('''SELECT ID_auth from auth where username = %s''', (usuario,))
    user = cursor.fetchone()
    
    cursor.execute('''
        INSERT INTO log_actions (ID_auth,username,estado, diario, status)
        VALUES (%s,%s, %s, %s, %s)
    ''', (user[0],usuario, estado, diario, status))
    conn.commit()
    conn.close()

    return jsonify({"message": "Ação registrada com sucesso!"}), 200

@main_bp.route('/api/actions/stream', methods=['GET'])
def stream_actions():
    def event_stream():
        last_update = None
        today = datetime.now().strftime('%Y-%m-%d')  # Filtra os dados apenas do dia atual

        while True:
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)

                # Verifica a última atualização na tabela log_updates
                cursor.execute("SELECT MAX(last_update) as last_update FROM log_updates")
                result = cursor.fetchone()
                new_update = result['last_update']

                if new_update and new_update != last_update:
                    last_update = new_update

                    # Busca os registros de log_actions do dia atual
                    cursor.execute("SELECT * FROM log_actions WHERE DATE(inicio) = %s ORDER BY ID_log DESC", (today,))
                    acoes = cursor.fetchall()

                    for registro in acoes:
                        registro['inicio'] = formatar_data(registro['inicio'])
                        registro['fim'] = formatar_data(registro['fim'])  

                    # Envia os dados via SSE
                    yield f"data: {json.dumps(acoes)}\n\n"

                conn.close()
                sleep(2)  # Aguarda 2 segundos antes de verificar novamente

            except Exception as e:
                logger.error(f"Erro no SSE: {e}")
                sleep(2)
    threading.Thread(target=event_stream, daemon=True).start()

    return Response(event_stream(), content_type="text/event-stream")
    

@main_bp.route('/api/actions/stream_listar')
def stream_listar():
    def event_stream():
        last_update = None
        while True:
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)

                cursor.execute("SELECT MAX(last_update) as last_update FROM log_updates")
                result = cursor.fetchone()
                new_update = result['last_update']

                if new_update and new_update != last_update:
                    last_update = new_update

                    cursor.execute("SELECT * FROM log_actions ORDER BY ID_log DESC")
                    acoes = cursor.fetchall()

                    for registro in acoes:
                        registro['inicio'] = formatar_data(registro['inicio'])
                        registro['fim'] = formatar_data(registro['fim'])    

                    yield f"data: {json.dumps(acoes)}\n\n"

                conn.close()
                sleep(2)  # Aguarda 2 segundos antes de verificar novamente

            except Exception as e:
                print(f"Erro no SSE: {e}")
                sleep(2)
    threading.Thread(target=event_stream, daemon=True).start()
    return Response(event_stream(), content_type="text/event-stream")

@main_bp.route('/api/actions/finalizar/<int:id>', methods=['PUT'])
@token_required
def finalizar_acao(id):
    username = jwt_util.get_username(obter_token())
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verifica se a ação existe e pertence ao usuário
    cursor.execute('''
        SELECT inicio, username
        FROM log_actions
        WHERE ID_log = %s
    ''', (id,))
    action = cursor.fetchone()

    if not action:
        conn.close()
        return jsonify({"error": "Ação não encontrada!"}), 404

    if action[1] != username:
        conn.close()
        return jsonify({"error": "Você não tem permissão para finalizar esta ação!"}), 403

    # Calcula o tempo decorrido e atualiza a ação para finalizada
    inicio = action[0]
    fim = datetime.now()
    tempo_decorrido = (fim - inicio).total_seconds()

    cursor.execute('''
        UPDATE log_actions
        SET status = 'F', fim = %s, tempo_decorrido = %s
        WHERE ID_log = %s
    ''', (fim, tempo_decorrido, id))
    conn.commit()

    conn.close()

    return jsonify({"message": "Ação finalizada com sucesso!"})


@main_bp.route('/api/user/actions', methods=['GET'])
@token_required  
def get_user_actions():
    username= jwt_util.get_username(obter_token())
    conn = get_db_connection()
    cursor = conn.cursor()

    # Consulta para pegar as ações do usuário que estão com status "L"
    cursor.execute('''
        SELECT ID_log, estado, diario
        FROM log_actions
        WHERE username = %s AND status = 'L'
    ''', (username,))
    actions = cursor.fetchall()

    conn.close()

    # Converte as ações para JSON
    user_actions = [
        {
            'ID_log': action[0],
            'estado': action[1],
            'diario': action[2]
        }
        for action in actions
    ]

    return jsonify(user_actions)

@main_bp.route("/api/users", methods=["GET",])
@token_required
def api_users():
    # Verifica se o usuário tem permissão para acessar esta rota
    if jwt_util.get_role(obter_token()) != "ADM":
        return jsonify({"error": "Acesso negado! Apenas administradores podem acessar esta rota."}), 403

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Consulta os usuários e suas informações
        cursor.execute('''  
            SELECT 
                u.username, 
                u.ID_auth,
                MAX(u.last_login) AS last_login,
                u.status_logado,
                (
                    SELECT la.estado
                    FROM log_actions la
                    WHERE la.username = u.username
                    ORDER BY la.inicio DESC 
                    LIMIT 1
                ) AS ultima_acao_estado,
                (
                    SELECT la.diario
                    FROM log_actions la
                    WHERE la.username = u.username
                    ORDER BY la.inicio DESC 
                    LIMIT 1
                ) AS ultima_acao_diario,
                (
                    SELECT la.status
                    FROM log_actions la
                    WHERE la.username = u.username
                    ORDER BY la.inicio DESC 
                    LIMIT 1
                ) AS ultima_acao_status,
                (
                    SELECT la.inicio
                    FROM log_actions la
                    WHERE la.username = u.username
                    ORDER BY la.inicio DESC 
                    LIMIT 1
                ) AS inicio_leitura
            FROM auth u
            LEFT JOIN log_actions l ON u.username = l.username
            GROUP BY u.username,u.ID_auth, u.status_logado
            ORDER BY u.username
        ''')

        usuarios = cursor.fetchall()

        # Formata os dados para retornar no JSON
        usuarios_formatados = [
            {
                "username": usuario["username"],
                "ID_auth": usuario["ID_auth"],
                "last_login": formatar_data(usuario["last_login"]),  # Formata a data
                "status_logado": usuario["status_logado"],
                "ultima_acao": {
                    "estado": usuario["ultima_acao_estado"],
                    "diario": usuario["ultima_acao_diario"],
                    "status": usuario["ultima_acao_status"],
                    "inicio_leitura": formatar_data(usuario["inicio_leitura"])  # Formata a data
                }
            }
            for usuario in usuarios
        ]

        conn.close()

        return jsonify(usuarios_formatados), 200

    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
    
@main_bp.route('/api/salvar_inatividade', methods = ['POST'])
@token_required
def salvar_inatividade():
        data = request.get_json()
        tempo_inatividade = data.get('tempo_inatividade')
        user = jwt_util.get_username(obter_token())

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute('''SELECT ID_auth from auth where username = %s''', (user,))
            user_id = cursor.fetchone()

            cursor.execute('''SELECT ID_log from log_actions where username = %s and status=L''', (user,))
            id_log = cursor.fetchone()

            cursor.execute("INSERT INTO auth_inatividade (ID_auth,ID_log,username, tempo_inatividade) VALUES (%s,%s,%s, %s)", 
                        (user_id['ID_auth'],id_log['ID_log'],user, tempo_inatividade))
            conn.commit()
            conn.close()

            return jsonify({"message": "Tempo de inatividade salvo com sucesso"}), 200

        except Exception as e:
            return jsonify({"erro ao salvar inatividade": str(e)}), 500
        
@main_bp.route('/api/users/<int:id>/history', methods=["GET"])
@token_required
def get_user_history(id):

    # Verifica se o usuário tem permissão para acessar o histórico
    if jwt_util.get_role(obter_token()) != "ADM":
        return jsonify({"error": "Acesso negado!"}), 403

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Consulta o histórico do usuário
        cursor.execute('''
            SELECT
                la.inicio,
                la.fim,
                la.estado,
                la.diario,
                la.status,
                (
                    SELECT ai.tempo_inatividade
                    FROM auth_inatividade ai
                    WHERE la.ID_auth = ai.ID_auth
                    LIMIT 1
                ) AS tempo_inativo 
            FROM log_actions la
            WHERE la.ID_auth = %s
            ORDER BY la.inicio DESC
        ''', (id,))

        history_data = cursor.fetchall()

        # Formata os dados para enviar como resposta
        history_formatted = [
            {
                "timestamp": formatar_data(entry["inicio"]),
                "acao": f'{entry["estado"]} - {entry["diario"]}',
                "tempo_inativo": entry["tempo_inativo"] or "N/A"
            }
            for entry in history_data
        ]

        conn.close()

        return jsonify(history_formatted), 200

    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
