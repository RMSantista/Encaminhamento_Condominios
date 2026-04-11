---
id: ocr-spec
type: specification
title: "Especificação do módulo OCR — src/ocr.js"
status: active
tags: [ocr, pdf, drive-api, premier, parsing]
depends_on: [config-spec]
---

## Responsabilidade

Extrair dados estruturados de um PDF de boleto da Premier Garantidora usando
OCR via Drive API v2. Retorna `{ mesRef, valorId, vencimento, valor }` ou lança
erro após enviar alerta por e-mail ao dono da conta.

## Dependência de infraestrutura

Requer o serviço avançado **Drive API v2** habilitado no projeto GAS, com
identificador `Drive_OCR` (configurado em `appsscript.json`):

```json
{
  "enabledAdvancedServices": [{
    "userSymbol": "Drive_OCR",
    "serviceId": "drive",
    "version": "v2"
  }]
}
```

## Função pública

```javascript
extrairDadosBoleto(pdfBlob, nomeArquivo)
→ { mesRef, valorId, vencimento, valor }
```

| Campo | Formato | Exemplo |
|---|---|---|
| `mesRef` | `'YYYY-MM'` | `'2026-04'` |
| `valorId` | inteiro como string | `'59372'` |
| `vencimento` | `'DD/MM/AAAA'` | `'13/04/2026'` |
| `valor` | formato original | `'593,72'` |

## Fluxo interno

```
pdfBlob
↓ Drive_OCR.Files.insert({ ocr: true, ocrLanguage: 'pt' })
↓ DocumentApp.openById(docId).getBody().getText()
↓ Drive_OCR.Files.remove(docId)   ← sempre, no finally
↓ _validarIdentificacaoPremier()
↓ _extrairVencimento()
↓ _extrairValor()
↓ _calcularMesRef()
→ { mesRef, valorId, vencimento, valor }
```

O Doc temporário é **sempre apagado** no `finally`, mesmo em caso de erro.

## Regex de extração

```javascript
// Identificação Premier (obrigatória — lança erro se não encontrar)
/PREMIER\s+GARANTIDORA\s+DE\s+CREDITOS/i

// Vencimento
/Vencimento[:\s]+([\d]{2}\/[\d]{2}\/[\d]{4})/i

// Valor do documento
/Valor\s+do\s+documento\s*[\r\n]+([\d.,]+)/i
```

## valorId

Valor sem separadores: `valor.replace(/[.,]/g, '')`.
Ex: `'593,72'` → ``'59372'`.

## Comportamento em caso de erro

Se Premier não for identificada, vencimento ou valor não forem encontrados:
1. Envia e-mail de alerta ao dono da conta (`Session.getActiveUser().getEmail()`)
2. **Não remove nem move** o arquivo — fica disponível para intervenção manual
3. Lança `Error` com descrição do motivo

O chamador (`repassarBoleto` ou `verificarPastaManual`) captura o erro,
registra no log e continua para o próximo item.
