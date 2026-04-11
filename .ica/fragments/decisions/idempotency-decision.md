---
id: idempotency-decision
type: decision
title: "Controle de idempotência via Gmail labels"
status: active
tags: [idempotencia, gmail-labels, estado, segurança, duplicatas, valorId]
depends_on: []
---

## Contexto

`repassarBoleto()` e `verificarPastaManual()` rodam via triggers diários.
Sem controle, enviariam o mesmo boleto múltiplas vezes. Precisamos de estado
persistente e gratuito que viva dentro do ecossistema Google e seja auditável
sem abrir o editor do GAS.

## Decisão

Usar **Gmail labels** como mecanismo de estado. O nome do label codifica todas
as informações relevantes do envio — mês, valor, tipo e origem — permitindo
rastreabilidade e idempotência em ambos os fluxos.

## Formato do label

```
{LABEL_PREFIXO}_{mesRef}-{valorId}_{tipo}_em_{YYYY-MM-DD}_{origem}
```

Exemplo: `Condomínio_2026-04-59372_Enc_em_2026-04-10_E`

| Campo | Valores | Descrição |
|---|---|---|
| `LABEL_PREFIXO` | `Condomínio` | Constante em config.js |
| `mesRef` | `YYYY-MM` | Mês de referência do boleto |
| `valorId` | inteiro sem separadores | Valor do boleto como ID único (ex: `59372`) |
| `tipo` | `Enc` / `Reenc` | Primeiro envio / reenvio |
| `YYYY-MM-DD` | data atual | Data em que o envio ocorreu |
| `origem` | `E` / `P` | Email (Premier) / Pasta (Drive manual) |

## Helpers em `src/repasse.js` (escopo global GAS)

```javascript
// Nome completo do label
construirLabel(mesRef, valorId, tipo, origem)

// Prefixo que cobre E e P do mesmo boleto (mesmo mes+valor)
construirPrefixo(mesRef, valorId)  // → "Condomínio_2026-04-59372"

// Verifica existência por startsWith
labelExiste(prefixo)  // → boolean
```

## Idempotência por fluxo

**Fluxo e-mail (`repassarBoleto`):**
```javascript
// Verificação de mês pendente (pré-filtro): prefixo sem valorId
!labelExiste(`${LABEL_PREFIXO}_${mes}-`)

// Verificação de boleto específico (pós-OCR): prefixo com valorId
if (labelExiste(construirPrefixo(dados.mesRef, dados.valorId))) { return; }

// Após envio confirmado: label vinculado à thread Premier
const label = GmailApp.createLabel(labelNome);
label.addToThread(thread);
```

**Fluxo manual (`verificarPastaManual`):**
```javascript
// Mesmo construirPrefixo — cobre E e P do mesmo boleto
const tipo = labelExiste(prefixo) ? 'Reenc' : 'Enc';

// Label flutuante — sem thread (boleto veio do Drive, não de e-mail)
GmailApp.createLabel(labelNome);
```

## Checagem de alerta (`verificarPendencia`)

Usa prefixo de mês sem valorId — qualquer repasse do mês basta:
```javascript
const prefixoMes = `${LABEL_PREFIXO}_${mesRef}`;  // "Condomínio_2026-04"
if (labelExiste(prefixoMes)) { return; }
```

## Por que valorId no label

O valor do boleto varia mês a mês (taxas extras, reajustes). Incluir o valorId
no label garante que:
1. Labels de meses diferentes nunca colidem
2. Um reenvio com valor diferente gera um label distinto (Reenc)
3. A auditoria no Gmail mostra o valor exato de cada envio

## Por que não usar PropertiesService

`PropertiesService` também funcionaria, mas labels têm vantagens:
- Visíveis na caixa de entrada do Gmail — auditoria sem abrir o GAS
- Vinculados à thread original (fluxo e-mail) — contexto preservado
- `getUserLabels()` é uma API eficiente para busca por prefixo
