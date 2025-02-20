from datetime import datetime
from config.db_connection import get_db_connection


def registrar_logout(username):
    """ Registra o logout do usuário no banco de dados. """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        data_hora_logout = datetime.now()
        cursor.execute('''
            UPDATE auth 
            SET last_logout = %s, status_logado = 'N' 
            WHERE username = %s
        ''', (data_hora_logout, username))

        conn.commit()
    finally:
        conn.close()