from flask import Blueprint, jsonify, render_template

from modules.auth.JWT.filter.JWTAuthentication import token_required, JWTUtil,obter_token


front_bp = Blueprint('front',__name__)
jwt_util = JWTUtil()

@front_bp.route('/teste-front')
def teste():
    return render_template('teste.html')

@front_bp.route('/confeccao_pecas')
def testeLogin():
    if jwt_util.get_role(obter_token()) != 'ADM':
        return jsonify({"error": "Acesso negado! Você não tem permissão para acessar esta página."}), 403
    return render_template('confeccao.html', username= jwt_util.get_username(obter_token()), role= jwt_util.get_role(obter_token()))


@front_bp.route('/signin')
def signin():
    return render_template("login.html")

# Pagina padrão para funcionario/admin
@front_bp.route('/')
@token_required
def index():
    return render_template('index.html', username= jwt_util.get_username(obter_token()), role= jwt_util.get_role(obter_token()))

# Pagina do ADMIN
@front_bp.route('/admin')
@token_required
def admin():
    # Verifica se a role do usuário é 'admin'
    if jwt_util.get_role(obter_token()) != 'ADM':
        return jsonify({"error": "Acesso negado! Você não tem permissão para acessar esta página."}), 403
    
    return render_template('Admin.html', username= jwt_util.get_username(obter_token()),role= jwt_util.get_role(obter_token()))

# pagina de monitoramento dos usuarios
@front_bp.route("/users", methods=["GET",])
@token_required
def users():
    # Verifica se o usuário tem permissão para acessar esta rota
    if jwt_util.get_role(obter_token()) != "ADM":
        return jsonify({"error": "Acesso negado! Apenas administradores podem acessar esta rota."}), 403
    
    return render_template("users.html" , username = jwt_util.get_username(obter_token()), role = jwt_util.get_role(obter_token()))

# Pagina de relatorio
@front_bp.route('/relatorio')
@token_required
def relatorio():
    # Verifica se a role do usuário é 'admin'
    if jwt_util.get_role(obter_token()) != 'ADM':
        return jsonify({"error": "Acesso negado! Você não tem permissão para acessar esta página."}), 403
    
    return render_template('relatorio.html', username= jwt_util.get_username(obter_token()),role= jwt_util.get_role(obter_token()))