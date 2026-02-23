# AGENTS.md - Guia Operacional para Agentes de IA

Este arquivo define regras práticas para desenvolvimento neste repositório.
Objetivo: aumentar previsibilidade, reduzir regressão e acelerar entregas.

## 1) Objetivo do arquivo

Use este guia para:
- entender o contrato técnico do projeto;
- executar mudanças com impacto controlado;
- validar qualidade antes de concluir uma tarefa.

## 2) Stack e restrições

- Stack: HTML, CSS e JavaScript puros.
- Runtime: navegador (sem backend).
- Testes: `node --test`.
- Não adicionar dependências novas sem necessidade real e justificativa explícita.
- Preservar UI minimalista já existente (sem redesign completo fora de escopo).

## 3) Arquitetura e fontes da verdade

Principais módulos:
- `src/snake-logic.js`: núcleo clássico (movimento, colisão, comida, fila de direção).
- `src/snake-modes.js`: orquestração de modos (`traditional`, `levels`, `souls`) e regras avançadas.
- `src/souls-data.js`: catálogo e constantes (bosses, poderes, cobras, economia).
- `src/souls-profile.js`: perfil persistente Souls (wallet, unlocks, eco, bossKills).
- `src/dev-codes.js`: parser de códigos do modo desenvolvedor.
- `src/souls-loop.js`: helpers do loop fixed-step/accumulator.
- `src/souls-ui-helpers.js`: helpers puros de UI (chaves de render etc.).
- `src/main.js`: integração de UI, input, loops (`setInterval` e `RAF`) e fluxos de tela.

UI e layout:
- `index.html`: estrutura de telas, HUD, sidebars, modal de recompensa, painel dev.
- `styles.css`: tema, layout responsivo e estilos do board/componentes.

Testes:
- `tests/*.mjs` é obrigatório para regressão.

## 4) Fluxo padrão de trabalho

Sequência padrão:
1. Explorar o código existente e mapear impacto real.
2. Planejar mudanças com escopo explícito.
3. Implementar o mínimo necessário para cumprir requisito.
4. Rodar testes e revisar regressões.
5. Reportar resultado com arquivos alterados, riscos e validação.

## 5) Regras de edição

- Não quebrar APIs públicas existentes sem solicitação explícita.
- Evitar refactors amplos quando correção pontual resolve.
- Manter compatibilidade com modos legados (`traditional` e `levels`).
- Em modo `souls`, preservar regras de progressão e persistência vigentes.
- Não remover funcionalidades existentes para introduzir nova feature.
- Não alterar contrato de dados persistidos sem sanitização/migração compatível.

## 6) Qualidade e validação

Após qualquer mudança de código, executar:

```bash
node --test
```

Checklist mínimo manual:
- fluxo `menu -> start -> pause/resume -> restart -> back to menu`;
- HUD coerente com modo atual;
- controles teclado e touch funcionais;
- no Souls: reward modal, floors, countdown, runas e sidebars.

Se algo não puder ser validado, registrar explicitamente na entrega.

## 7) Guardrails de UI/UX

- Manter consistência com o estilo atual.
- Reusar variáveis e padrões de tema existentes (light/dark).
- Garantir responsividade desktop/mobile.
- Evitar animações extras não solicitadas.
- Evitar aumentar complexidade visual sem benefício funcional claro.

## 8) Persistência e segurança

- Persistência Souls usa localStorage versionado (`snake-souls-profile-v1`).
- Sempre sanitizar perfil carregado antes de uso.
- Em caso de dado inválido/corrompido, cair para default seguro.
- Nunca assumir que campos opcionais existem sem fallback.

## 9) Padrão de documentação de mudanças

Sempre que alterar comportamento relevante:
- atualizar `README.md` no mesmo PR/tarefa;
- descrever impacto por modo de jogo;
- listar novos atalhos/comandos/flags quando houver;
- manter exemplos de execução/teste atualizados.

## 10) Definição de pronto (DoD)

Uma tarefa só está pronta quando:
- escopo solicitado foi implementado integralmente;
- testes aplicáveis passaram;
- fluxos manuais críticos foram verificados;
- documentação está consistente com o estado real do código;
- resposta final inclui limitações/riscos pendentes (se existirem).

## 11) Anti-patterns a evitar

- editar múltiplos subsistemas sem necessidade;
- introduzir regra de gameplay sem teste;
- hardcode sem constante/catalogação quando já existe módulo de dados;
- duplicar lógica já coberta por helpers/engine;
- concluir tarefa sem validar regressão básica.
