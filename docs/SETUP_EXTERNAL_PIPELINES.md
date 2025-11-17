# 🔄 Configuración de Pipelines Externos para Noticias y Calendario

Este documento explica cómo configurar pipelines externos para ingerir noticias y eventos de calendario económico.

## Resumen

Los endpoints `/api/news/insert` y `/api/calendar/insert` están listos para recibir datos, pero necesitan pipelines externos que:

1. Recolecten datos de fuentes externas (BLS, TradingEconomics, etc.)
2. Transformen los datos al formato esperado
3. Envíen los datos a los endpoints con autenticación `X-INGEST-KEY`

## Opciones de Implementación

### Opción 1: GitHub Actions (Recomendado para empezar)

Ya está creado un template en `.github/workflows/news-calendar-ingest.yml`.

**Pasos para activarlo:**

1. **Configurar Secrets en GitHub:**
   - `APP_URL`: `https://macro-dashboard-seven.vercel.app`
   - `INGEST_KEY`: El mismo que usas en Vercel

2. **Personalizar el workflow:**
   - Edita `.github/workflows/news-calendar-ingest.yml`
   - Reemplaza los `TODO` con tu lógica de recolección
   - Ajusta el schedule según tus necesidades

3. **Ejemplo de integración con API externa:**
   ```yaml
   - name: Fetch BLS CPI Data
     run: |
       # Llamar a API de BLS
       BLS_DATA=$(curl -s "https://api.bls.gov/v2/timeseries/data/CUUR0000SA0")
       
       # Transformar a formato esperado
       NEWS_JSON=$(jq -n \
         --arg id "bls_$(date +%Y-%m)_cpi" \
         --arg fecha "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         --arg valor "$(echo $BLS_DATA | jq -r '.Results.series[0].data[0].value')" \
         '{
           id_fuente: $id,
           fuente: "BLS",
           pais: "US",
           tema: "Inflación",
           titulo: "CPI m/m",
           impacto: "high",
           published_at: $fecha,
           valor_publicado: ($valor | tonumber),
           resumen: "Datos oficiales BLS"
         }')
       
       # Enviar al dashboard
       curl -X POST "${{ secrets.APP_URL }}/api/news/insert" \
         -H "Content-Type: application/json" \
         -H "X-INGEST-KEY: ${{ secrets.INGEST_KEY }}" \
         -d "$NEWS_JSON"
   ```

### Opción 2: Script Python Local con Cron

Crea un script Python que se ejecute periódicamente:

```python
# scripts/ingest_news.py
import requests
import os
from datetime import datetime

APP_URL = os.getenv('APP_URL', 'https://macro-dashboard-seven.vercel.app')
INGEST_KEY = os.getenv('INGEST_KEY')

def fetch_bls_cpi():
    # Tu lógica para obtener datos de BLS
    # ...
    return {
        "id_fuente": f"bls_{datetime.now().strftime('%Y-%m')}_cpi_mom",
        "fuente": "BLS",
        "pais": "US",
        "tema": "Inflación",
        "titulo": "CPI m/m",
        "impacto": "high",
        "published_at": datetime.now().isoformat() + "Z",
        "valor_publicado": 0.5,
        "valor_esperado": 0.3,
        "resumen": "Datos oficiales BLS"
    }

def ingest_news(news_data):
    response = requests.post(
        f"{APP_URL}/api/news/insert",
        json=news_data,
        headers={"X-INGEST-KEY": INGEST_KEY}
    )
    return response.json()

if __name__ == "__main__":
    news = fetch_bls_cpi()
    result = ingest_news(news)
    print(result)
```

**Configurar cron:**
```bash
# Ejecutar cada hora
0 * * * * cd /path/to/project && /usr/bin/python3 scripts/ingest_news.py
```

### Opción 3: Servicio Cloud (AWS Lambda, Google Cloud Functions, etc.)

Similar a GitHub Actions pero con más control sobre el entorno.

## Formatos de Datos Esperados

### Noticias (`/api/news/insert`)

