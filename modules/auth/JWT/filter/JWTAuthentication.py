import jwt
from datetime import datetime, timedelta
from typing import Optional


class JWTUtil:
    def __init__(self, secret: str):
        self.secret = secret
        self.expiration = 24 * 60 * 60  # 24 horas em segundos

    def generate_token(self, username: str, origem: str) -> str:
        try:
            expiration_date = datetime.utcnow() + timedelta(seconds=self.expiration)

            payload = {
                "sub": username,
                "iss": origem,
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
            print("Token expired.")
        except jwt.InvalidTokenError:
            print("Invalid token.")
        return False

    def get_username(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("sub") if claims else None

    def get_origem(self, token: str) -> Optional[str]:
        claims = self.get_claims(token)
        return claims.get("iss") if claims else None

    def get_claims(self, token: str) -> Optional[dict]:
        try:
            claims = jwt.decode(token, self.secret, algorithms=["HS512"])
            return claims
        except jwt.ExpiredSignatureError:
            print("Token expired.")
        except jwt.InvalidTokenError:
            print("Invalid token.")
        return None
