# Changelog

## v0.14.3 - 2026-02-25
- Ajuste de balanceamento no Souls: perseguição de inimigos deixou de herdar buffs da cobra (poderes/variante), reduzindo efeito de aceleração “junto do player”.
- Minions em fases normais agora usam cadência própria de movimento, sem acoplar ao boost instantâneo da cobra.
- Testes atualizados para validar que minions continuam ativos sem boss e que o boost do player não acelera a cadência dos minions.

## v0.14.2 - 2026-02-25
- Bosses e minions do modo Souls agora usam perseguição em 8 direções, incluindo movimento diagonal.
- Corrigido: minions em floors normais iniciais voltaram a se mover mesmo sem boss ativo na fase.
- Testes do Souls atualizados para cobrir perseguição diagonal e movimentação de minions em fase normal.

## v0.14.1 - 2026-02-25
- Ajuste de contraste visual no tema (paleta do board/HUD) para separar melhor entidades críticas durante a run.
- Legenda do jogo atualizada com elementos compostos (ícone + quadrado interno) para melhorar distinção visual dos tipos de bloco.
- Troca de fase no Souls agora preserva os obstáculos já visíveis na tela atual (sem regeneração abrupta no momento da transição).
- Progressão de minions revisada: floor 1 sem minions, crescimento linear por bloco até boss, manutenção dentro do bloco e reset após boss.
- Testes do modo Souls atualizados para validar curva nova de minions, reset pós-boss e preservação de obstáculos no pós-recompensa.

## v0.14.0 - 2026-02-25
- Progressão do modo Souls alterada para fluxo contínuo: sem freeze e sem countdown ao concluir objetivo de fase.
- Transição de floor no Souls agora é imediata e em-place (mantém posição/controle da cobra), com mensagem curta não bloqueante.
- Minions habilitados também em fases normais com curva progressiva leve e ajuste automático de quantidade na troca de fase.
- Boss continua abrindo modal de recompensa; após escolha do poder, avanço para próximo floor é imediato.
- Testes de Souls atualizados para validar progressão contínua, mensagem não bloqueante e regras novas de minions.
- Documentação (`README.md`) e versão exibida no menu atualizadas para `v0.14.0`.

## v0.13.0 - 2026-02-25
- Souls definido como modo principal visível; `Traditional` e `Levels` agora ficam ocultos e são liberados por easter egg (sequência Konami).
- Reestilização visual completa para tema dark único com atmosfera mais densa.
- Loop/render do Souls ajustado com interpolação visual e cache de camada estática do grid para maior suavidade.
- IA dos bosses revisada para perseguição contínua, incluindo ciclo de boost do Caçador (`0.7s boost`, `1.2s fadiga`, `5s recarga`).
- Escalonamento de minions atualizado por boss/ciclo com teto de 8.
- Documentação atualizada (`README.md`) e nova suíte de testes para easter egg e IA de bosses.

## v0.12.0 - 2026-02-23
- Removido o toggle de tema da tela principal; seleção de tema permanece apenas em `Configurações`.
- Renomeado o jogo para `Snake Souls` no título da página e cabeçalho principal.
- Criada a regra operacional em `no.js.md` exigindo atualização obrigatória do changelog a cada alteração relevante.