```json
{
  "id_fuente": "bls_2025-11_cpi_mom",
  "fuente": "BLS",
  "pais": "US",
  "tema": "Inflación",
  "titulo": "CPI m/m (oct)",
  "impacto": "high",
  "published_at": "2025-11-10T13:30:00Z",
  "valor_publicado": 0.5,
  "valor_esperado": 0.3,
  "resumen": "Lectura por encima del consenso."
}
```

**Campos requeridos:**
- `id_fuente`: Identificador único (usado para deduplicación)
- `fuente`: Nombre de la fuente (BLS, TradingEconomics, etc.)
- `titulo`: Título de la noticia
- `published_at`: Fecha en ISO 8601 (UTC)
- `impacto`: "low", "med", o "high"

**Campos opcionales:**
- `pais`: Código de país (US, EU, etc.)
- `tema`: Categoría (Inflación, Empleo, etc.)
- `valor_publicado`: Valor numérico publicado
- `valor_esperado`: Valor esperado/consenso
- `resumen`: Resumen de la noticia

### Calendario (`/api/calendar/insert`)

```json
{
  "fecha": "2025-11-20",
  "hora_local": "14:30",
  "pais": "US",
  "tema": "Inflación",
  "evento": "CPI m/m",
  "importancia": "high",
  "consenso": "0.3%"
}
```

**Campos requeridos:**
- `fecha`: Fecha en formato YYYY-MM-DD
- `tema`: Categoría del evento
- `evento`: Nombre del evento

**Campos opcionales:**
- `hora_local`: Hora en formato HH:MM
- `pais`: Código de país
- `importancia`: "low", "med", o "high"
- `consenso`: Valor esperado/consenso

## Fuentes de Datos Recomendadas

### Noticias Macroeconómicas

1. **BLS (Bureau of Labor Statistics)**
   - API: https://www.bls.gov/developers/api_signature_v2.htm
   - Datos: CPI, PPI, Empleo

2. **FRED API**
   - Ya integrado para series, pero puedes usar para noticias de releases

3. **TradingEconomics**
   - API comercial (requiere suscripción)
   - Datos: Noticias económicas, calendario

4. **RSS Feeds**
   - Bloomberg, Reuters, Financial Times
   - Requiere parsing de HTML/RSS

### Calendario Económico

1. **TradingEconomics Calendar API**
   - API comercial
   - Datos completos de calendario económico

2. **Investing.com**
   - Scraping (verificar términos de uso)
   - Calendario económico gratuito

3. **FRED Release Calendar**
   - Integrado con FRED API
   - Solo para series FRED

## Testing

Para probar los endpoints localmente:

```bash
# Noticias
curl -X POST http://localhost:3000/api/news/insert \
  -H "Content-Type: application/json" \
  -H "X-INGEST-KEY: tu_ingest_key" \
  -d '{
    "id_fuente": "test_001",
    "fuente": "TEST",
    "titulo": "Test News",
    "impacto": "high",
    "published_at": "2025-11-12T12:00:00Z"
  }'

# Calendario
curl -X POST http://localhost:3000/api/calendar/insert \
  -H "Content-Type: application/json" \
  -H "X-INGEST-KEY: tu_ingest_key" \
  -d '{
    "fecha": "2025-11-20",
    "tema": "Test",
    "evento": "Test Event",
    "importancia": "high"
  }'
```

## Próximos Pasos

1. ✅ Template de GitHub Actions creado (`.github/workflows/news-calendar-ingest.yml`)
2. ⚠️ **TÚ:** Configurar `INGEST_KEY` en GitHub Secrets
3. ⚠️ **TÚ:** Personalizar el workflow con tu lógica de recolección
4. ⚠️ **TÚ:** Configurar acceso a APIs externas (BLS, TradingEconomics, etc.)
5. ⚠️ **TÚ:** Probar el pipeline y verificar que los datos llegan correctamente

## Notas

- Los endpoints tienen deduplicación automática (2 horas para noticias)
- Las noticias disparan notificaciones Telegram automáticamente
- El sistema procesa narrativas automáticamente cuando aplica
- El calendario se usa para la previa semanal (domingos)

