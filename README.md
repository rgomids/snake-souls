# Snake - Traditional, Levels e Souls

Jogo Snake em HTML/CSS/JS puro, sem dependências externas de runtime.

Este projeto contém:
- Modo **Traditional** (clássico)
- Modo **Levels** (progressão por objetivo)
- Modo **Souls** (floors, ciclos, bosses, runas, eco e build de poderes)
- Painel de desenvolvimento (atalho `F2`) para QA local

## 1) Visão geral

O jogo roda no navegador com assets locais e engine em JavaScript puro.

### Modos disponíveis
- `Traditional`: loop clássico infinito, foco em sobrevivência e score.
- `Levels`: metas por nível, aumento de dificuldade, barreiras/inimigo e power-up de escudo.
- `Souls`: progressão por floors/ciclos, bosses em andares específicos, recompensa de poder e economia de runas.

## 2) Pré-requisitos e execução

### Pré-requisitos
- Navegador moderno (Chrome, Edge, Firefox, Safari).
- Python 3 para servidor estático local.
- Node.js para rodar testes (`node --test`).

### Rodar localmente (recomendado)
1. Entre na pasta do projeto.
2. Suba um servidor estático:

```bash
python3 -m http.server 8000
```

3. Abra no navegador:
- `http://localhost:8000`

### Alternativas mínimas de servidor estático
Se você já tiver no ambiente:

```bash
python -m http.server 8000
```

ou

```bash
php -S localhost:8000
```

## 3) Controles

### Teclado
- Movimento: `Setas` ou `WASD`
- Pausar/retomar: `Espaço` ou `P`
- Reiniciar run atual: `R`
- Abrir/fechar Dev Mode: `F2`

### Controles on-screen/mobile
- Menu inicial: selecione o modo pelos botões com ícones e clique em `Iniciar`.
- No Souls em gameplay ativo: D-pad fixo e botão de pausa flutuante.
- Fora do modo imersivo: botões direcionais `Up/Left/Down/Right` abaixo do board.
- Botões de ação: `Pause`, `Restart`, `Back to menu`.

### Observação de velocidade (estado atual)
- Há redução global de velocidade base da cobra.
- Se o jogador mantém pressionada a tecla da **direção atual**, a cobra volta para a cadência base original dessa direção (sem boost extra).

## 4) Modos de jogo

## Traditional
- Grid fixo com movimentação por ticks.
- Colisão com parede ou corpo: game over.
- Comida aumenta score e tamanho.

## Levels
- Progressão por `nível` com meta de progresso por fase.
- A dificuldade aumenta com nível (tick mais curto, mais barreiras, inimigo em níveis avançados).
- Power-up de escudo aparece em níveis mais altos.
- Escudo protege contra barreira/inimigo (não protege parede/corpo).

## Souls
- Progressão por andares (`floor`) e ciclos.
- Mundo infinito (sem colisão de borda) com câmera centralizada na cobra.
- Viewport dinâmico por câmera com foco base `21` (normal) e `31` (boss/final), expandindo por proporção da tela para preencher o modo imersivo.
- Bosses em floors `3`, `6`, `9`; boss final em `12`.
- Após completar floor `12`, inicia próximo ciclo com escalada de dificuldade.
- Conclusão de estágio: mensagem de conclusão + countdown visual `3,2,1`.

## 5) Sistemas do modo Souls

### Estrutura de fase
- `normal`: objetivo por comida.
- `boss` / `final_boss`: objetivo por coleta de sigilos.
- Em boss, o sigilo nasce fora da tela (distância mínima) e uma seta indica a direção.
- Em estágio normal, quando a comida estiver fora da viewport, a mesma seta aponta o objetivo.

### Runas
- `carriedRunes` (em risco): acumuladas durante a run.
- `walletRunes` (carteira persistente): mantidas no perfil.
- Checkpoint de boss: runas em risco são transferidas para carteira.

### Eco
- Ao morrer, runas em risco viram **eco** pendente no perfil.
- Na próxima run (em fase normal elegível), o eco pode spawnar no mapa.
- Ao coletar eco, as runas voltam para `carriedRunes`.

### Recompensa de boss
- Após vitória de boss, abre modal com 3 poderes.
- Escolha 1 poder para a build.
- É possível reroll **1 vez** por boss, custo de `30` runas em risco.
- Fluxo de transição: recompensa -> mensagem de estágio -> countdown -> próximo floor.

### Poderes e stacks
Pool atual:
- `Fôlego` (máx. 3)
- `Muralha` (máx. 2)
- `Ímã` (máx. 1)
- `Voracidade` (máx. 2)
- `Passo Fantasma` (máx. 1)
- `Runa Viva` (máx. 2)

A sidebar direita mostra somente poderes com stack `> 0`.

### Cobras jogáveis e desbloqueio
- Inicialmente desbloqueada: `Básica`.
- Ordem de desbloqueio: `Veloz -> Tanque -> Vidente`.
- Custos: `120 / 220 / 360` runas (carteira).
- Exige elegibilidade por vitórias de boss final.

## 6) Bosses (resumo técnico-jogável)

### Caçador
- Footprint: `2x2`
- Comportamento: perseguição agressiva.

