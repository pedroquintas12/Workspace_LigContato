import mysql.connector
from config.db_connection import get_db_connection
from config.logger_config import logger
import bcrypt

class ConsultaBanco:


    @staticmethod
    def VerificarLeitura():
        """
        Verifica se alguem esta lendo diario.

        returns:
        retorna o nome de usuario e diarios que esta lendo o diario ou 'False' caso não exista
        """
        try:
            db_connection = get_db_connection()
            db_cursor = db_connection.cursor()
            query = """SELECT username,GROUP_CONCAT(DISTINCT diario ORDER BY diario SEPARATOR ', ') AS diario FROM log_actions WHERE status = 'L' group by username limit 1"""
            db_cursor.execute(query)
            result = db_cursor.fetchone()
            if result:
                return result # Retorna o nome de usuário que está lendo o diário
            
        except mysql.connector.Error as err:
            logger.error(f"Erro ao verificar leitura do banco de dados: {err}")
            return False
        
    @staticmethod
    def BuscarUsuario(username):
        """
        parametro(username)

        Obtém o acesso do usuario

        returns:
        bloolean: 'True' ou 'False' caso não existe
        """
        try:
            db_connection = get_db_connection()
            db_cursor = db_connection.cursor()
            query = """SELECT * from auth where username = %s"""
            db_cursor.execute(query, (username,))
            result =db_cursor.fetchone()
            if result:
                return result
            
        except mysql.connector.Error as err:
            logger.error(f"Erro ao buscar usuario: {err}")
            return {"status": "error", "message": str(err)}, 500  # Retorna um dicionário de erro e o código 500

        except Exception as e:
            logger.error(f"Erro inesperado ao buscas ususario: {e}")
            return {"status": "error", "message": str(err)}, 500  # Retorna um dicionário de erro e o código 500

        finally:
            db_cursor.close()  # Fecha o cursor
            db_connection.close()  # Fecha a conexão
    
    def VerificarSenha(username, password):
            """
            Verifica se a senha inserida está correta.

            parameters:
            username (str): Nome de usuário
            password (str): Senha a ser verificada

            returns:
            boolean: 'True' se a senha estiver correta, 'False' caso contrário
            """
            try:
                db_connection = get_db_connection()
                db_cursor = db_connection.cursor()
                query = """SELECT password FROM auth WHERE username = %s"""
                db_cursor.execute(query, (username,))
                result = db_cursor.fetchone()

                if result is None:
                    return False  # Usuário não encontrado

                hashed_password = result[0]  # Obtém a senha criptografada do banco de dados
                return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))  # Verifica a senha
                
            except mysql.connector.Error as err:
                logger.error(f"Erro ao verificar senha: {err}")
                return False  # Retorna False em caso de erro
            except Exception as e:
                logger.error(f"Erro inesperado ao verificar senha: {e}")
                return False  # Retorna False em caso de erro
            finally:
                db_cursor.close()  # Fecha o cursor
                db_connection.close()  # Fecha a conexão


class InserirBanco:

    @staticmethod
    def NovoUsuario(username,password,origin,role,data):
        try:
            db_connection = get_db_connection()
            db_cursor = db_connection.cursor()
            query = """ INSERT INTO auth (username,password,role,origin,created_date,modified_date)
                        VALUES(%s,%s,%s,%s,%s,%s)"""
            db_cursor.execute(query,(username,password,role,origin,data,data))
            db_connection.commit()
            return {"status": "success", "message": "Usuário inserido com sucesso"}, 200  # Retorna um dicionário e o código 200
        except mysql.connector.Error as err:
            logger.error(f"Erro ao inserir usuario: {err}")
            return {"status": "error", "message": str(err)}, 500  # Retorna um dicionário de erro e o código 500
        except Exception as e:
            logger.error(f"Erro inesperado ao inserir usuario: {e}")
            return {"status": "error", "message": str(e)}, 500  # Retorna um dicionário de erro e o código 500

