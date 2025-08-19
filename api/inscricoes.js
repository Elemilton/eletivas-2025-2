import sql from '../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS eletivas (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        limit INTEGER DEFAULT 28,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inscricoes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        turma VARCHAR(10) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL,
        eletiva VARCHAR(50) NOT NULL,
        eletiva_nome VARCHAR(100) NOT NULL,
        data TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    const eletivasCount = await sql`SELECT COUNT(*) FROM eletivas`;
    if (eletivasCount[0]?.count === '0') {
      const defaultEletivas = [
        ['arte-sustentavel', 'Arte Sustentável', 28],
        ['artistas-historia', 'Artistas que Marcaram a História da Arte', 28],
        ['biq-games', 'BiQ Games', 28],
        ['cidadania-digital', 'Cidadania Digital', 28],
        ['danca', 'Dança', 28],
        ['jornalismo', 'Imprensa Jornalismo e Democracia', 28],
        ['sobrevivencialismo', 'Sobrevivencialismo', 28],
        ['ervas', 'Verde que Cura', 28]
      ];

      for (const [id, title, limit] of defaultEletivas) {
        await sql`
          INSERT INTO eletivas (id, title, limit)
          VALUES (${id}, ${title}, ${limit})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    if (req.method === 'GET') {
      const { eletiva } = req.query;
      let result;
      
      if (eletiva) {
        result = await sql`
          SELECT * FROM inscricoes WHERE eletiva = ${eletiva} ORDER BY data DESC
        `;
      } else {
        result = await sql`
          SELECT * FROM inscricoes ORDER BY data DESC
        `;
      }
      
      return res.status(200).json(result);
    }
    
    if (req.method === 'POST') {
      const { nome, turma, whatsapp, eletiva, eletivaNome } = req.body;
      
      if (!nome || !turma || !whatsapp || !eletiva || !eletivaNome) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }

      const result = await sql`
        INSERT INTO inscricoes (nome, turma, whatsapp, eletiva, eletiva_nome)
        VALUES (${nome}, ${turma}, ${whatsapp}, ${eletiva}, ${eletivaNome})
        RETURNING *
      `;
      
      return res.status(201).json(result[0]);
    }
    
    return res.status(405).json({ error: 'Método não permitido' });
    
  } catch (error) {
    console.error('Erro na API:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
