function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}

function getStatuslogin(status) {
    if (status === "L") return '<span class="badge bg-success">LOGADO</span>';
    if (status === "N") return '<span class="badge bg-danger">DESLOGADO</span>';
    return status;
}

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("user-table-body");
    const errorMessage = document.getElementById("error-message");
    const loadingSpinner = document.getElementById("loading-spinner");

    // Exibir o carregamento
    loadingSpinner.classList.remove("d-none");

    fetch("/api/users", {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Erro ao carregar os dados: " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        tableBody.innerHTML = "";
        data.forEach(user => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.last_login || "N/A"}</td>
                <td>${getStatuslogin(user.status_logado) || "N/A"}</td>
                <td>${user.ultima_acao.estado || "N/A"}</td>
                <td>${user.ultima_acao.diario || "N/A"}</td>
                <td>${getStatusBadge(user.ultima_acao.status) || "N/A"}</td>
                <td>${user.ultima_acao.inicio_leitura || "N/A"}</td>
            `;

            // Adiciona evento de clique para buscar histórico
            row.addEventListener("click", () => {
                fetch(`/api/users/${user.ID_auth}/history`)
                    .then(response => response.json())
                    .then(historyData => {
                        showUserHistory(user.username, historyData);
                    })
                    .catch(error => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Erro ao puxar histórico',
                            text: error.message,
                            showConfirmButton: true,
                        });
                    });
            });

            tableBody.appendChild(row);
        });

        // Esconde o spinner de carregamento
        loadingSpinner.classList.add("d-none");
    })
    .catch(error => {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove("d-none");
        loadingSpinner.classList.add("d-none");
    });
});

function showUserHistory(username, historyData) {
    // Cria o cabeçalho da tabela
    let historyHtml = `
        <table class="table table-bordered table-striped">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Ação</th>
                    <th>Tempo Inativo</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Se não houver dados, exibe mensagem de "Sem histórico"
    if (historyData.length === 0) {
        historyHtml += "<tr><td colspan='3'>Sem histórico disponível.</td></tr>";
    } else {
        // Adiciona as entradas do histórico na tabela
        historyData.forEach(entry => {
            historyHtml += `
                <tr>
                    <td>${entry.timestamp}</td>
                    <td>${entry.acao}</td>
                    <td>${entry.tempo_inativo || "N/A"}</td>
                </tr>
            `;
        });
    }

    // Finaliza a tabela
    historyHtml += "</tbody></table>";

    // Exibe o histórico em um Swal com a tabela
    Swal.fire({
        title: `Histórico de ${username}`,
        html: historyHtml,
        icon: 'info',
        confirmButtonText: 'Fechar',
        showCloseButton: true,
        width: '80%',
        padding: '20px',
        customClass: {
            popup: 'swal-popup-history'
        }
    });
}



// Controle da sidebar
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const toggleButton = document.getElementById("toggle-btn");

    toggleButton.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });
});
