

function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}
    async function atualizarDiarios() {
        const estadosSelecionados = Array.from(document.getElementById('estados').selectedOptions)
            .map(option => option.value)
            .join(',');

        if (estadosSelecionados) {
            try {
                const response = await fetch(`/api/diarios?publicationsState=${estadosSelecionados}`);
                const data = await response.json();

                const diariosSelect = document.getElementById('diarios');
                diariosSelect.innerHTML = '';

                Object.values(data).forEach(diarios => {
                    diarios.forEach(diario => {
                        const option = document.createElement('option');
                        option.value = diario;
                        option.textContent = diario;
                        diariosSelect.appendChild(option);
                    });
                });
            } catch (error) {
                console.error('Erro ao buscar os diários:', error);
            }
        }
    }

    async function adicionar() {
        const estado = Array.from(document.getElementById('estados').selectedOptions).map(option => option.value);
        const diario = Array.from(document.getElementById('diarios').selectedOptions).map(option => option.value);

        const data = {
            estado: estado.join(','), 
            diario: diario.join(',')
        };

        try {
            const response = await fetch('/api/actions/registrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: result.message,
                    showConfirmButton: false,
                    timer: 5000,
                    position: 'top-end',
                    toast: true,
                    background: '#28a745',
                });
                atualizarUserActions();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: result.status,
                    text: result.error || 'Erro desconhecido.',
                });
            }
        } catch (err) {
            console.error('Erro ao enviar os dados:', err);

            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao enviar os dados para o servidor.',
            });
        }
    }

    async function finalizarAcao(id) {
        try {
            const response = await fetch(`/api/actions/finalizar/${id}`, { method: 'PUT' });

            if (response.ok) {
                const result = await response.json();

                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: result.message,
                    showConfirmButton: false,
                    timer: 5000,
                    position: 'top-end',
                    toast: true,
                    background: '#28a745',
                });

                atualizarUserActions();
            } else {
                const error = await response.json();

                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao Finalizar',
                    text: error.message || 'Erro desconhecido.',
                });
            }
        } catch (err) {
            console.error('Erro ao finalizar a ação:', err);

            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao finalizar a ação. Tente novamente.',
            });
        }
    }

    async function atualizarUserActions() {
        try {
            const response = await fetch('/api/user/actions'); // Endpoint para obter as ações do usuário
            const data = await response.json();

            const userActions = document.getElementById('user-actions');
            userActions.innerHTML = data.map(action => `
                <div class="mb-3 p-2 border rounded">
                    <p><strong>Estado:</strong> ${action.estado}</p>
                    <p><strong>Diário:</strong> ${action.diario}</p>
                    <button class="btn btn-sm btn-success w-100" onclick="finalizarAcao(${action.ID_log})">Finalizar</button>
                </div>
            `).join('');
        } catch (err) {
            console.error('Erro ao buscar as ações do usuário:', err);

            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Não foi possível carregar as ações do usuário.',
            });
        }
    }

        document.addEventListener("DOMContentLoaded", () => {
            const sidebar = document.getElementById("sidebar");
            const mainContent = document.getElementById("main-content");
            const toggleButton = document.getElementById("toggle-btn");

            toggleButton.addEventListener("click", () => {
                sidebar.classList.toggle("collapsed");
                mainContent.classList.toggle("shifted");
            });
        });

    document.addEventListener("DOMContentLoaded", () => {
    const streamTableBody = document.getElementById("stream-table-body");

    const eventSource = new EventSource("/api/actions/stream");
    eventSource.onmessage = event => {
        const data = JSON.parse(event.data);
        streamTableBody.innerHTML = data.map(action => {
            const status = action.fim ? action.fim : "Em andamento";
            return `
                <tr>
                    <td>${action.ID_log}</td>
                    <td>${action.username}</td>
                    <td>${action.estado}</td>
                    <td>${action.diario}</td>
                    <td>${getStatusBadge(action.status)}</td>
                </tr>
            `;
        }).join("");
    };
});

document.addEventListener("DOMContentLoaded", () => {
    reiniciarTemporizadorInatividade();
    iniciarStreamStatus();
});


// Função para verificar o status do sistema usando SSE
function iniciarStreamStatus() {
    const eventSource = new EventSource('/api/stream_status');
    console.log("stream iniciado!")
    eventSource.onmessage = function(event) {
        const status = event.data;

        if (status === 'bloqueado') {
            Swal.fire({
                icon: 'error',
                title: 'Turno sendo fechado',
                text: 'O sistema está bloqueado. Você não pode realizar nenhuma ação neste momento.',
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false
            });
        } else {
            Swal.close();
        }
    };

    eventSource.onerror = function(error) {
        console.error("Erro no stream:", error);
        eventSource.close();
    };
}

let inatividadeTimeout;  // Variável para armazenar o temporizador de inatividade
let inatividadeStartTime;  // Hora de início da inatividade
let inatividadeMensagemStartTime;  // Hora de início da mensagem de inatividade
let inatividadeContador = 0;  // Contador de tempo após exibição da mensagem

// Função para exibir a mensagem de inatividade
function exibirMensagemInatividade() {
    Swal.fire({
        icon: 'warning',
        title: 'Sessão Expirada',
        text: 'Você ficou inativo por muito tempo. A sessão será encerrada.',
        showConfirmButton: false,
        timer: 5000,  // A mensagem ficará visível por 5 segundos
        background: '#ffc107',
    });

    // Inicia o contador de inatividade após a exibição da mensagem
    inatividadeMensagemStartTime = Date.now();
    
    // Aguardar mais 5 minutos após exibição da mensagem para salvar a inatividade no banco
    setTimeout(verificarInatividade, 300000);  // 5 minutos após exibição da mensagem
}

// Função para verificar o tempo de inatividade e salvar se necessário
async function verificarInatividade() {
    // Calcula o tempo total de inatividade desde a exibição da mensagem
    const tempoTotalInatividade = (Date.now() - inatividadeMensagemStartTime) / 1000 / 60;  // Em minutos

    if (tempoTotalInatividade >= 5) {
        // Envia o tempo de inatividade para o servidor para salvar no banco de dados
        salvarInatividade(tempoTotalInatividade);
    }
}

// Função para reiniciar o temporizador de inatividade
function reiniciarTemporizadorInatividade() {
    // Limpa o temporizador anterior, caso haja
    clearTimeout(inatividadeTimeout);

    // Atualiza o tempo de início da inatividade
    inatividadeStartTime = Date.now();

    // Define um novo temporizador de 1 minuto
    inatividadeTimeout = setTimeout(exibirMensagemInatividade, 60000);  // 60000 ms = 1 minuto
}

// Função para enviar o tempo de inatividade para o servidor
async function salvarInatividade(totalInatividade) {
    try {
        const response = await fetch('/api/salvar_inatividade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tempo_inatividade: totalInatividade,  // Tempo de inatividade em minutos
            }),
        });

        if (response.ok) {
            console.log('Tempo de inatividade salvo com sucesso.');
        } else {
            console.error('Erro ao salvar o tempo de inatividade.');
        }
    } catch (error) {
        console.error('Erro de rede ao salvar o tempo de inatividade:', error);
    }
}

// Adiciona eventos de interação do usuário (mouse, teclado, etc)
document.addEventListener("mousemove", reiniciarTemporizadorInatividade);
document.addEventListener("keydown", reiniciarTemporizadorInatividade);
document.addEventListener("click", reiniciarTemporizadorInatividade);

