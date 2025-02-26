import { fetchWithAuth } from './auth.js';

function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}

window.atualizarDiarios = async function() {
    const estadosSelecionados = Array.from(document.getElementById('estados').selectedOptions)
            .map(option => option.value)
            .join(',');

        if (estadosSelecionados) {
            try {
                const response = await fetchWithAuth(`/api/diarios?publicationsState=${estadosSelecionados}`);
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
    };


    window.adicionar = async function() {
        const estadosSelecionados = document.getElementById('estados').value;
        const diariosSelecionados = Array.from(document.getElementById('diarios').selectedOptions).map(option => option.value);
        const complementoMarcado = document.getElementById('complementoCheckbox').checked;
        const dataPublicacao = document.getElementById('dataComplemento').value;
    
        const data = {
            estado : estadosSelecionados,
            diarios : diariosSelecionados,  // Agora vai enviar um objeto com os estados e diários agrupados
            complemento: complementoMarcado,
            data_publicacao: dataPublicacao
        };

        try {
            const response = await fetchWithAuth('/api/actions/registrar', {
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
        }
    }
    
    window.finalizarAcao = async function(id) {
        try {
            const response = await fetchWithAuth(`/api/actions/finalizar/${id}`, { method: 'PUT' });
    
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
        }
    }
    async function atualizarUserActions() {
        try {
            const response = await fetchWithAuth('/api/user/actions'); // Endpoint para obter as ações do usuário
            const data = await response.json();

            const userActions = document.getElementById('user-actions');
            userActions.innerHTML = data.map(action => `
                <div class="mb-3 p-2 border rounded">
                    <p><strong>Estado:</strong> ${action.estado}</p>
                    <p><strong>Diário:</strong> ${action.diario}</p>
                    <td  style="text-align: center; vertical-align: middle;">
                       <strong>Complemento </strong> <input class="form-check-input" type="checkbox" ${action.complemento ? "checked" : ""} disabled>
                    </td>
                    <button class="btn btn-sm btn-success w-100" onclick="finalizarAcao(${action.ID_log})">Finalizar</button>
                </div>
            `).join('');
        } catch (err) {
            console.error('Erro ao buscar as ações do usuário:', err);
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
            reiniciarTemporizadorInatividade();
            iniciarStreamStatus();
            atualizarUserActions();

        
            eventSource.onmessage = event => {
                const data = JSON.parse(event.data);
                streamTableBody.innerHTML = data.map(action => {
                    const status = action.fim ? action.fim : "Em andamento";
        
                    // Renderiza o checkbox com base no valor de complemento
                    const complementoCheckbox = `
                        <input type="checkbox" class="form-check-input"${action.complemento ? "checked" : ""} disabled>
                    `;
        
                    return `
                        <tr>
                            <td>${action.username}</td>
                            <td>${action.estado}</td>
                            <td>${action.diario}</td>
                            <td>${complementoCheckbox}</td>
                            <td>${action.data_publicacao}</td>
                            <td>${getStatusBadge(action.status)}</td>
                        </tr>
                    `;
                }).join("");
            };
        });
        

    


// Função para verificar o status do sistema usando SSE
function iniciarStreamStatus() {
    const eventSource = new EventSource('/api/stream_status');
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
        title: 'Você ainda está aí?',
        text: 'Você ficou inativo por muito tempo! Deseja continuar?',
        showConfirmButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false        
    }).then(() => {
        // Calcula o tempo que levou para clicar em "OK"
        const tempoConfirmacao = (Date.now() - inatividadeMensagemStartTime) / 1000 / 60; // Em minutos

        // Verifica se o tempo foi igual ou maior que 5 minutos
        if (tempoConfirmacao >= 5) {
            salvarInatividade(tempoConfirmacao);
        }

        // Reinicia o temporizador de inatividade após o usuário confirmar
        reiniciarTemporizadorInatividade();
    });

    // Salva o momento em que a mensagem foi exibida
    inatividadeMensagemStartTime = Date.now();
}

// Função para reiniciar o temporizador de inatividade
function reiniciarTemporizadorInatividade() {
    clearTimeout(inatividadeTimeout);
    inatividadeStartTime = Date.now();
    
    // Define um novo temporizador de 5 minutos para exibir a mensagem
    inatividadeTimeout = setTimeout(exibirMensagemInatividade, 5 * 60000);
}

// Função para enviar o tempo de inatividade para o servidor
async function salvarInatividade(totalInatividade) {
    try {
        const response = await fetchWithAuth('/api/salvar_inatividade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tempo_inatividade: totalInatividade,
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

// Adiciona eventos de interação do usuário para reiniciar o temporizador
document.addEventListener("mousemove", reiniciarTemporizadorInatividade);
document.addEventListener("keydown", reiniciarTemporizadorInatividade);
document.addEventListener("click", reiniciarTemporizadorInatividade);
