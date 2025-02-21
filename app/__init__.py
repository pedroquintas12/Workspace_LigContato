from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from config import config
from app.routes import main_bp
from app.routes_front import front_bp
from app.utils.cacheutitl import cache_bp  # Não há necessidade de passar socketio aqui

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, template_folder=config.TEMPLATE_FOLDER, static_folder=config.STATIC_FOLDER)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = config.SQLALCHEMY_DATABASE_URI
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = config.SQLALCHEMY_TRACK_MODIFICATIONS
    
    # Inicializa extensões
    db.init_app(app)
    Migrate(app, db)  # Inicializa Flask-Migrate

    # Registra os blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(front_bp)
    app.register_blueprint(cache_bp)
    app.secret_key = config.SECRET_TOKEN

    # Inicializa o SocketIO aqui
    socketio = SocketIO(app, cors_allowed_origins="*")
    
    return app