### Carcereiro
- Footprint: `2x2`
- Comportamento: patrulha + pulsos de hazard.
- Regra adicional: entra em perseguição quando a cabeça está a distância Manhattan `<= 3`; ao afastar, volta para patrulha.

### Espectro
- Footprint: `2x2`
- Comportamento: pressão com teleporte periódico.
- Nerf aplicado: velocidade efetiva reduzida (penalidade adicional de tick).
- Telegraph: antes de teleporte, marca alvo no board por `1s`.
- Alvo do teleporte: tenta posição próxima da cabeça (distância Manhattan `<= 3`), com fallback para posição válida global.

### Abissal (boss final)
- Footprint: `3x2` (horizontal fixa)
- Comportamento: mistura padrões dos outros bosses, incluindo pressão com hazards/teleporte.

## 7) HUD e sidebars

## Sidebar esquerda
Contém:
- Controles rápidos
- Legenda dos blocos (head, corpo, comida, barreira, inimigo/boss, power-up, sigilo, hazard, eco)
- Explicações dos sistemas (runas, poderes, eco)
- Resumo dos modos de jogo
- Enciclopédia de chefes desbloqueada por derrotas (com contador de vitórias)

## Área central
- Menu inicial centralizado com botões de modo (ícones dedicados por opção)
- Configuração de Souls (seleção de cobra/desbloqueio)
- No Souls ativo: board em tela cheia com overlays (seta de sigilo, mensagem e countdown)
- Em pause/game over Souls: HUD e sidebars retornam com animação de slide-in
- Modal de recompensa

## Sidebar direita
- Lista de poderes coletados na run Souls
- Exibe nome, stack atual/máximo e descrição

## 8) Modo Desenvolvedor (F2)

## Como usar
1. Pressione `F2` para abrir/fechar o painel.
2. Digite o código.
3. Pressione `Enter` ou clique em `Executar`.
4. Códigos são case-insensitive e aceitam espaços extras (normalização interna).

## Catálogo oficial de códigos (v1)

1. `SOULS_FLOOR <n>`
- Exemplo: `SOULS_FLOOR 9`
- Vai para floor absoluto `n` (mínimo 1).

2. `SOULS_BOSS <1|2|3|FINAL>`
- Exemplo: `SOULS_BOSS FINAL`
- Vai para boss do ciclo atual.

3. `SCREEN <MENU|PLAYING|GAMEOVER>`
- Exemplo: `SCREEN GAMEOVER`
- Força tela de UI para teste.

4. `RUNAS_CARREGADAS <n>`
- Exemplo: `RUNAS_CARREGADAS 120`
- Define runas em risco da run atual.

5. `RUNAS_CARTEIRA <n>`
- Exemplo: `RUNAS_CARTEIRA 500`
- Define runas persistentes da carteira.

6. `DESBLOQUEAR_PROXIMA`
- Desbloqueia próxima cobra Souls (ignora custo/requisito).

7. `DESBLOQUEAR_TODAS`
- Desbloqueia todas as cobras Souls.

8. `RECOMPENSA_AGORA`
- Abre modal de recompensa imediatamente (quando aplicável).

9. `RESET_PERFIL_SOULS`
- Reseta perfil Souls persistido para default seguro.

### Observações importantes
- Esses códigos são para QA local (sem backend/autenticação).
- Comando inválido não deve quebrar a run; o painel mostra feedback de erro.

## 9) Estrutura do projeto

```text
.
├── index.html
├── styles.css
├── src
│   ├── snake-logic.js
│   ├── snake-modes.js
│   ├── main.js
│   ├── souls-data.js
│   ├── souls-profile.js
│   ├── dev-codes.js
│   ├── souls-loop.js
│   └── souls-ui-helpers.js
└── tests
    ├── snake-logic.test.mjs
    ├── snake-modes.test.mjs
    ├── souls-mode.test.mjs
    ├── souls-world.test.mjs
    ├── souls-profile.test.mjs
    ├── souls-loop.test.mjs
    ├── souls-ui-helpers.test.mjs
    └── dev-codes.test.mjs
```

## 10) Testes

Rodar toda a suíte:

```bash
node --test
```

Cobertura em alto nível:
- lógica clássica
- orquestração de modos
- progressão/bosses do Souls
- perfil persistente Souls
- loop/accumulator do Souls
- parser de códigos de desenvolvimento
- helpers de UI do modal de recompensa

## 11) Troubleshooting

### Porta 8000 ocupada
Use outra porta:

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`.

### Alterações não aparecem
- Faça hard refresh do navegador (`Ctrl+F5` / `Cmd+Shift+R`).
- Verifique se servidor local está na pasta correta do projeto.

### Estado estranho no Souls (perfil localStorage)
- Use código dev `RESET_PERFIL_SOULS`.
- Ou limpe localStorage da origem `http://localhost:<porta>` no navegador.

### Painel Dev não abre
- Confirme foco fora de campos de input.
- Teste tecla `F2` com notebook/fn-lock quando necessário.

## 12) Limitações e próximos passos

Limitações atuais:
- Projeto totalmente client-side (sem backend/multiplayer).
- Balanceamento de bosses/poderes ainda é iterativo.
- Persistência local depende de localStorage do navegador.

Próximos passos possíveis:
- Ajustes finos de balanceamento por telemetria manual de QA.
- Melhorias adicionais de acessibilidade/UX (sem alterar o estilo minimalista atual).
