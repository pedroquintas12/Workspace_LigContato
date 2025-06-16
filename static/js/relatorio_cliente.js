import { fetchWithAuth } from './auth.js';

function showSpinner() {
    document.getElementById("loading-overlay").style.display = "block";
}

function hideSpinner() {
    document.getElementById("loading-overlay").style.display = "none";
}

document.addEventListener('DOMContentLoaded', () => {
  const gerarRelatorioBtn = document.getElementById('GerarRelatorio');

  gerarRelatorioBtn.addEventListener('click', () => {
    const codigoEscritorio = document.getElementById('EscritorioSelect').value;
    if (!codigoEscritorio) {
      Swal.fire('Aviso', 'Por favor, digite o código do escritório.', 'warning');
      return;
    }
    showSpinner();

    fetchWithAuth('/api/gerarRelatorioNomes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ escritorio: codigoEscritorio })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.error || 'Erro ao gerar relatório') });
      }
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_escritorio_${codigoEscritorio}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire('Sucesso', 'Relatório gerado com sucesso!', 'success');
    })
    .catch(error => {
      console.error('Erro:', error);
      Swal.fire('Erro', error.message, 'error');
    })
    .finally(() => {
      hideSpinner();
    });
  });
  
});
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