// Simula um banco de dados em memória (mesmo array do arquivo anterior)
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
    const { id } = req.query;
    
    // PUT - Atualizar limite de vagas
    if (req.method === 'PUT') {
        const { limit } = req.body;
        
        if (isNaN(limit) || limit < 0) {
            return res.status(400).json({ error: 'Limite inválido' });
        }
        
        const eletivaIndex = eletivas.findIndex(e => e.id === id);
        if (eletivaIndex === -1) {
            return res.status(404).json({ error: 'Eletiva não encontrada' });
        }
        
        eletivas[eletivaIndex].limit = parseInt(limit);
        return res.status(200).json(eletivas[eletivaIndex]);
    }
    
    // Método não permitido
    return res.status(405).json({ error: 'Método não permitido' });
}
