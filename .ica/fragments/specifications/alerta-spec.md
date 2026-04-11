---
id: alerta-spec
type: specification
title: "Especificação de verificarPendencia() — src/alerta.js"
status: active
tags: [alerta, pendencia, trigger, dia-10, notificacao, meio-dia]
depends_on: [config-spec, idempotency-decision]
---

## Responsabilidade

Detectar se o boleto da Premier **não chegou** até o meio-dia do dia `DIA_ALERTA`
(padrão: dia 10) e alertar o dono da conta. Rede de segurança para o caso da
seguradora cobrar via DDA sem enviar o e-mail.

## Quando deve agir

O trigger chama `verificarPendencia()` diariamente ao meio-dia, mas ela só age
nos dias definidos em `DIAS_VERIFICACAO` (padrão: 8, 9 e 10). Nos demais dias,
retorna sem ação.

## Comportamento por dia

| Dia | Repasse feito? | Ação |
|---|---|---|
| 1–7 | qualquer | Nenhuma (fora de `DIAS_VERIFICACAO`) |
| 8 | não | Apenas log silencioso — Premier ainda pode enviar |
| 9 | não | Apenas log silencioso — Premier ainda pode enviar |
| 8–9 | sim | Nenhuma |
| 10 | sim | Nenhuma |
| 10 (ao meio-dia) | não | **Dispara alerta por e-mail** |
| 11+ | qualquer | Nenhuma (fora de `DIAS_VERIFICACAO`) |

O alerta é enviado **apenas ao meio-dia do dia `DIA_ALERTA`** — não nos dias
anteriores. Dias 8 e 9 são verificação silenciosa para monitoramento de logs.

## Condição de alerta (dia 10)

Envia alerta se **todas** as condições forem verdadeiras:
1. Hoje é o dia `DIA_ALERTA` (10)
2. Não existe nenhum label com prefixo `${LABEL_PREFIXO}_${mesRef}`
   (cobre qualquer boleto do mês, independente de valorId ou origem)

## Corpo do alerta

```
Atenção,

Hoje é meio-dia do dia 10/{MM}/{AAAA} e o boleto de condomínio da Premier
Garantidora referente a {YYYY-MM} ainda não foi recebido nem repassado
para a Pirâmid Imóveis.

Possíveis causas:
- A Premier cobrou via DDA mas não enviou o e-mail
- O e-mail chegou com assunto diferente do esperado (verifique a caixa de entrada)
- O boleto pode ter sido enviado via WhatsApp — verifique e coloque na pasta do Drive

Acesse script.google.com para verificar os logs da automação.
```

## Checagem de label

Usa o prefixo de mês (sem valorId) para detectar qualquer repasse do mês:

```javascript
const prefixoMes = `${LABEL_PREFIXO}_${mesRef}`;  // ex: "Condomínio_2026-04"
if (labelExiste(prefixoMes)) { return; }           // qualquer repasse do mês basta
```

Diferente da idempotência do repasse, que usa o prefixo completo com valorId.
