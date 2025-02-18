from flask import Blueprint, jsonify, Response
from cachetools import LRUCache
import time

cache_bp = Blueprint('cache', __name__)

cache = LRUCache(maxsize=1)
cache["status_sistema"] = "desbloqueado"  # Inicializa o status padrão

# Variável para armazenar os clientes aguardando
clients = []

@cache_bp.route('/api/status_sistema', methods=['GET'])
def status_sistema():
    """Endpoint REST tradicional para obter o status do sistema"""
    return jsonify({"status": cache.get("status_sistema", "desbloqueado")}), 200

@cache_bp.route('/api/bloquear_acesso', methods=['GET'])
def bloquear_acesso():
    """Bloqueia o sistema e notifica os clientes via SSE"""
    if cache["status_sistema"] == "bloqueado":
        return jsonify({"message": "Turno já está em processo de fechamento"}), 200
    
    cache["status_sistema"] = "bloqueado"
    notify_clients()
    return jsonify({"message": "Sistema bloqueado com sucesso"}), 200

@cache_bp.route('/api/desbloquear_acesso', methods=['GET'])
def desbloquear_acesso():
    """Desbloqueia o sistema e notifica os clientes via SSE"""
    if cache["status_sistema"] == "desbloqueado":
        return jsonify({"message": "Turno já aberto"}), 200

    cache["status_sistema"] = "desbloqueado"
    notify_clients()
    return jsonify({"message": "Sistema desbloqueado com sucesso"}), 200

@cache_bp.route('/api/stream_status', methods=['GET'])
def stream_status():
    """Rota para enviar eventos SSE aos clientes somente quando houver alteração"""
    def event_stream():
        """Fica aguardando mudanças e envia ao cliente apenas quando houver alteração"""
        last_status = cache.get("status_sistema", "desbloqueado")
        
        while True:
            current_status = cache.get("status_sistema", "desbloqueado")
            if current_status != last_status:  # Só envia evento quando o status mudar
                yield f"data: {current_status}\n\n"
                last_status = current_status  # Atualiza o status monitorado
            time.sleep(1)  # Atraso para evitar sobrecarga no servidor

    return Response(event_stream(), content_type='text/event-stream')

def notify_clients():
    """Notifica todos os clientes aguardando mudança"""
    for client in clients:
        client.set()  # Isso pode liberar a thread ou sinalizar para o cliente

