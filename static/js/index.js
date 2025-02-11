
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
        const status = document.getElementById('status').value;

        const data = {
            estado: estado.join(','), 
            diario: diario.join(','), 
            status: status
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
                    title: 'Erro ao Adicionar',
                    text: result.message || 'Erro desconhecido.',
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