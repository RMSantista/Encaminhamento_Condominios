# Design: Fluxo Manual de Repasse de Boleto

**Data:** 2026-04-11
**Status:** Aprovado

---

## Contexto

Quando a Premier Garantidora não envia o boleto por e-mail, o usuário o recebe via
WhatsApp, salva o PDF em uma pasta local sincronizada com o Google Drive (via Google
Drive for Desktop). Além disso, a imobiliária pode solicitar reenvio de boletos já
encaminhados. O sistema precisa cobrir ambos os cenários com rastreabilidade completa.

---

## Objetivo

1. Implementar `verificarPastaManual()` em `src/manual.js`: monitora pasta do Drive,
   lê PDFs via OCR, envia um e-mail por boleto (ordem crescente de vencimento), move
   arquivos processados para a lixeira.
2. Extrair o valor do boleto via OCR também no fluxo de e-mail (`repassarBoleto()`),
   unificando o formato de label entre os dois fluxos.
3. Implementar `src/ocr.js`: módulo compartilhado de extração de dados via OCR.
4. Implementar `src/log.js`: registro de todas as ações em Google Sheets na pasta
   dos PDFs manuais.

---

## Formato do Label (unificado)

```
Condomínio_{mesRef}-{valorId}_{tipo}_em_{YYYY-MM-DD}_{origem}
```

| Parte      | Descrição                                              | Exemplo       |
|------------|--------------------------------------------------------|---------------|
| `mesRef`   | Mês de vencimento do boleto (YYYY-MM)                  | `2026-04`     |
| `valorId`  | Valor do boleto sem separadores (R$ 593,72 → `59372`)  | `59372`       |
| `tipo`     | `Enc` (primeiro envio) ou `Reenc` (reenvio)            | `Enc`         |
| `YYYY-MM-DD` | Data em que o encaminhamento foi feito               | `2026-04-10`  |
| `origem`   | `E` (e-mail Premier) ou `P` (pasta manual)             | `P`           |

### Exemplos completos

```
Condomínio_2026-04-59372_Enc_em_2026-04-05_E    ← 1º envio via e-mail Premier
Condomínio_2026-04-59372_Enc_em_2026-04-10_P    ← 1º envio via pasta (Premier não enviou)
Condomínio_2026-04-59372_Reenc_em_2026-04-13_P  ← reenvio via pasta (imobiliária pediu)
Condomínio_2026-03-47800_Reenc_em_2026-04-13_P  ← reenvio mês anterior via pasta
```

---

## Regras de Idempotência

### Fluxo E — `repassarBoleto()`

- Extrai `mesRef` e `valorId` via OCR do PDF baixado.
- **Condição para enviar:** nenhum label com prefixo `Condomínio_{mesRef}-{valorId}` existe
  (nem `_E` nem `_P`).
- **Se envia:** cria label `Condomínio_{mesRef}-{valorId}_Enc_em_{hoje}_E` na thread da Premier.
- **Nunca reenvia** por este fluxo.

### Fluxo P — `verificarPastaManual()`

- A presença do PDF na pasta é a autorização de envio.
- Por PDF: verifica se existe label com prefixo `Condomínio_{mesRef}-{valorId}`.
  - Não existe → `Enc`
  - Existe → `Reenc`
- Cria label flutuante (sem thread): `Condomínio_{mesRef}-{valorId}_{tipo}_em_{hoje}_P`.
- Pode ser executado sem limite de vezes.

### Busca de label por prefixo

`GmailApp.getUserLabelByName()` exige nome exato — não serve para busca por prefixo.
Usar `GmailApp.getUserLabels()` + `filter` pelo prefixo desejado:

```javascript
function labelExiste(prefixo) {
  return GmailApp.getUserLabels()
    .some(l => l.getName().startsWith(prefixo));
}
```

---

## Tratamento de Duplicatas (Fluxo P)

Antes de enviar, agrupar PDFs da pasta por `(mesRef, valorId)`:

### Duplicata total — mesmo mesRef E mesmo valorId

Todos os arquivos do grupo são cópias idênticas do mesmo boleto.
- Envia **apenas o primeiro** (por nome, ordem alfabética).
- Move **todos** para a lixeira.
- Cria **um único label** para o grupo.
- Registra no log: `Ação = Enc/Reenc | Detalhes = "N cópias descartadas"`.

