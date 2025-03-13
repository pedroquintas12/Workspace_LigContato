# Usa uma imagem oficial do Python
FROM python:3.10

# Instala dependências do sistema necessárias para compilar pacotes Python nativos
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*  

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos necessários
COPY requirements.txt .

RUN pip install --upgrade pip

RUN pip install --no-cache-dir cryptography

# Instala as dependências
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o código para o contêiner
COPY . .

# Define o comando padrão ao iniciar o contêiner
CMD ["python", "main.py"]
