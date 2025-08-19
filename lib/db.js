import postgres from 'postgres';

const DATABASE_URL = "postgresql://neondb_owner:npg_T18AqiMEhckw@ep-aged-dew-acou20b4-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

let sql;

try {
  sql = postgres(DATABASE_URL, {
    ssl: 'require',
    idle_timeout: 20,
    max_lifetime: 60 * 30
  });
  console.log('✅ Conexão com PostgreSQL estabelecida');
} catch (error) {
  console.error('❌ Erro na conexão:', error.message);
  sql = { query: () => Promise.resolve([]) };
}

export default sql;