### Duplicata parcial — mesmo mesRef, valorId diferente

São boletos distintos para o mesmo mês de vencimento (cenário raro mas possível).
- Envia um e-mail separado para **cada valorId**.
- Cada um recebe seu próprio label com o `valorId` correspondente.
- Ordem de envio: crescente por vencimento; em caso de empate, crescente por valor.

---

## OCR — `src/ocr.js`

### Técnica

Converter PDF em Google Doc via Drive API com `ocr: true`, ler o texto, apagar Doc temporário.
Requer habilitar **Drive API** como serviço avançado no projeto GAS.

```javascript
function _extrairTexto(pdfBlob) {
  const resource = { title: '_ocr_tmp', mimeType: 'application/vnd.google-apps.document' };
  const file = Drive.Files.insert(resource, pdfBlob, { ocr: true, ocrLanguage: 'pt' });
  const texto = DocumentApp.openById(file.id).getBody().getText();
  DriveApp.getFileById(file.id).setTrashed(true);
  return texto;
}
```

### Campos extraídos e padrões (base: PDF Premier real)

| Campo      | Regex                                              | Fonte no PDF               |
|------------|----------------------------------------------------|----------------------------|
| Premier?   | `/PREMIER GARANTIDORA/i`                           | Cabeçalho (página 1 e 2)   |
| Condomínio?| `/CONDOMINIO RESIDENCIAL VIDA PLENA/i`             | Beneficiário               |
| Vencimento | `/Vencimento[:\s]+(\d{2}\/\d{2}\/\d{4})/i`        | Página 2 (forma mais limpa) |
| Valor      | `/Valor do documento\s*[\r\n]+([\d.,]+)/i`         | Bloco do boleto (página 1)  |

`valorId` = valor sem separadores: `"593,72".replace(/[.,]/g, '')` → `"59372"`.

`mesRef` = derivado do vencimento: vencimento `13/04/2026` → `2026-04`.

### Alerta por falha de OCR

Se `isPremier === false` ou `vencimento` não extraído:

```javascript
GmailApp.sendEmail(
  Session.getActiveUser().getEmail(),
  `⚠️ OCR falhou — ${arquivo.getName()}`,
  `Não foi possível identificar o arquivo como boleto da Premier ou extrair a data de vencimento.\n\nArquivo: ${arquivo.getName()}\nProblema: ${motivo}\n\nVerifique manualmente.`
);
```

O arquivo **não** é movido para a lixeira. Permanece na pasta para intervenção manual.

---

## Log — `src/log.js`

### Localização

Planilha Google Sheets criada automaticamente na primeira execução dentro de `PASTA_MANUAL_ID`.
Nome configurável em `config.js` (`LOG_PLANILHA_NOME`). ID da planilha salvo em
`PropertiesService` para não precisar buscar por nome a cada execução.

### Colunas

| Coluna      | Tipo     | Exemplo                        |
|-------------|----------|--------------------------------|
| `Timestamp` | DateTime | `2026-04-10 08:02:31`          |
| `Função`    | String   | `verificarPastaManual`         |
| `MesRef`    | String   | `2026-04`                      |
| `ValorId`   | String   | `59372`                        |
| `Arquivo`   | String   | `boleto_abril.pdf` / `—`       |
| `Ação`      | String   | `Enc` / `Reenc` / `Skip` / `Alerta` / `ErrOCR` |
| `Origem`    | String   | `E` / `P`                      |
| `Detalhes`  | String   | `OK` / `Label P já existe` / `2 cópias descartadas` |

**Ambos os fluxos** (E e P) registram nesta planilha.

### API

```javascript
function registrarLog({ funcao, mesRef, valorId, arquivo, acao, origem, detalhes }) { ... }
```

---

## Alterações por arquivo

### `src/config.js` — novas constantes

