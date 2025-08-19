import sql from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (req.method === 'PUT') {
    try {
      const { limit } = req.body;
      
      if (isNaN(limit) || limit < 0) {
        return res.status(400).json({ error: 'Limite inválido' });
      }
      
      const result = await sql`
        UPDATE eletivas SET limit = ${parseInt(limit)} WHERE id = ${id} RETURNING *
      `;
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Eletiva não encontrada' });
      }
      
      return res.status(200).json(result[0]);
    } catch (error) {
      console.error('Erro ao atualizar eletiva:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
  
  return res.status(405).json({ error: 'Método não permitido' });
}
