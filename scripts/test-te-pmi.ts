/**
 * Script para probar la API de Trading Economics para PMI
 */

const TE_BASE = "https://api.tradingeconomics.com";
const apiKey = process.env.TRADING_ECONOMICS_API_KEY || 'guest:guest';
const country = "united states";
const indicator = "manufacturing pmi";

const url = `${TE_BASE}/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?c=${encodeURIComponent(apiKey)}`;

console.log('🔍 Probando API de Trading Economics para PMI...\n');
console.log('URL:', url);
console.log('API Key:', apiKey === 'guest:guest' ? 'guest:guest (acceso básico)' : '***configurada***\n');

async function testTE() {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    console.log('Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Error:', text.substring(0, 500));
      return;
    }

    const data = await response.json();
    console.log('\n✅ Respuesta recibida');
    console.log('Tipo de datos:', Array.isArray(data) ? 'Array' : typeof data);
    
    if (Array.isArray(data)) {
      console.log('Número de observaciones:', data.length);
      if (data.length > 0) {
        console.log('\nPrimera observación:', JSON.stringify(data[0], null, 2));
        console.log('\nÚltima observación:', JSON.stringify(data[data.length - 1], null, 2));
      }
    } else if (data?.data && Array.isArray(data.data)) {
      console.log('Número de observaciones:', data.data.length);
      if (data.data.length > 0) {
        console.log('\nPrimera observación:', JSON.stringify(data.data[0], null, 2));
      }
    } else {
      console.log('Estructura de datos:', Object.keys(data || {}));
      console.log('Datos completos:', JSON.stringify(data, null, 2).substring(0, 1000));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTE();














