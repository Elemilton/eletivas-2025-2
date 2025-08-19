import sql from '../../lib/db';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['GET', 'OPTIONS']
    });
  }

  try {
    const { tipo, eletiva } = req.query;

    // Estatísticas gerais (padrão)
    if (!tipo) {
      const estatisticas = await getEstatisticasGerais();
      return res.status(200).json(estatisticas);
    }

    // Estatísticas específicas por tipo
    switch (tipo) {
      case 'geral':
        const estatisticasGerais = await getEstatisticasGerais();
        return res.status(200).json(estatisticasGerais);

      case 'eletivas':
        const estatisticasEletivas = await getEstatisticasPorEletiva();
        return res.status(200).json(estatisticasEletivas);

      case 'turmas':
        const estatisticasTurmas = await getEstatisticasPorTurma();
        return res.status(200).json(estatisticasTurmas);

      case 'evolucao':
        const evolucao = await getEvolucaoTemporal();
        return res.status(200).json(evolucao);

      case 'eletiva':
        if (!eletiva) {
          return res.status(400).json({ error: 'Parâmetro "eletiva" é obrigatório' });
        }
        const statsEletiva = await getEstatisticasEletivaEspecifica(eletiva);
        return res.status(200).json(statsEletiva);

      default:
        return res.status(400).json({ 
          error: 'Tipo de estatística inválido',
          tipos_validos: ['geral', 'eletivas', 'turmas', 'evolucao', 'eletiva']
        });
    }

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({ 
      error: 'Erro interno ao gerar estatísticas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Estatísticas gerais
async function getEstatisticasGerais() {
  try {
    // Total de inscrições
    const totalInscricoes = await sql`
      SELECT COUNT(*) as total FROM inscricoes
    `;

    // Total de eletivas
    const totalEletivas = await sql`
      SELECT COUNT(*) as total FROM eletivas
    `;

    // Eletivas com vagas esgotadas
    const eletivasLotadas = await sql`
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          e.id,
          e.limit,
          COUNT(i.id) as inscritos
        FROM eletivas e
        LEFT JOIN inscricoes i ON e.id = i.eletiva
        GROUP BY e.id, e.limit
        HAVING COUNT(i.id) >= e.limit
      ) as lotadas
    `;

    // Taxa de ocupação geral
    const ocupacaoGeral = await sql`
      SELECT 
        SUM(e.limit) as total_vagas,
        COUNT(i.id) as total_inscritos,
        ROUND((COUNT(i.id) * 100.0 / NULLIF(SUM(e.limit), 0)) as taxa_ocupacao
      FROM eletivas e
      LEFT JOIN inscricoes i ON e.id = i.eletiva
    `;

    // Últimas inscrições (24 horas)
    const inscricoesRecentes = await sql`
      SELECT COUNT(*) as ultimas_24h
      FROM inscricoes 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;

    return {
      timestamp: new Date().toISOString(),
      totais: {
        inscricoes: parseInt(totalInscricoes[0]?.total || 0),
        eletivas: parseInt(totalEletivas[0]?.total || 0),
        eletivas_lotadas: parseInt(eletivasLotadas[0]?.total || 0)
      },
      ocupacao: {
        total_vagas: parseInt(ocupacaoGeral[0]?.total_vagas || 0),
        total_inscritos: parseInt(ocupacaoGeral[0]?.total_inscritos || 0),
        taxa_ocupacao: parseFloat(ocupacaoGeral[0]?.taxa_ocupacao || 0),
        vagas_disponiveis: parseInt(ocupacaoGeral[0]?.total_vagas || 0) - parseInt(ocupacaoGeral[0]?.total_inscritos || 0)
      },
      recente: {
        ultimas_24h: parseInt(inscricoesRecentes[0]?.ultimas_24h || 0)
      }
    };

  } catch (error) {
    console.error('Erro em getEstatisticasGerais:', error);
    throw error;
  }
}

// Estatísticas por eletiva
async function getEstatisticasPorEletiva() {
  try {
    const eletivas = await sql`
      SELECT 
        e.id,
        e.title,
        e.limit,
        COUNT(i.id) as inscritos,
        (e.limit - COUNT(i.id)) as vagas_disponiveis,
        CASE 
          WHEN COUNT(i.id) >= e.limit THEN true
          ELSE false
        END as lotada,
        ROUND(
          CASE 
            WHEN e.limit > 0 THEN (COUNT(i.id) * 100.0 / e.limit)
            ELSE 0
          END, 2
        ) as percentual_ocupacao,
        MIN(i.created_at) as primeira_inscricao,
        MAX(i.created_at) as ultima_inscricao
      FROM eletivas e
      LEFT JOIN inscricoes i ON e.id = i.eletiva
      GROUP BY e.id, e.title, e.limit
      ORDER BY e.title
    `;

    return {
      timestamp: new Date().toISOString(),
      total_eletivas: eletivas.length,
      eletivas: eletivas.map(eletiva => ({
        ...eletiva,
        inscritos: parseInt(eletiva.inscritos || 0),
        limit: parseInt(eletiva.limit || 0),
        vagas_disponiveis: parseInt(eletiva.vagas_disponiveis || 0),
        percentual_ocupacao: parseFloat(eletiva.percentual_ocupacao || 0)
      }))
    };

  } catch (error) {
    console.error('Erro em getEstatisticasPorEletiva:', error);
    throw error;
  }
}

// Estatísticas por turma
async function getEstatisticasPorTurma() {
  try {
    const turmas = await sql`
      SELECT 
        turma,
        COUNT(*) as total_inscritos,
        COUNT(DISTINCT eletiva) as eletivas_diferentes,
        ARRAY_AGG(DISTINCT eletiva_nome) as eletivas,
        MIN(created_at) as primeira_inscricao,
        MAX(created_at) as ultima_inscricao
      FROM inscricoes
      GROUP BY turma
      ORDER BY turma
    `;

    const totalGeral = await sql`
      SELECT COUNT(*) as total FROM inscricoes
    `;

    return {
      timestamp: new Date().toISOString(),
      total_geral: parseInt(totalGeral[0]?.total || 0),
      total_turmas: turmas.length,
      turmas: turmas.map(turma => ({
        turma: turma.turma,
        total_inscritos: parseInt(turma.total_inscritos || 0),
        eletivas_diferentes: parseInt(turma.eletivas_diferentes || 0),
        percentual_total: turma.total_inscritos > 0 ? 
          Math.round((turma.total_inscritos / parseInt(totalGeral[0]?.total || 1)) * 100) : 0,
        primeira_inscricao: turma.primeira_inscricao,
        ultima_inscricao: turma.ultima_inscricao
      }))
    };

  } catch (error) {
    console.error('Erro em getEstatisticasPorTurma:', error);
    throw error;
  }
}

// Evolução temporal das inscrições
async function getEvolucaoTemporal() {
  try {
    // Inscrições por dia (últimos 30 dias)
    const evolucaoDiaria = await sql`
      SELECT 
        DATE(created_at) as data,
        COUNT(*) as inscricoes
      FROM inscricoes
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY data
    `;

    // Inscrições por hora (últimas 24 horas)
    const evolucaoHoraria = await sql`
      SELECT 
        DATE_TRUNC('hour', created_at) as hora,
        COUNT(*) as inscricoes
      FROM inscricoes
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hora
    `;

    // Total acumulado ao longo do tempo
    const acumulado = await sql`
      SELECT 
        DATE(created_at) as data,
        COUNT(*) OVER (ORDER BY DATE(created_at)) as acumulado
      FROM inscricoes
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), id
      ORDER BY data
    `;

    return {
      timestamp: new Date().toISOString(),
      periodo: '30_dias',
      diario: evolucaoDiaria.map(item => ({
        data: item.data,
        inscricoes: parseInt(item.inscricoes || 0)
      })),
      horario: evolucaoHoraria.map(item => ({
        hora: item.hora,
        inscricoes: parseInt(item.inscricoes || 0)
      })),
      acumulado: acumulado.reduce((acc, item) => {
        if (!acc.find(i => i.data === item.data)) {
          acc.push({ data: item.data, acumulado: parseInt(item.acumulado || 0) });
        }
        return acc;
      }, [])
    };

  } catch (error) {
    console.error('Erro em getEvolucaoTemporal:', error);
    throw error;
  }
}

// Estatísticas específicas de uma eletiva
async function getEstatisticasEletivaEspecifica(eletivaId) {
  try {
    // Dados da eletiva
    const eletivaData = await sql`
      SELECT * FROM eletivas WHERE id = ${eletivaId}
    `;

    if (eletivaData.length === 0) {
      throw new Error('Eletiva não encontrada');
    }

    // Inscrições da eletiva
    const inscricoesEletiva = await sql`
      SELECT * FROM inscricoes WHERE eletiva = ${eletivaId}
      ORDER BY created_at DESC
    `;

    // Distribuição por turma
    const porTurma = await sql`
      SELECT 
        turma,
        COUNT(*) as total,
        MIN(created_at) as primeira_inscricao,
        MAX(created_at) as ultima_inscricao
      FROM inscricoes
      WHERE eletiva = ${eletivaId}
      GROUP BY turma
      ORDER BY total DESC
    `;

    // Evolução temporal da eletiva
    const evolucao = await sql`
      SELECT 
        DATE(created_at) as data,
        COUNT(*) as inscricoes
      FROM inscricoes
      WHERE eletiva = ${eletivaId}
      GROUP BY DATE(created_at)
      ORDER BY data
    `;

    return {
      timestamp: new Date().toISOString(),
      eletiva: {
        ...eletivaData[0],
        limit: parseInt(eletivaData[0].limit || 0)
      },
      inscricoes: {
        total: inscricoesEletiva.length,
        por_turma: porTurma.map(turma => ({
          turma: turma.turma,
          total: parseInt(turma.total || 0),
          percentual: Math.round((turma.total / inscricoesEletiva.length) * 100)
        })),
        evolucao: evolucao.map(item => ({
          data: item.data,
          inscricoes: parseInt(item.inscricoes || 0)
        })),
        vagas_disponiveis: parseInt(eletivaData[0].limit || 0) - inscricoesEletiva.length,
        percentual_ocupacao: Math.round((inscricoesEletiva.length / parseInt(eletivaData[0].limit || 1)) * 100)
      },
      ultimas_inscricoes: inscricoesEletiva.slice(0, 10) // Últimas 10 inscrições
    };

  } catch (error) {
    console.error('Erro em getEstatisticasEletivaEspecifica:', error);
    throw error;
  }
}
