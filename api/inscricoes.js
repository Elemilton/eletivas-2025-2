import { v4 as uuidv4 } from 'uuid';

// Simula um banco de dados em memória (substitua por um banco de dados real em produção)
let inscricoes = [];
let eletivas = [
    { id: 'arte-sustentavel', title: 'Arte Sustentável', limit: 28 },
    { id: 'artistas-historia', title: 'Artistas que Marcaram a História da Arte', limit: 28 },
    { id: 'biq-games', title: 'BiQ Games', limit: 28 },
    { id: 'cidadania-digital', title: 'Cidadania Digital', limit: 28 },
    { id: 'danca', title: 'Dança', limit: 28 },
    { id: 'jornalismo', title: 'Imprensa Jornalismo e Democracia', limit: 28 },
    { id: 'sobrevivencialismo', title: 'Sobrevivencialismo', limit: 28 },
    { id: 'ervas', title: 'Verde que Cura', limit: 28 }
];

export default async function handler(req, res) {
    // GET - Listar inscrições (com filtro opcional por eletiva)
    if (req.method === 'GET') {
        const { eletiva } = req.query;
        
        let result = [...inscricoes];
        if (eletiva) {
            result = result.filter(i => i.eletiva === eletiva);
        }
        
        return res.status(200).json(result);
    }
    
    // POST - Criar nova inscrição
    if (req.method === 'POST') {
        const { nome, turma, whatsapp, eletiva, eletivaNome } = req.body;
        
        if (!nome || !turma || !whatsapp || !eletiva || !eletivaNome) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        
        const novaInscricao = {
            id: uuidv4(),
            nome,
            turma,
            whatsapp,
            eletiva,
            eletivaNome,
            data: new Date().toISOString()
        };
        
        inscricoes.push(novaInscricao);
        return res.status(201).json(novaInscricao);
    }
    
    // Método não permitido
    return res.status(405).json({ error: 'Método não permitido' });
}
