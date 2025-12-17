/**
 * Script para probar endpoints "latest" o "current" de Trading Economics
 */

const TE_BASE = "https://api.tradingeconomics.com";
const apiKey = "3EE47420-8691-4DE1-AF46-32283925D96C";

const endpoints = [
  // Latest value
  `${TE_BASE}/latest/country/united%20states/indicator/manufacturing%20pmi?c=${encodeURIComponent(apiKey)}`,
  // Current value
  `${TE_BASE}/country/united%20states/indicator/manufacturing%20pmi?c=${encodeURIComponent(apiKey)}`,
  // Markets endpoint
  `${TE_BASE}/markets/indicator?country=united%20states&indicator=manufacturing%20pmi&c=${encodeURIComponent(apiKey)}`,
  // Indicator endpoint directo
  `${TE_BASE}/indicator/united%20states/manufacturing%20pmi?c=${encodeURIComponent(apiKey)}`,
];

async function testEndpoint(url: string, index: number) {
  console.log(`\n🔍 Probando endpoint ${index + 1}...`);
  console.log(`URL: ${url.substring(0, 100)}...`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Respuesta exitosa');
      console.log('Tipo:', Array.isArray(data) ? 'Array' : typeof data);
      
      if (Array.isArray(data)) {
        console.log(`Número de elementos: ${data.length}`);
        if (data.length > 0) {
          console.log('Primer elemento:', JSON.stringify(data[0], null, 2));
        }
        return { success: true, data };
      } else if (data?.data && Array.isArray(data.data)) {
        console.log(`Número de elementos: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log('Primer elemento:', JSON.stringify(data.data[0], null, 2));
        }
        return { success: true, data: data.data };
      } else {
        console.log('Estructura:', Object.keys(data || {}));
        console.log('Datos:', JSON.stringify(data, null, 2).substring(0, 500));
        return { success: true, data };
      }
    } else {
      const text = await response.text();
      console.log(`❌ Error: ${text.substring(0, 300)}`);
      return { success: false, error: text };
    }
  } catch (error) {
    console.log(`❌ Excepción: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log('🚀 Probando endpoints "latest/current" de Trading Economics para PMI...\n');
  
  for (let i = 0; i < endpoints.length; i++) {
    const result = await testEndpoint(endpoints[i], i);
    if (result.success && result.data) {
      console.log(`\n✅ Endpoint ${i + 1} funciona!`);
      // Intentar extraer valor y fecha
      if (Array.isArray(result.data) && result.data.length > 0) {
        const item = result.data[0];
        const value = item.Value || item.value || item.Last || item.last;
        const date = item.Date || item.date || item.DateTime || item.datetime;
        if (value && date) {
          console.log(`\n📊 Valor encontrado: ${value} en fecha ${date}`);
        }
      }
      break;
    }
    // Esperar un poco entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main();



















