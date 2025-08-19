import postgres from 'postgres';

let sql;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada');
  }
  
  sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
    idle_timeout: 20,
    max_lifetime: 60 * 30
  });
  
  console.log('Conexão com o banco estabelecida');
} catch (error) {
  console.error('Erro na conexão com o banco:', error.message);
  // Fallback para modo de desenvolvimento sem banco
  sql = {
    query: () => Promise.resolve([]),
    end: () => {}
  };
}

export default sql;
