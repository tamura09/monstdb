import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    console.log('connected, version:', res.rows[0]);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('connect error:', err);
    await client.end().catch(()=>{});
    process.exit(2);
  }
})();
