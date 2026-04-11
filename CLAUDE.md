# Encaminhamento_Condominios

Automação em Google Apps Script para recebimento e repasse mensal do boleto de
condomínio da seguradora Premier para a imobiliária Pirâmid Imóveis, com alerta
de não-recebimento. Projeto versionado via clasp + GitHub.

---

## ⚡ ICA Context System — leia ANTES de qualquer ação

Este projeto usa **Indexed Context Architecture (ICA)**. Todo o conhecimento do
projeto está em fragmentos atômicos indexados em `.ica/`. Nunca assuma contexto
— carregue os fragmentos relevantes.

### Protocolo obrigatório de início de sessão

```
1. Ler .ica/manifest.yaml        → navegue pelo índice completo
2. Ler .ica/context-map.yaml     → entenda dependências entre fragmentos
3. Carregar APENAS os fragmentos relevantes à tarefa atual
4. Nunca carregar todos os fragmentos de uma vez
```

### Quando carregar cada fragmento

| Tarefa | Fragmentos a carregar |
|---|---|
| Setup inicial do ambiente | `guides/setup-clasp`, `guides/github-setup` |
| Implementar `repassarBoleto()` | `specs/repasse-spec`, `specs/email-spec`, `specs/config-spec` |
| Implementar `verificarPendencia()` | `specs/alerta-spec`, `specs/config-spec` |
| Dúvida sobre o PDF/link | `decisions/pdf-strategy`, `specs/repasse-spec` |
| Configurar triggers | `guides/setup-triggers` |
| Escrever testes | `guides/testing`, + spec relevante |
| Qualquer implementação | `decisions/tooling-clasp` (decisão base) |

---

## Estrutura do projeto

```
Encaminhamento_Condominios/
├── CLAUDE.md                        ← você está aqui
├── .ica/
│   ├── manifest.yaml                ← índice de todos os fragmentos
│   ├── context-map.yaml             ← grafo de relacionamentos
│   └── fragments/
│       ├── decisions/               ← por quê fizemos cada escolha
│       ├── specifications/          ← o quê cada função faz
│       ├── guides/                  ← como instalar, configurar, testar
│       └── tools/                   ← schemas de ferramentas externas
├── src/
│   ├── config.js                    ← constantes e parâmetros (NUNCA hardcode)
│   ├── gmail.js                     ← busca e parsing de e-mail
│   ├── pdf.js                       ← download do PDF do boleto
│   ├── repasse.js                   ← função principal repassarBoleto()
│   └── alerta.js                    ← função verificarPendencia()
├── appsscript.json                  ← manifest do GAS (gerado pelo clasp)
├── .clasp.json                      ← vincula ao projeto Apps Script (no .gitignore)
├── .gitignore
└── README.md
```

---

## Regras inegociáveis de implementação

- **Nunca hardcode** remetente, destinatário, assunto ou datas — tudo em `config.js`
- **Idempotência obrigatória** — a função de repasse deve ser segura para rodar N vezes no mesmo mês sem duplicar envios (controle via Gmail labels)
- **Contrato tem data-fim parametrizável** — ambas as funções abortam silenciosamente após `CONTRATO_FIM`
- **Modularidade** — cada arquivo `src/` tem responsabilidade única; `repasse.js` orquestra, nunca implementa diretamente
- **Logs sempre** — toda execução com consequência (envio, erro, skip) deve chamar `Logger.log()`

---

## Comandos úteis

```bash
# Instalar clasp globalmente
npm install -g @google/clasp

# Autenticar com Google
clasp login

# Clonar projeto GAS existente
clasp clone <scriptId>

# Push do código local para o GAS
clasp push

# Abrir o editor web do GAS
clasp open

# Ver logs de execução
clasp logs
```

---

## Variáveis de ambiente sensíveis

`.clasp.json` contém o `scriptId` — **não versionar**. Está no `.gitignore`.
Dados de configuração não-sensíveis ficam em `src/config.js` (versionado).
