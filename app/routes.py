from datetime import datetime, time
from flask import Blueprint, Response, json, jsonify, make_response, redirect, render_template, request
from app.utils.data import ConsultaBanco, InserirBanco
from flask import jsonify, request
import threading 
from config.db_connection import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from modules.auth.JWT.filter.JWTAuthentication import JWTUtil, token_required, obter_token
from app.utils.date_utils import formatar_data,formartar_data_AMD
from time import sleep 
from config.logger_config import logger

main_bp = Blueprint('main',__name__)
jwt_util = JWTUtil()  # Cria uma instância da classe JWTUtil


@main_bp.route('/register', methods=['POST'])
@token_required
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
    data_hora_login = datetime.now()

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
        
        if user[6]!= "N":
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''UPDATE auth SET last_logout= %s, status_logado = 'N'
                           WHERE username = %s''',(data_hora_login, username))
            conn.commit()
            conn.close()


        # Atualiza a última data de login e status no banco de dados
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
    conn = get_db_connection()
    cursor = conn.cursor()
    data_hora_login = datetime.now()

    username = jwt_util.get_username(obter_token())

    if username:
        cursor.execute('''
            UPDATE auth 
            SET last_logout = %s, status_logado = 'N' 
            WHERE username = %s
        ''', (data_hora_login, username))
        conn.commit()
    
    conn.close()

    # Obtém a mensagem de erro da URL (se existir)
    error_message = request.args.get("error", "Sessão encerrada com sucesso.")

    response = make_response(redirect(f'/signin?error={error_message}'))

    # Deleta todos os cookies
    cookies = request.cookies
    for cookie_name in cookies:
        response.delete_cookie(cookie_name, path='/')

    return response


# Carregar o arquivo JSON com os diários por estado
with open('diarios.json', 'r') as f:
    diarios_data = json.load(f)

@main_bp.route('/api/diarios', methods=['GET'])
@token_required
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
    diarios = data.get('diarios')  
    complemento = data.get('complemento')
    data_publicacao = data.get('data_publicacao')
    status = "L"

    if not estado or not diarios or not data_publicacao:
        return jsonify({
            "error": "Obrigatório informar estado, diários e data de publicação.",
            "codigo": 404,
            "status": "Falha ao registrar estado e diários"
        }), 404

    # Garantir que 'diarios' seja uma lista válida
    if not isinstance(diarios, list):
        return jsonify({
            "error": "O campo 'diario' deve ser uma lista.",
            "codigo": 400,
            "status": "Formato inválido"
        }), 400

    # Conexão com o banco
    conn = get_db_connection()
    cursor = conn.cursor()

    # Buscar ID do usuário
    cursor.execute("SELECT ID_auth FROM auth WHERE username = %s", (usuario,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({
            "error": "Usuário não encontrado.",
            "codigo": 401,
            "status": "Falha na autenticação"
        }), 401

    user_id = user[0]

    # Verificar se o usuário já está lendo dois diários (se não for ADM)
    if jwt_util.get_role(obter_token()) != "ADM":
        cursor.execute("SELECT COUNT(DISTINCT estado) FROM log_actions WHERE ID_auth = %s AND status = 'L';", (user_id,))
        active_count = cursor.fetchone()[0]

        if active_count >= 2:
            conn.close()
            return jsonify({
                "error": "Você só pode ler 2 estados por vez!",
                "codigo": 409,
                "status": "Atenção"
            }), 409

    cursor.execute("""
        SELECT username FROM log_actions 
        WHERE estado = %s AND status = 'L'
    """, (estado,))

    existing_state = cursor.fetchone()
    if existing_state:
        conn.close()

        if usuario == existing_state[0]:
            return jsonify({
                "error": "Você já está lendo esse estado.",
                "codigo": 409,
                "status": "Duplicidade detectada"
            }), 409

        return jsonify({
            "error": f"{existing_state[0]} está lendo esse estado.",
            "codigo": 409,
            "status": "Duplicidade detectada"
        }), 409
        
    # Verificar se já existe um registro ativo para o mesmo estado e algum dos diários
    for diario in diarios:
        cursor.execute("""
            SELECT username FROM log_actions 
            WHERE estado = %s AND diario = %s AND complemento = %s AND status = 'L'
        """, (estado, diario, complemento))

        existing_action = cursor.fetchone()
        if existing_action:
            conn.close()

            if usuario == existing_action[0]:
                return jsonify({
                    "error": "Você já está lendo esse diário.",
                    "codigo": 409,
                    "status": "Duplicidade detectada"
                }), 409

            return jsonify({
                "error": f"{existing_action[0]} está lendo esse diário.",
                "codigo": 409,
                "status": "Duplicidade detectada"
            }), 409

    # Inserir registros no banco para cada diário
    for diario in diarios:
        cursor.execute("""
            INSERT INTO log_actions (ID_auth, username, estado, diario, complemento, data_publicacao, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, usuario, estado, diario, complemento, data_publicacao, status))

    conn.commit()
    conn.close()

    return jsonify({"message": "Ação registrada com sucesso!"}), 200

@main_bp.route('/api/actions/stream', methods=['GET'])
@token_required
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
                    cursor.execute("SELECT * FROM log_actions WHERE DATE(inicio) = %s ORDER BY status DESC, data_publicacao DESC", (today,))
                    acoes = cursor.fetchall()

                    for registro in acoes:
                        registro['inicio'] = formatar_data(registro['inicio'])
                        registro['fim'] = formatar_data(registro['fim'])  
                        registro['data_publicacao'] = formartar_data_AMD(registro['data_publicacao'])


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
@token_required
def stream_listar():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Obtém a última atualização
        cursor.execute("SELECT MAX(last_update) as last_update FROM log_updates")
        result = cursor.fetchone()
        last_update = result['last_update']

        # Parâmetros de paginação
        page = request.args.get('page', 1, type=int)  # Página atual (padrão: 1)
        per_page = request.args.get('per_page', 10, type=int)  # Registros por página (padrão: 10)
        offset = (page - 1) * per_page  # Calcula o offset

        # Conta o total de registros para calcular a paginação
        cursor.execute("SELECT COUNT(*) as total FROM log_actions")
        total_records = cursor.fetchone()['total']
        total_pages = (total_records + per_page - 1) // per_page  # Calcula total de páginas

        # Busca registros paginados
        cursor.execute("""SELECT 
                            GROUP_CONCAT(DISTINCT ID_log ORDER BY ID_log SEPARATOR ', ') AS ID_log,
                            username, 
                            estado, 
                            GROUP_CONCAT(DISTINCT diario ORDER BY diario SEPARATOR ', ') AS diario,
                            complemento, 
                            status, 
                            inicio, 
                            fim, 
                            tempo_decorrido  
                        FROM log_actions
                        GROUP BY username, estado, complemento, status, inicio, fim, tempo_decorrido
                        ORDER BY status DESC, inicio DESC
                        LIMIT %s OFFSET %s;
                       """, (per_page, offset))
        acoes = cursor.fetchall()

        # Formata os dados antes de enviar
        for registro in acoes:
            registro['inicio'] = formatar_data(registro['inicio'])
            registro['fim'] = formatar_data(registro['fim'])

        conn.close()

        # Retorna os dados paginados
        return jsonify({
            "current_page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_records": total_records,
            "data": acoes
        })

    except Exception as e:
        print(f"Erro ao buscar ações: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500

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
        SELECT ID_log, estado, diario, complemento
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
            'diario': action[2],
            'complemento': action[3]
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
                MAX(u.last_logout) AS last_logout,
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
                "last_login": formatar_data(usuario["last_login"]),  
                "last_logout":formatar_data(usuario["last_logout"]),
                "status_logado": usuario["status_logado"],
                "historico": {
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
    
@main_bp.route('/api/salvar_inatividade', methods=['POST'])
@token_required
def salvar_inatividade():
    data = request.get_json()
    tempo_inatividade = data.get('tempo_inatividade')
    user = jwt_util.get_username(obter_token())

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Buscar ID_auth do usuário
        cursor.execute('SELECT ID_auth FROM auth WHERE username = %s', (user,))
        user_id = cursor.fetchone()

        if not user_id:
            return jsonify({"error": "Usuário não encontrado"}), 404

        # Buscar todos os ID_log associados ao usuário com status "L"
        cursor.execute('SELECT ID_log FROM log_actions WHERE ID_auth = %s AND status= "L"', (user_id['ID_auth'],))
        logs = cursor.fetchall()  # Obtém todos os registros

        if not logs:
            logs = [{"ID_log": None}]

        # Inserir múltiplos registros para cada ID_log encontrado
        for log in logs:
            cursor.execute(
                "INSERT INTO auth_inatividade (ID_auth, ID_log, username, tempo_inatividade, data) VALUES (%s, %s, %s, %s,%s)",
                (user_id['ID_auth'], log['ID_log'], user, tempo_inatividade,datetime.now())
            )

        conn.commit()

        return jsonify({"message": f"Tempo de inatividade salvo para {len(logs)} registros"}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

    finally:
        cursor.close()
        conn.close()
        
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
                la.complemento,
                (
                    SELECT ai.tempo_inatividade
                    FROM auth_inatividade ai
                    WHERE la.ID_auth = ai.ID_auth 
                    AND la.ID_log = ai.ID_log 
                    ORDER BY ai.ID_inatividade DESC 
                    LIMIT 1
                ) AS tempo_inativo,
                la.tempo_decorrido
            FROM log_actions la
            WHERE la.ID_auth = %s
            ORDER BY la.inicio DESC LIMIT 10;
        ''', (id,))

        history_data = cursor.fetchall()

        # Formata os dados para enviar como resposta
        history_formatted = [
            {
                "timestamp": formatar_data(entry["inicio"]),
                "estado": f'{entry["estado"]}',
                "diario":f'{entry["diario"]}',
                "status":f'{entry["status"]}',
                "tempo_decorrido":f'{entry["tempo_decorrido"]}',
                "tempo_inativo": entry["tempo_inativo"] or "N/A",
                "complemento":entry["complemento"]
            }
            for entry in history_data
        ]

        conn.close()

        return jsonify(history_formatted), 200

    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500


