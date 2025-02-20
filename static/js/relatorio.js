function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}

function formatElapsedTime(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) {
        return "N/A";
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours}h ${minutes}m ${secs}s`;
}

function convertInactivityTime(minutesDecimal) {
    if (minutesDecimal === null || minutesDecimal === undefined || isNaN(minutesDecimal)) {
        return "N/A";
    }
    const minutes = Math.floor(minutesDecimal);
    const seconds = Math.round((minutesDecimal - minutes) * 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

document.addEventListener('DOMContentLoaded', async function () {
    const userSelect = document.getElementById('UserSelect');
    const userInfo = document.getElementById('UserInfo');
    const buscarBtn = document.getElementById('BuscarDados');
    const previousPageBtn = document.getElementById('previousPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const togglBtn = document.getElementById('toggle-btn');

    togglBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });

    let currentPage = 1;
    let totalPages = 1;

    // Carregar lista de usuários
    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        userSelect.innerHTML = '<option value="">Selecione um usuário</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        Swal.fire({ icon: 'error', title: 'Erro!', text: 'Não foi possível carregar os usuários.' });
    }

    // Função para buscar os dados do usuário com paginação
    async function fetchUserData(page) {
        const selectedUser = userSelect.value.trim();
        const dataInicio = document.getElementById("DataInicio").value;
        const dataFim = document.getElementById("DataFim").value;

        if (!selectedUser) {
            Swal.fire("Erro", "Por favor, selecione um usuário.", "error");
            return;
        }

        userInfo.innerHTML = '<div class="text-center mt-3"><span class="spinner-border text-primary"></span> Carregando...</div>';

        let url = `/api/search?FUNC=${encodeURIComponent(selectedUser)}&pagina=${page}`;
        if (dataInicio && dataFim) {
            url += `&DATA_INICIO=${encodeURIComponent(dataInicio)}&DATA_FIM=${encodeURIComponent(dataFim)}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                Swal.fire({ icon: 'error', title: 'Erro!', text: data.error });
                userInfo.innerHTML = '';
                return;
            }

            // Atualiza a UI com os logs e a paginação
            let html = `
                <div id="UserInfoIntro">
                    <h2 class="text-center">Informações do Usuário</h2>
                    <div class="card mt-4 shadow">
                        <div class="card-header bg-primary text-white"><strong>Usuário: ${data.username}</strong></div>
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item"><i class="material-icons">person</i> <strong>ID:</strong> ${data.ID_auth}</li>
                                <li class="list-group-item"><i class="material-icons">login</i> <strong>Último Login:</strong> ${data.last_login || 'N/A'}</li>
                                <li class="list-group-item"><i class="material-icons">logout</i> <strong>Último Logout:</strong> ${data.last_logout || 'N/A'}</li>
                                <li class="list-group-item"><i class="material-icons">timer</i> <strong>Tempo Total sem leitura:</strong> ${convertInactivityTime(data.tempo_sem_leitura.tempo_inatividade)}</li>
                                <li class="list-group-item"><i class="material-icons">timer</i> <strong>Tempo Total de inatividade:</strong> ${convertInactivityTime(data.tempo_total_inativo.tempo_inatividade)}</li>
                            </ul>
                        </div>
                    </div>
            `;

            if (data.logs.length > 0) {
                html += `<h2 class="text-center text-secondary mt-4">Logs de Atividade</h2>`;

                data.logs.forEach((log, index) => {
                    const complementoCheckbox = `<input type="checkbox" class="form-check-input" ${log.complemento ? "checked" : ""} disabled>`;
                    const status = log.fim ? log.fim : "Em andamento";
                    html += `
                        <div class="card mt-3 shadow">
                            <div class="card-header bg-secondary text-white" data-bs-toggle="collapse" data-bs-target="#log-${index}" style="cursor: pointer;">
                                <strong>Log ID: ${log.ID_log || 'N/A'}</strong> <span class="float-end">Clique para expandir</span>
                            </div>
                            <div id="log-${index}" class="collapse">
                                <div class="card-body">
                                    <ul class="list-group list-group-flush">
                                        <li class="list-group-item"><strong>Estado:</strong> ${log.estado}</li>
                                        <li class="list-group-item"><strong>Diário:</strong> ${log.diario}</li>
                                        <li class="list-group-item"><strong>Complemento:</strong> ${complementoCheckbox}</li>
                                        <li class="list-group-item"><strong>Status:</strong> ${getStatusBadge(log.status)}</li>
                                        <li class="list-group-item"><strong>Início:</strong> ${log.inicio || 'N/A'}</li>
                                        <li class="list-group-item"><strong>Fim:</strong> ${getStatusBadge(status)}</li>
                                        <li class="list-group-item"><strong>Tempo decorrido:</strong> ${formatElapsedTime(log.tempo_decorrido)}
                                        <li class="list-group-item"><strong>Tempo de Inatividade:</strong></li>
                                        <ul class="list-group">
                                            ${log.inatividade.length > 0 ? 
                                                log.inatividade.map(inat => `<li class="list-group-item">${inat.data}: ${inat.tempo_inatividade} minutos</li>`).join('') : 
                                                '<li class="list-group-item">Sem registros</li>'
                                            }
                                        </ul>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            userInfo.innerHTML = html;

            // Atualiza informações de paginação
            totalPages = data.total_pages;
            currentPage = data.current_page;
            pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

            // Habilita ou desabilita os botões de navegação
            previousPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = currentPage === totalPages;

        } catch (error) {
            console.error('Erro ao buscar os dados:', error);
            Swal.fire("Erro", "Falha na comunicação com o servidor.", "error");
            userInfo.innerHTML = '';
        }
    }

    // Ação ao clicar no botão "Buscar"
    buscarBtn.addEventListener('click', function () {
        fetchUserData(currentPage);
    });

    // Ação ao clicar em "Anterior"
    previousPageBtn.addEventListener('click', function () {
        if (currentPage > 1) {
            fetchUserData(currentPage - 1);
        }
    });

    // Ação ao clicar em "Próxima"
    nextPageBtn.addEventListener('click', function () {
        if (currentPage < totalPages) {
            fetchUserData(currentPage + 1);
        }
    });
});