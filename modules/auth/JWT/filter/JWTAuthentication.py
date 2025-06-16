from urllib.parse import urlencode
import jwt
from datetime import datetime, timedelta
from typing import Optional
from collections.abc import Mapping
from config import config
from config.logger_config import logger
from functools import wraps
from flask import make_response, redirect, request, jsonify

# Classe para representar um usuário
class User:
    def __init__(self, username: str, password: str, role: str):
        self.username = username
        self.password = password
        self.role = role

# Classe para gerenciar a autenticação JWT
class JWTUtil:
    def __init__(self):
        self.secret = config.SECRET_TOKEN
        self.expiration = 24 * 60 * 60  # 24 horas em segundos

    def generate_token(self, username: str, origem: str, role: str, id: int) -> str:
        try:
            expiration_date = datetime.utcnow() + timedelta(seconds=self.expiration)

            payload = {
                "id": id,
                "sub": username,
                "iss": origem,
                "role": role,
                "exp": expiration_date
            }

            token = jwt.encode(payload, self.secret, algorithm="HS512")
            return token
        except Exception as e:
            raise Exception(f"Error generating token: {e}")

    def token_valido(self, token: str) -> bool:
        try:
            claims = self.get_claims(token)
            if claims:
                username = claims.get("sub")
                expiration_date = claims.get("exp")
                now = datetime.utcnow()
                if username and expiration_date and now < datetime.utcfromtimestamp(expiration_date):
                    return True
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired.")
        except jwt.InvalidTokenError:
            logger.warning("Invalid token.")
        return False

    def get_username(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("sub") if claims else None

    def get_origem(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("iss") if claims else None

    def get_role(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("role") if claims else None
    
    def get_id(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("id") if claims else None   

    def get_claims(self, token: str) -> Optional[dict]:
        try:
            claims = jwt.decode(token, self.secret, algorithms=["HS512"])
            return claims
        except jwt.ExpiredSignatureError:
            print("Token expired.")
        except jwt.InvalidTokenError:
            print("Invalid token.")
        return None



# Middleware para validar o token JWT
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = obter_token()
        if not token:
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"error": "Token não encontrado. Faça login novamente."}), 401
            return redirect('/logout?error=Token não encontrado. Faça login novamente.')

        try:
            jwt_util = JWTUtil()
            if not jwt_util.token_valido(token):
                if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                    return jsonify({"error": "Sessão expirada! Faça login novamente."}), 401
                return redirect('/logout?error=Sessão expirada! Faça login novamente.')
        except jwt.ExpiredSignatureError:
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"error": "Seu token expirou! Faça login novamente."}), 401
            return redirect('/logout?error=Seu token expirou! Faça login novamente.')
        except jwt.InvalidTokenError:
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"error": "Token inválido! Faça login novamente."}), 401
            return redirect('/logout?error=Token inválido! Faça login novamente.')

        return f(*args, **kwargs)

    return decorated



def obter_token():
    """
    Obtém o token da requisição, seja do cabeçalho Authorization ou dos cookies.

    Returns:
        str: O token JWT extraído, ou None se não estiver presente.
    """
    token = None

    # Verifica se o token está nos cookies
    if 'api.token.workspace' in request.cookies:
        token = request.cookies.get('api.token.workspace')

    # Verifica se o token está no cabeçalho Authorization
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token