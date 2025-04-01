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

                const diariosContainer = document.getElementById('diarios-container');
                diariosContainer.innerHTML = '';  // Limpa os checkboxes existentes

                diariosContainer.style.height = '200px';  // Defina a altura que você achar apropriada
                diariosContainer.style.overflowY = 'auto';  // Habilita a rolagem vertical
                
                Object.values(data).forEach(diarios => {
                    diarios.forEach(diario => {
                        const checkboxDiv = document.createElement('div');
                        checkboxDiv.classList.add('form-check');
                        checkboxDiv.innerHTML = `
                            <input class="form-check-input" type="checkbox" id="${diario}" value="${diario}">
                            <label class="form-check-label" for="${diario}">${diario}</label>
                        `;
                        diariosContainer.appendChild(checkboxDiv);
                    });
                });
                document.getElementById('complementoCheckbox').checked = false;
            } catch (error) {
                console.error('Erro ao buscar os diários:', error);
            }
        }
};
window.adicionar = async function() {
    const estadosSelecionados = document.getElementById('estados').value;
    const diariosSelecionados = Array.from(document.querySelectorAll('#diarios-container input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    const complementoMarcado = document.getElementById('complementoCheckbox').checked;
    const dataPublicacao = document.getElementById('dataComplemento').value;

    const data = {
        estado: estadosSelecionados,
        diarios: diariosSelecionados,
        complemento: complementoMarcado,
        data_publicacao: dataPublicacao
    };

    try {
        // **Verificação prévia se a ação já existe**
        const checkResponse = await fetchWithAuth('/api/actions/verificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const checkResult = await checkResponse.json();

        if (checkResult.exists) {
            // **Formatar os diários já lidos em negrito**
            const diariosLidosHtml = checkResult.diarios_existentes
                .map(diario => `<b>${diario}</b>`)
                .join(', '); // Converte em HTML com negrito

            // **Se a ação já existir, perguntar se deseja continuar**
            const confirmacao = await Swal.fire({
                icon: 'warning',
                title: 'Ação já registrada!',
                html: `Os seguintes diários já foram lidos para a data de publicação escolhida: ${diariosLidosHtml}.<br><br>Deseja continuar mesmo assim?`,
                showCancelButton: true,
                confirmButtonText: 'Sim, continuar',
                cancelButtonText: 'Cancelar'
            });

            if (!confirmacao.isConfirmed) {
                return; // Se o usuário cancelar, interrompe o processo
            }
        }

        // **Se não existir ou se o usuário confirmar, prossegue com o envio**
        const response = await fetchWithAuth('/api/actions/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                title: 'Erro!',
                text: result.error || 'Erro desconhecido.',
            });
        }
    } catch (err) {
        console.error('Erro ao enviar os dados:', err);
    }
};



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
        const response = await fetchWithAuth('/api/user/actions');
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
    let dados = []; // Armazena os dados recebidos da API
    let ordemAtual = {}; // Guarda a ordem de cada coluna
    reiniciarTemporizadorInatividade();
    iniciarStreamStatus();
    atualizarUserActions();
    iniciarStreamEstados();

    eventSource.onmessage = event => {
        dados = JSON.parse(event.data);
        renderizarTabela(dados);
        console.log(dados);
    };

    function renderizarTabela(data) {
        streamTableBody.innerHTML = data.map(action => {
            const status = action.fim ? action.fim : "Em andamento";
            const complementoCheckbox = `<input type="checkbox" class="form-check-input" ${action.complemento ? "checked" : ""} disabled>`;

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
    }

    document.querySelectorAll("th.sortable").forEach(header => {
        header.addEventListener("click", () => {
            const coluna = header.dataset.column;
            ordenarTabela(coluna, header);
        });
    });

    function ordenarTabela(coluna, header) {
        const ordem = ordemAtual[coluna] === "asc" ? "desc" : "asc";
        ordemAtual[coluna] = ordem;

        dados.sort((a, b) => {
            let valA = a[coluna];
            let valB = b[coluna];

            if (coluna === "data_publicacao") {
                valA = (a[coluna] || "1970-01-01"); // Default caso esteja vazio
                valB = (b[coluna] || "1970-01-01");
            }

            if (typeof valA === "number" && typeof valB === "number") {
                return ordem === "asc" ? valA - valB : valB - valA;
            } else if (valA instanceof Date && valB instanceof Date) {
                return ordem === "asc" ? valA - valB : valB - valA;
            } else {
                return ordem === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        });

        atualizarSetas(coluna, ordem);
        renderizarTabela(dados);
    }

    function atualizarSetas(coluna, ordem) {
        document.querySelectorAll("th.sortable span").forEach(span => {
            span.textContent = "";
        });

        const header = document.querySelector(`th[data-column="${coluna}"] span`);
        header.textContent = ordem === "asc" ? " 🔼" : " 🔽";
    }

});



function iniciarStreamEstados() {
    const streamTableBody = document.getElementById("state-table-body");
    const eventSource = new EventSource("/api/actions/stream_estados");

    eventSource.onmessage = event => {
        const data = JSON.parse(event.data);
        streamTableBody.innerHTML = data.map(action => {

            return `
                <tr>
                    <td>${action.username}</td>
                    <td>${action.estado}</td>
                </tr>
            `;
        }).join("");
    };
}

let fechandoTurno = false; // Variável de controle

// Função para verificar o status do sistema usando SSE
function iniciarStreamStatus() {
    const eventSource = new EventSource('/api/stream_status');
    eventSource.onmessage = function(event) {
        const status = event.data;

        if (status === 'bloqueado') {
            fechandoTurno = true; 

            Swal.fire({
                icon: 'error',
                title: 'Turno sendo fechado',
                text: 'O sistema está bloqueado. Você não pode realizar nenhuma ação neste momento.',
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    if (USER_DATA.role == 'ADM') {
                        const btn = document.createElement('button');
                        btn.textContent = 'Reabrir Turno';
                        btn.classList.add('btn', 'btn-primary', 'mt-3');
                        btn.style.width = 'auto'; // Pode ser alterado para um tamanho fixo como '150px'
                        btn.style.margin='0 auto';
                        btn.style.display = 'block'
                        btn.onclick = desbloquearAcesso;
                        Swal.getPopup().appendChild(btn);
                    }
                }
            });
        } else {
            fechandoTurno = false; 
            Swal.close();
        }
    };

    eventSource.onerror = function(error) {
        console.error("Erro no stream:", error);
        eventSource.close();
    };
}

let inatividadeTimeout;
let inatividadeStartTime;
let inatividadeMensagemStartTime;
let inatividadeContador = 0;

function exibirMensagemInatividade() {
    if (fechandoTurno) return; // Não exibir a mensagem se o turno estiver sendo fechado

    Swal.fire({
        icon: 'warning',
        title: 'Você ainda está aí?',
        text: 'Você ficou inativo por muito tempo! Deseja continuar?',
        showConfirmButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false        
    }).then(() => {
        const tempoConfirmacao = (Date.now() - inatividadeMensagemStartTime) / 1000 / 60;

        if (tempoConfirmacao >= 5) {
            salvarInatividade(tempoConfirmacao);
        }

        reiniciarTemporizadorInatividade();
    });

    inatividadeMensagemStartTime = Date.now();
}

function reiniciarTemporizadorInatividade() {
    clearTimeout(inatividadeTimeout);
    inatividadeStartTime = Date.now();
    inatividadeTimeout = setTimeout(exibirMensagemInatividade, 5 * 60000);
}

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


async function desbloquearAcesso() {
    try {
        const response =  await fetchWithAuth('/api/desbloquear_acesso', {
            method: 'GET',
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
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: result.message,
            });
        }
    } catch (err) {
        console.error('Erro ao desbloquear o acesso:', err);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'Erro ao enviar a requisição. Tente novamente.',
        });
    }
}

document.addEventListener("mousemove", reiniciarTemporizadorInatividade);
document.addEventListener("keydown", reiniciarTemporizadorInatividade);
document.addEventListener("click", reiniciarTemporizadorInatividade);