@main_bp.route('/api/search', methods=['GET'])
@token_required
def search():
    # Verifica se o usuário tem permissão para acessar o histórico
    if jwt_util.get_role(obter_token()) != "ADM":
        return jsonify({"error": "Acesso negado!"}), 403

    funcionario = request.args.get('FUNC')  # Nome do usuário buscado
    data_inicio = request.args.get('DATA_INICIO')  # Data de início do filtro
    data_fim = request.args.get('DATA_FIM')  # Data de fim do filtro
    pagina = int(request.args.get('pagina', 1))  # Página de resultados (default 1)
    itens_por_pagina = int(request.args.get('itens_por_pagina', 10))  # Itens por página (default 10)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Busca o ID do usuário pelo nome
        cursor.execute('SELECT ID_auth, username, last_login, last_logout FROM auth WHERE username = %s', (funcionario,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Usuário não encontrado!"}), 404

        user["last_login"] = formatar_data(user["last_login"])
        user["last_logout"] = formatar_data(user["last_logout"])
        user_id = user["ID_auth"]

        query_inatividade_semLeitura = 'SELECT SUM(tempo_inatividade) as tempo_inatividade FROM auth_inatividade WHERE ID_auth = %s AND ID_log IS null'
        params_inatividade_semLeitura = [user_id]

        query_inatividade_total = 'SELECT SUM(tempo_inatividade) as tempo_inatividade FROM auth_inatividade WHERE ID_auth = %s'
        params_inatividade_total = [user_id]

        query_logs_count = '''SELECT COUNT(*) FROM log_actions la WHERE la.ID_auth = %s'''
        params_logs_count = [user_id]

        query_logs = '''SELECT 
                            la.ID_log,
                            la.estado,
                            la.diario,
                            la.complemento,
                            la.status,
                            la.inicio,
                            la.fim,
                            la.tempo_decorrido
                        FROM log_actions la
                        WHERE la.ID_auth = %s'''
        params_logs = [user_id]

        if data_inicio and data_fim:
            query_inatividade_semLeitura += ' AND DATE(data) BETWEEN %s AND %s'
            query_inatividade_total += ' AND DATE(data) BETWEEN %s AND %s'
            query_logs += ' AND DATE(la.inicio) BETWEEN %s AND %s'
            query_logs_count += ' AND DATE(la.inicio) BETWEEN %s AND %s' 

            params_inatividade_semLeitura.extend([data_inicio, data_fim])
            params_inatividade_total.extend([data_inicio, data_fim])
            params_logs_count.extend([data_inicio, data_fim])
            params_logs.extend([data_inicio, data_fim])


        # Adicionando paginação à consulta de logs
        query_logs += ' ORDER BY la.inicio DESC LIMIT %s OFFSET %s;'
        params_logs.extend([itens_por_pagina, (pagina - 1) * itens_por_pagina])

        cursor.execute(query_inatividade_semLeitura, tuple(params_inatividade_semLeitura))
        inatividade_semLeitura = cursor.fetchone()

        cursor.execute(query_inatividade_total, tuple(params_inatividade_total))
        total_inatividade = cursor.fetchone()

        # Contagem total de logs
        cursor.execute(query_logs_count, tuple(params_logs_count))
        total_logs = cursor.fetchone()['COUNT(*)']

        # Calcular o total de páginas
        total_pages = (total_logs // itens_por_pagina) + (1 if total_logs % itens_por_pagina > 0 else 0)

        cursor.execute(query_logs, tuple(params_logs))
        logs = cursor.fetchall()

        response_data = {
            "ID_auth": user["ID_auth"],
            "username": user["username"],
            "last_login": user["last_login"],
            "last_logout": user["last_logout"],
            "tempo_sem_leitura": inatividade_semLeitura,
            "tempo_total_inativo": total_inatividade,
            "logs": [],
            "total_logs": total_logs,
            "total_pages": total_pages,
            "current_page": pagina
        }

        for log in logs:
            log["inicio"] = formatar_data(log["inicio"])
            log["fim"] = formatar_data(log["fim"])

            query_inatividade = 'SELECT SUM(tempo_inatividade) AS tempo_inatividade, data FROM auth_inatividade WHERE ID_auth = %s AND id_log = %s GROUP BY data'
            params_inatividade = [user_id, log["ID_log"]]

            if data_inicio and data_fim:
                query_inatividade += ' HAVING DATE(data) BETWEEN %s AND %s'
                params_inatividade.extend([data_inicio, data_fim])

            cursor.execute(query_inatividade, tuple(params_inatividade))
            inatividade = cursor.fetchall()

            for registro in inatividade:
                registro['data'] = formatar_data(registro['data'])
            
            log_data = {
                "ID_log": log["ID_log"],
                "estado": log["estado"],
                "diario": log["diario"],
                "complemento": log["complemento"],
                "status": log["status"],
                "inicio": log["inicio"],
                "fim": log["fim"],
                "tempo_decorrido": log["tempo_decorrido"],
                "inatividade": inatividade  # Lista de períodos de inatividade
            }

            response_data["logs"].append(log_data)

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
        conn.close()
