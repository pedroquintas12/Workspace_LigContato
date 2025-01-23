from threading import Thread
from flask import Flask
from flask_cors import CORS
from config import config
from app.routes import main_bp




def create_app():

    app = Flask(__name__, template_folder= config.TEMPLATE_FOLDER, static_folder= config.STATIC_FOLDER)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    app.register_blueprint(main_bp)

    app.secret_key = config.SECRET_TOKEN

    return app