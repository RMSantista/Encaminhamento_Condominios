---
id: alerta-spec
type: specification
title: "Especificação de verificarPendencia() — src/alerta.js"
status: active
tags: [alerta, pendencia, trigger, dias-8-10, notificacao]
depends_on: [config-spec, idempotency-decision]
---

## Responsabilidade

Detectar se o boleto da Premier **não chegou** até o dia 10 do mês e alertar
o dono da conta. Funciona como rede de segurança para o caso da seguradora
cobrar via DDA sem enviar o e-mail.

## Quando deve agir

O trigger chama `verificarPendencia()` diariamente, mas ela só age nos dias
definidos em `DIAS_VERIFICACAO` (padrão: 8, 9 e 10). Nos demais dias, retorna
sem ação.

## Condição de alerta

Age se **ambas** as condições forem verdadeiras:
1. Hoje é um dos `DIAS_VERIFICACAO`
2. Não existe o label `${LABEL_BASE}-YYYY-MM` do mês corrente

## Implementação de `src/alerta.js`

```javascript
function verificarPendencia() {
  // Guard: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. verificarPendencia() abortado.');
    return;
  }

  const hoje   = new Date();
  const dia    = Number(Utilities.formatDate(hoje, TIMEZONE, 'd'));
  const mesRef = Utilities.formatDate(hoje, TIMEZONE, 'yyyy-MM');

  // Só age nos dias configurados
  if (!DIAS_VERIFICACAO.includes(dia)) {
    Logger.log(`Dia ${dia}: fora do período de verificação. Nenhuma ação.`);
    return;
  }

  // Checa se o repasse já foi feito
  const labelNome = `${LABEL_BASE}-${mesRef}`;
  if (GmailApp.getUserLabelByName(labelNome)) {
    Logger.log(`Repasse de ${mesRef} confirmado. Nenhum alerta necessário.`);
    return;
  }

  // Alerta
  const emailDono = Session.getActiveUser().getEmail();
  const assunto   = `⚠️ Boleto Premier não recebido — ${mesRef}`;
  const corpo     = `Atenção,

Hoje é dia ${dia}/${mesRef.split('-')[1]}/${mesRef.split('-')[0]} e o boleto de condomínio \
da Premier Garantidora referente a ${mesRef} ainda não foi repassado para a Pirâmid Imóveis.

Possíveis causas:
- A Premier cobrou via DDA mas não enviou o e-mail
- O e-mail chegou com assunto diferente do esperado (verifique a caixa de entrada)

Acesse script.google.com para verificar os logs da automação.

Atenciosamente,
Automação Condomínio`;

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria alerta para ${emailDono}: "${assunto}"`);
  } else {
    GmailApp.sendEmail(emailDono, assunto, corpo);
    Logger.log(`Alerta enviado para ${emailDono} — boleto de ${mesRef} pendente no dia ${dia}`);
  }
}
```

## Comportamento esperado ao longo do mês

| Dia | Label existe? | Ação |
|---|---|---|
| 1–7 | qualquer | Nenhuma (fora de DIAS_VERIFICACAO) |
| 8 | não | Envia alerta |
| 8 | sim | Nenhuma |
| 9 | não | Envia alerta novamente |
| 10 | não | Envia alerta novamente |
| 11+ | qualquer | Nenhuma (fora de DIAS_VERIFICACAO) |

O alerta pode ser enviado mais de uma vez (dias 8, 9 e 10) — isso é intencional
para garantir que a notificação seja vista.
