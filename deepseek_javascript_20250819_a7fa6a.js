// Carregar estatísticas gerais
async function carregarEstatisticas() {
  try {
    const response = await fetch('/api/estatisticas');
    const data = await response.json();
    console.log('Estatísticas:', data);
  } catch (error) {
    console.error('Erro:', error);
  }
}

// Carregar estatísticas por eletiva
async function carregarEstatisticasEletivas() {
  try {
    const response = await fetch('/api/estatisticas?tipo=eletivas');
    const data = await response.json();
    console.log('Estatísticas por eletiva:', data);
  } catch (error) {
    console.error('Erro:', error);
  }
}