```javascript
// ── Fluxo manual (boleto via WhatsApp → pasta Drive) ────────────
// ID obtido da URL ao abrir a pasta no Drive: drive.google.com/drive/folders/{ID}
const PASTA_MANUAL_ID         = '1-LITJk2RHnlXPwrMy_XwhsLFzTZjqVRu';
const DIAS_VERIFICACAO_MANUAL = [10, 11, 12, 13];

// ── Log ──────────────────────────────────────────────────────────
const LOG_PLANILHA_NOME = 'Log_Condominio_Automacao';
```

### `src/ocr.js` (novo)

Exporta:
- `extrairDadosBoleto(pdfBlob, nomeArquivo)` → `{ mesRef, valorId, vencimento, valor }` ou lança erro com `sendEmail` de alerta.

### `src/log.js` (novo)

Exporta:
- `registrarLog(dados)` → localiza ou cria planilha, adiciona linha.

### `src/manual.js` (novo)

Exporta:
- `verificarPastaManual()` — fluxo completo descrito acima.

### `src/repasse.js` — mudanças

1. `repassarBoleto()`: após baixar PDF, chama `extrairDadosBoleto()` para obter `mesRef`
   e `valorId`; usa label unificado; registra no log.
2. `installTriggers()`: atualizado para 5 triggers (ver abaixo).

### `src/appsscript.json` — escopos adicionados

```json
"https://www.googleapis.com/auth/drive",
"https://www.googleapis.com/auth/spreadsheets"
```

### `src/repasse.js` — `installTriggers()` completo (5 triggers)

```javascript
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // T1 — repasse via e-mail diário (6h–7h)
  ScriptApp.newTrigger('repassarBoleto')
    .timeBased().everyDays(1).atHour(6).create();

  // T2 — alerta de pendência diário (8h–9h)
  ScriptApp.newTrigger('verificarPendencia')
    .timeBased().everyDays(1).atHour(8).create();

  // T3/T4/T5 — verificação da pasta manual (dias 10-13, 8h / 12h / 16h)
  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(12).create();
  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(16).create();

  Logger.log('Triggers instalados: 5');
  ScriptApp.getProjectTriggers().forEach(t =>
    Logger.log(`  - ${t.getHandlerFunction()} @ ${t.getTriggerSource()}`)
  );
}
```

Total: 5 triggers (limite GAS: 20).

---

## Arquitetura de chamadas

```
repassarBoleto()          [repasse.js]
├── buscarBoletoPremer()  [gmail.js]
├── extrairLinkBoleto()   [gmail.js]
├── baixarPdf()           [pdf.js]
├── extrairDadosBoleto()  [ocr.js]   ← NOVO
├── montarEmailRepasse()  [repasse.js]
├── labelExiste()         [repasse.js]
└── registrarLog()        [log.js]   ← NOVO

verificarPastaManual()    [manual.js]
├── extrairDadosBoleto()  [ocr.js]
├── montarEmailRepasse()  [repasse.js]
├── labelExiste()         [repasse.js ou util]
└── registrarLog()        [log.js]
```

---

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| OCR falha em identificar Premier | Alerta e-mail; arquivo permanece na pasta |
| OCR não extrai vencimento | Alerta e-mail; arquivo permanece na pasta |
| Pasta Drive não encontrada | GAS lança exceção; registrado em Execuções |
| Falha no envio do e-mail | Label não criado; arquivo não vai para lixeira; próxima execução tenta novamente |
| Múltiplas cópias idênticas | Envia 1, exclui todas, log registra quantidade descartada |

---

## Verificação e testes

1. Setar `DRY_RUN = true` em `config.js`
2. Colocar PDF de teste na pasta Drive
3. Garantir que o dia atual está em `DIAS_VERIFICACAO_MANUAL` (ajustar se necessário para teste)
4. Executar `verificarPastaManual()` manualmente no editor GAS
5. Verificar log: linha `Enc | P | [DRY_RUN]` na planilha
6. Verificar que o arquivo **não** foi para a lixeira (DRY_RUN não deleta)
7. Setar `DRY_RUN = false`, executar novamente
8. Verificar: e-mail chegou, arquivo na lixeira, label criado, linha no log
9. Executar uma terceira vez → log: `Reenc | P`
10. Executar `repassarBoleto()` → log: `Skip | E | Label P já existe`
11. Executar `installTriggers()` para ativar os 5 triggers
