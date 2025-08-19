import sql from '../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { tipo } = req.query;

    if (tipo === 'eletivas') {
      const eletivas = await sql`
        SELECT 
          e.id,
          e.title,
          e.limit,
          COUNT(i.id) as inscritos,
          (e.limit - COUNT(i.id)) as vagas_disponiveis,
          CASE WHEN COUNT(i.id) >= e.limit THEN true ELSE false END as lotada
        FROM eletivas e
        LEFT JOIN inscricoes i ON e.id = i.eletiva
        GROUP BY e.id, e.title, e.limit
        ORDER BY e.title
      `;
      
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        eletivas: eletivas.map(e => ({
          ...e,
          inscritos: parseInt(e.inscritos || 0),
          limit: parseInt(e.limit || 0),
          vagas_disponiveis: parseInt(e.vagas_disponiveis || 0)
        }))
      });
    }

    const totalInscricoes = await sql`SELECT COUNT(*) FROM inscricoes`;
    const totalEletivas = await sql`SELECT COUNT(*) FROM eletivas`;
    const eletivasLotadas = await sql`
      SELECT COUNT(*) as total FROM (
        SELECT e.id, e.limit, COUNT(i.id) as inscritos
        FROM eletivas e LEFT JOIN inscricoes i ON e.id = i.eletiva
        GROUP BY e.id, e.limit HAVING COUNT(i.id) >= e.limit
      ) as lotadas
    `;

    res.status(200).json({
      timestamp: new Date().toISOString(),
      totais: {
        inscricoes: parseInt(totalInscricoes[0]?.count || 0),
        eletivas: parseInt(totalEletivas[0]?.count || 0),
        eletivas_lotadas: parseInt(eletivasLotadas[0]?.total || 0)
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
