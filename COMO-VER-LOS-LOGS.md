# 🔍 CÓMO VER LOS LOGS Y DIAGNOSTICAR EL PROBLEMA

## Método 1: Endpoint de Debug (MÁS FÁCIL) ✅

### Paso 1: Abre tu navegador
Abre cualquier navegador (Chrome, Firefox, Safari, etc.)

### Paso 2: Ve a esta URL
```
http://localhost:3000/api/debug/european-indicators
```

### Paso 3: Verás un JSON con toda la información
El JSON mostrará:
- **`summary`**: Resumen de cuántos indicadores hay en cada paso
- **`steps.database`**: Datos en la base de datos
- **`steps.getAllLatestFromDBWithPrev`**: Datos después de leer de BD
- **`steps.getMacroDiagnosis`**: Datos después de transformar
- **`steps.getBiasState`**: Datos en la tabla final

### Paso 4: Busca el problema
1. Mira la sección `summary` al final del JSON
2. Compara los números:
   - Si `database.withData` > 0 pero `getAllLatestFromDBWithPrev.withValue` = 0 → Problema en lectura de BD
   - Si `getAllLatestFromDBWithPrev.withValue` > 0 pero `getMacroDiagnosis.withValue` = 0 → Problema en transformación
   - Si `getMacroDiagnosis.withValue` > 0 pero `getBiasState.withValue` = 0 → Problema en mapeo de keys

### Paso 5: Copia y pega el JSON
Copia todo el JSON que ves en el navegador y compártelo conmigo.

---

## Método 2: Ver Logs del Servidor (ALTERNATIVA)

### Paso 1: Encuentra la terminal donde corre el servidor
- Busca la ventana/terminal donde ejecutaste `pnpm dev`
- O busca en las pestañas de tu editor (si usas VS Code o similar)

### Paso 2: Recarga el dashboard
- Abre `http://localhost:3000/dashboard` en tu navegador
- Presiona **F5** o **Ctrl+Shift+R** (o **Cmd+Shift+R** en Mac)

### Paso 3: Busca en los logs
En la terminal del servidor, busca líneas que contengan:
- `DEBUG`
- `eu_`
- `European`

### Paso 4: Copia las líneas relevantes
Copia las líneas que encuentres y compártelas conmigo.

---

## Método 3: Usar jq en Terminal (AVANZADO)

Si tienes `jq` instalado, puedes ejecutar:

```bash
curl -s http://localhost:3000/api/debug/european-indicators | jq '.summary'
```

Esto mostrará solo el resumen.

---

## 📊 QUÉ BUSCAR EN EL JSON

### Ejemplo de JSON esperado:

```json
{
  "summary": {
    "database": {
      "total": 2,
      "withData": 2
    },
    "getAllLatestFromDBWithPrev": {
      "total": 13,
      "withValue": 2
    },
    "getMacroDiagnosis": {
      "total": 13,
      "withValue": 2
    },
    "getBiasState": {
      "total": 13,
      "withValue": 2
    }
  }
}
```

### Interpretación:
- **`database.withData: 2`** → Hay 2 indicadores con datos en BD ✅
- **`getAllLatestFromDBWithPrev.withValue: 2`** → 2 indicadores tienen valores después de leer ✅
- **`getMacroDiagnosis.withValue: 2`** → 2 indicadores tienen valores después de transformar ✅
- **`getBiasState.withValue: 2`** → 2 indicadores tienen valores en la tabla final ✅

Si algún paso tiene `withValue: 0`, ese es el paso donde se pierden los datos.

---

## 🎯 RESULTADO ESPERADO

Si todo funciona correctamente, deberías ver:
- `getAllLatestFromDBWithPrev.europeanIndicators[0]` con `value: 2.14` (o similar)
- `getMacroDiagnosis.europeanItems[0]` con `value: 2.14`
- `getBiasState.europeanRows[0]` con `value: 2.14`

Si ves `value: null` en algún paso, ese es el problema.

---

## 💡 CONSEJO

**Usa el Método 1 (endpoint de debug)** - Es el más fácil y te da toda la información de una vez.

Solo abre:
```
http://localhost:3000/api/debug/european-indicators
```

Y comparte el JSON completo conmigo.
