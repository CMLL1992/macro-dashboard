/**
 * Script para probar diferentes endpoints de Trading Economics para PMI
 */

const TE_BASE = "https://api.tradingeconomics.com";
const apiKey = "3EE47420-8691-4DE1-AF46-32283925D96C";

const endpoints = [
  // Endpoint histórico (recomendado)
  `${TE_BASE}/historical/country/united%20states/indicator/manufacturing%20pmi?c=${encodeURIComponent(apiKey)}`,
  // Endpoint markets/indicators
  `${TE_BASE}/markets/indicators/united-states/manufacturing-pmi?c=${encodeURIComponent(apiKey)}`,
  // Endpoint histórico con formato diferente
  `${TE_BASE}/historical/country/united%20states/indicator/manufacturing%20pmi?c=${apiKey}`,
  // Endpoint con formato diferente del indicador
  `${TE_BASE}/historical/country/united%20states/indicator/PMI?c=${encodeURIComponent(apiKey)}`,
  // Endpoint ISM
  `${TE_BASE}/historical/country/united%20states/indicator/ISM%20Manufacturing%20PMI?c=${encodeURIComponent(apiKey)}`,
];

async function testEndpoint(url: string, index: number) {
  console.log(`\n🔍 Probando endpoint ${index + 1}...`);
  console.log(`URL: ${url}`);
  
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
        console.log(`Número de observaciones: ${data.length}`);
        if (data.length > 0) {
          console.log('Primera observación:', JSON.stringify(data[0], null, 2));
        }
        return true;
      } else if (data?.data && Array.isArray(data.data)) {
        console.log(`Número de observaciones: ${data.data.length}`);
        if (data.data.length > 0) {
          console.log('Primera observación:', JSON.stringify(data.data[0], null, 2));
        }
        return true;
      } else {
        console.log('Estructura:', Object.keys(data || {}));
      }
    } else {
      const text = await response.text();
      console.log(`❌ Error: ${text.substring(0, 300)}`);
    }
  } catch (error) {
    console.log(`❌ Excepción: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return false;
}

async function main() {
  console.log('🚀 Probando diferentes endpoints de Trading Economics para PMI...\n');
  
  for (let i = 0; i < endpoints.length; i++) {
    const success = await testEndpoint(endpoints[i], i);
    if (success) {
      console.log(`\n✅ Endpoint ${i + 1} funciona!`);
      break;
    }
    // Esperar un poco entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main();





















