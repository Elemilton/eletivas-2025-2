import sql from '../../lib/db';

export default async function handler(req, res) {
  // Configurar CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Criar tabelas se não existirem
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
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_eletiva 
          FOREIGN KEY(eletiva) 
          REFERENCES eletivas(id)
          ON DELETE CASCADE
      )
    `;

    // Criar índices para melhor performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_inscricoes_eletiva 
      ON inscricoes(eletiva)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_inscricoes_data 
      ON inscricoes(data DESC)
    `;

    // Inserir eletivas padrão se a tabela estiver vazia
    const eletivasCount = await sql`SELECT COUNT(*) FROM eletivas`;
    if (eletivasCount[0].count === '0') {
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
      console.log('Eletivas padrão inseridas com sucesso');
    }

    // GET - Listar inscrições
    if (req.method === 'GET') {
      const { eletiva } = req.query;
      
      try {
        let result;
        if (eletiva) {
          result = await sql`
            SELECT 
              i.*,
              e.title as eletiva_title,
              e.limit as eletiva_limit
            FROM inscricoes i
            LEFT JOIN eletivas e ON i.eletiva = e.id
            WHERE i.eletiva = ${eletiva}
            ORDER BY i.data DESC
          `;
        } else {
          result = await sql`
            SELECT 
              i.*,
              e.title as eletiva_title,
              e.limit as eletiva_limit
            FROM inscricoes i
            LEFT JOIN eletivas e ON i.eletiva = e.id
            ORDER BY i.data DESC
          `;
        }
        
        return res.status(200).json(result);
      } catch (error) {
        console.error('Erro ao buscar inscrições:', error);
        return res.status(500).json({ 
          error: 'Erro ao buscar inscrições',
          details: error.message 
        });
      }
    }
    
    // POST - Criar nova inscrição
    if (req.method === 'POST') {
      try {
        const { nome, turma, whatsapp, eletiva, eletivaNome } = req.body;
        
        // Validação dos campos
        if (!nome || !turma || !whatsapp || !eletiva || !eletivaNome) {
          return res.status(400).json({ 
            error: 'Dados incompletos',
            required: ['nome', 'turma', 'whatsapp', 'eletiva', 'eletivaNome']
          });
        }

        if (nome.length > 100) {
          return res.status(400).json({ error: 'Nome muito longo (máx. 100 caracteres)' });
        }

        if (whatsapp.length > 20) {
          return res.status(400).json({ error: 'WhatsApp muito longo (máx. 20 caracteres)' });
        }

        // Verificar se a eletiva existe
        const eletivaExists = await sql`
          SELECT id, title, limit FROM eletivas WHERE id = ${eletiva}
        `;
        
        if (eletivaExists.length === 0) {
          return res.status(400).json({ 
            error: 'Eletiva não encontrada',
            available: await getAvailableEletivas()
          });
        }

        // Verificar se já existe inscrição com mesmo WhatsApp (evitar duplicatas)
        const existingInscricao = await sql`
          SELECT id FROM inscricoes 
          WHERE whatsapp = ${whatsapp} AND eletiva = ${eletiva}
        `;
        
        if (existingInscricao.length > 0) {
          return res.status(400).json({ 
            error: 'Você já está inscrito nesta eletiva' 
          });
        }

        // Contar vagas disponíveis
        const vagasResult = await sql`
          SELECT 
            e.limit,
            COUNT(i.id) as inscritos_count
          FROM eletivas e
          LEFT JOIN inscricoes i ON e.id = i.eletiva
          WHERE e.id = ${eletiva}
          GROUP BY e.id, e.limit
        `;
        
        if (vagasResult.length === 0) {
          return res.status(400).json({ error: 'Eletiva não encontrada' });
        }
        
        const { limit, inscritos_count } = vagasResult[0];
        const vagasDisponiveis = limit - inscritos_count;
        
        if (vagasDisponiveis <= 0) {
          return res.status(400).json({ 
            error: 'Eletiva sem vagas disponíveis',
            vagas_total: limit,
            vagas_preenchidas: inscritos_count
          });
        }

        // Criar a inscrição
        const result = await sql`
          INSERT INTO inscricoes (nome, turma, whatsapp, eletiva, eletiva_nome)
          VALUES (${nome}, ${turma}, ${whatsapp}, ${eletiva}, ${eletivaNome})
          RETURNING *
        `;
        
        // Buscar dados completos da inscrição
        const inscricaoCompleta = await sql`
          SELECT 
            i.*,
            e.title as eletiva_title,
            e.limit as eletiva_limit,
            (SELECT COUNT(*) FROM inscricoes WHERE eletiva = ${eletiva}) as total_inscritos_eletiva
          FROM inscricoes i
          LEFT JOIN eletivas e ON i.eletiva = e.id
          WHERE i.id = ${result[0].id}
        `;

        console.log('Nova inscrição criada:', inscricaoCompleta[0]);
        
        return res.status(201).json({
          success: true,
          message: `Inscrição realizada com sucesso na eletiva ${eletivaNome}!`,
          data: inscricaoCompleta[0],
          vagas_disponiveis: vagasDisponiveis - 1
        });
        
      } catch (error) {
        console.error('Erro ao criar inscrição:', error);
        
        // Erro de chave única (duplicata)
        if (error.code === '23505') {
          return res.status(400).json({ 
            error: 'Inscrição duplicada detectada' 
          });
        }
        
        // Erro de chave estrangeira
        if (error.code === '23503') {
          return res.status(400).json({ 
            error: 'Eletiva não encontrada' 
          });
        }
        
        return res.status(500).json({ 
          error: 'Erro interno ao processar inscrição',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    // Método não permitido
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowed: ['GET', 'POST', 'OPTIONS']
    });
    
  } catch (error) {
    console.error('Erro geral na API:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Função auxiliar para listar eletivas disponíveis
async function getAvailableEletivas() {
  try {
    const eletivas = await sql`
      SELECT 
        e.id,
        e.title,
        e.limit,
        COUNT(i.id) as inscritos,
        (e.limit - COUNT(i.id)) as vagas_disponiveis
      FROM eletivas e
      LEFT JOIN inscricoes i ON e.id = i.eletiva
      GROUP BY e.id, e.title, e.limit
      ORDER BY e.title
    `;
    return eletivas;
  } catch (error) {
    console.error('Erro ao buscar eletivas:', error);
    return [];
  }
}
