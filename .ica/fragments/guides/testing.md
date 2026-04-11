---
id: testing
type: guide
title: "Como testar o projeto"
status: active
tags: [testes, dry-run, validação, logs, qualidade, checklist]
depends_on: [config-spec, repasse-spec, alerta-spec]
---

## Filosofia de testes no GAS

GAS não tem framework de testes nativo. A estratégia é:
1. **DRY_RUN** — executa tudo sem efeito colateral real
2. **`DESTINO_IMOBILIARIA` de teste** — envia e-mails reais para endereço controlado
3. **Logger.log** — toda execução com efeito deve logar; logs são o assert

## DRY_RUN mode

Em `src/config.js`, defina `DRY_RUN = true`.

Com DRY_RUN ativo:
- `repassarBoleto()` processa tudo (OCR incluso) mas **não envia e-mail** e **não cria label**
- `verificarPastaManual()` processa tudo mas **não envia e-mail**, **não cria label** e **não move arquivos para lixeira**
- `verificarPendencia()` avalia a condição mas **não envia o alerta**
- Todos os valores que seriam usados aparecem nos logs com prefixo `[DRY_RUN]`

## Endereço de teste

Para testes de ponta a ponta com envio real, configure:
```javascript
const DESTINO_IMOBILIARIA = 'testes.trabalhoestudo@gmail.com';
```

Quando aprovado para produção, alterar para o endereço real da imobiliária.

## Checklist de validação pré-deploy

Execute cada item e verifique os logs:

### Fluxo por e-mail (Premier → repassarBoleto)
- [ ] `repassarBoleto()` com `DRY_RUN = true` — logs mostram meses pendentes, OCR, assunto e corpo
- [ ] Verificar valorId extraído no log — deve bater com o valor real do boleto
- [ ] `repassarBoleto()` com `DRY_RUN = false` e endereço de teste — e-mail chega com PDF
- [ ] Verificar se label `Condomínio_{mesRef}-{valorId}_Enc_em_{data}_E` foi criado no Gmail
- [ ] Rodar `repassarBoleto()` segunda vez — deve abortar: "todos os meses já processados"

### Fluxo manual (WhatsApp → pasta Drive → verificarPastaManual)
- [ ] Depositar PDF na pasta `PASTA_MANUAL_ID`
- [ ] `verificarPastaManual()` com `DRY_RUN = true` — logs mostram OCR, agrupamento e label que seria criado
- [ ] `verificarPastaManual()` com `DRY_RUN = false` e endereço de teste — e-mail chega com PDF, arquivo vai para lixeira
- [ ] Label flutuante criado no Gmail: `Condomínio_{mesRef}-{valorId}_Enc_em_{data}_P`
- [ ] Depositar o mesmo PDF novamente → rodar → label deve ser `Reenc`

### Alerta de pendência (verificarPendencia)
- [ ] `verificarPendencia()` com `DRY_RUN = true` e sem label do mês no dia 10 — log de alerta
- [ ] `verificarPendencia()` com `DRY_RUN = true` e com label do mês — "repasse confirmado"
- [ ] Para simular dia 10: alterar temporariamente `DIAS_VERIFICACAO = [dia_de_hoje]` e `DIA_ALERTA = dia_de_hoje`

### Montagem do e-mail
- [ ] `montarEmailRepasse('2026-04')` — competência Abril/2026, aluguel Maio/2026
- [ ] `montarEmailRepasse('2026-12')` — competência Dezembro/2026, aluguel Janeiro/2027

## Ver logs no terminal

```bash
clasp logs              # últimas execuções
clasp logs --watch      # modo streaming (ctrl+C para parar)
```

## Planilha de log

Após qualquer execução real, verificar a planilha `Log_Condominio_Automacao`
na pasta do Drive (`PASTA_MANUAL_ID`). Colunas:
`Timestamp | Função | MesRef | ValorId | Arquivo | Ação | Origem | Detalhes`
