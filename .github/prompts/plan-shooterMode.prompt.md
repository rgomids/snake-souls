# Plan: Adicionar Modo Shooter (Substituindo Traditional)

O modo "traditional" é substituído por um **ShooterMode** — shoot 'em up com roguelike. A cobra mantém sua física de movimento (8 direções, RAF, câmera seguindo o jogador), mas em vez de comer comida, o jogador sobrevive a ondas de inimigos com auto-combate. Nenhum sistema existente (Souls, Levels) é alterado.

**Decisões tomadas:**
- Movimento livre 8 direções com RAF (igual ao Souls)
- Mundo infinito — câmera segue a cabeça
- Qualquer colisão de inimigo com qualquer segmento causa dano
- Deve ser o unico modo de jogo.

---

**Modelo de estado do corpo da cobra:**

```
[HEAD, WEAPON, LIFE, LIFE, ...]
```

- `HEAD`: se eliminada → game over
- `WEAPON` (índice 1): se atingida → `disabled=true`, timer de 5s; ao expirar → regenera colada à cabeça
- `LIFE` (índice 2+): se atingida → removida permanentemente; nunca volta
A cobra poderá ter multiplos segmentos de vida e arma, sempre que tiver mais de uma arma, ela será adicionada logo apos a primeira arma, e tambem poderá ser regenerada caso haja mais de uma arma, porem stackando o tempo de regeneração, ou seja, para cada segmento de arma atingido, o tempo de regeneração é adicionado ao timer, e quando o timer expirar, apenas um segmento de arma é regenerado, e assim por diante.

Para armas, inimigos, habilidades, vamos utilizar json's para configuração, de visual, hp, velocidade, etc, sendo carregado apartir dos arquivos json na pasta `src/data/`.

Armas, inimigos, todos devem ter simbolos diferentes.

A cobra, deve manter seu corpo base, cada arma tem uma animação e um simbolo diferente, cada inimigo tem uma forma geométrica diferente e a cor é configurada no arquivo json relacionado, e cada projétil tem um simbolo diferente, para facilitar a identificação visual.

---

## Steps

Utilize isso como uma referencia, todos os arquivos devem ser adiiconado seguindo rigidamente os principios do SOLID.

### 1. Criar `src/data/weapon-catalog.js`
Definição imutável de armas (espada: range `2`, cooldown `800ms`, dano `1`); segue padrão de `PowerCatalog`.

### 2. Criar `src/modes/shooter/systems/body-system.js`
`BodySystem` com funções puras:
- `applyDamageToSegment(snake, hitIndex)` → retorna novo array de segmentos + evento (`"game_over"` | `"weapon_disabled"` | `"life_lost"`)
- `tickWeaponRegen(state, deltaMs)` → decrementa `weaponRegenMs`; quando <= 0 e weapon estiver `disabled`, insere segmento weapon de volta no índice 1

### 3. Criar `src/modes/shooter/systems/weapon-system.js`
`WeaponSystem`:
- `tick(state, enemies, deltaMs)` → para cada segmento `type === "weapon"` e não-disabled, verifica inimigos dentro do `range`; ao encontrar, cria projétil se `attackCooldownMs <= 0`
- `getActiveWeapons(snake)` → filtra segmentos weapon ativos

### 4. Criar `src/modes/shooter/systems/projectile-system.js`
`ProjectileSystem`:
- `tick(projectiles, enemies, deltaMs)` → mover projéteis, verificar colisões com inimigos, retornar `{ projectiles, enemies, events }`
- Cada projétil: `{ id, x, y, dx, dy, speedCellsPerSec, damage, ttlMs }`

### 5. Criar `src/modes/shooter/systems/wave-system.js`
`WaveSystem`:
- `tick(wave, elapsedMs, deltaMs)` → gerencia cooldown de spawn; retorna lista de inimigos a spawnar
- Curva de dificuldade: `waveNumber * 3 + floor(elapsedMs/30000)` inimigos por onda; velocidade aumenta a cada onda
- Entre ondas: countdownMs de 3s
- Inimigos: `{ id, x, y, hp, maxHp, speed, style, direction }`; usam lógica de `EnemyAiSystem` existente para movimento

### 6. Criar `src/modes/shooter/shooter-state.js`
Funções puras `createShooterState(opts)` e `stepShooterState(state, { deltaMs, rng })`:
- Integra `BodySystem`, `WeaponSystem`, `ProjectileSystem`, `WaveSystem`
- Colisão inimigo-cobra: detecta qual segmento foi atingido → chama `BodySystem.applyDamageToSegment`
- Inimigos com `hp <= 0` são removidos e pontuação incrementada
- Câmera: `camera.centerX/Y` segue `snake[0]` a cada step

### 7. Criar `src/modes/shooter/shooter-mode.js`
`ShooterMode extends IGameMode`:
- `id` → `"traditional"` (para manter compatibilidade com menu e `GameApp`)
- `step({ deltaMs, rng })`, `queueDirection`, `togglePause`, `restart`, `getState()`
- `getState()` expõe: `{ mode: "traditional", snake, enemies, projectiles, wave, score, isGameOver, isPaused, width, height, camera }`

### 8. Modificar `src/data/constants.js`
Adicionar:
- `WEAPON_REGEN_MS = 5000`
- `SHOOTER_FIXED_STEP_MS = 1000/60`
- `WAVE_COUNTDOWN_MS = 3000`
- `WAVE_INITIAL_ENEMIES = 3`

### 9. Modificar `src/render/board-renderer.js`
Adicionar rendering para o modo shooter:
- Segmentos da cobra coloridos por tipo: cabeça (vermelho), weapon (dourado/brilhante), weapon-disabled (cinza piscando), life (verde)
- Projéteis: quadrado pequeno amarelo com trail
- Inimigos: vermelho com barra de HP acima
- Indicador de onda (texto no canto do board durante countdown)

### 10. Modificar `src/render/hud-renderer.js`
Quando `mode === "traditional"`:
- Mostrar `wave.number` no campo de nível (reutiliza `levelValueEl`)
- Mostrar vidas restantes (`snake.filter(s => s.type === "life").length`) em `levelProgressEl`
- Mostrar status da weapon (`weaponRegenMs > 0 ? "5.0s" : "OK"`) em `shieldTimeEl`

### 11. Modificar `src/main.js`
Importar `ShooterMode`; trocar o builder do modo "traditional" no `GameApp` para usar `ShooterMode`.

### 12. Modificar `src/game/game-app.js`
Garantir que o modo "traditional" use `startRaf()` (igual ao Souls) em vez de `startTick()`; ou verificar se o game-app já roteia isso pela presença de `shouldRunRaf`.

---

## Verification

- Iniciar o modo "traditional" → cobra aparece com 3 segmentos (cabeça vermelha, weapon dourada, life verde)
- Inimigo chega perto → projétil disparado automaticamente, acerta inimigo, inimigo some
- Onda 1 completa → tela de countdown 3s → onda 2 com mais inimigos/velocidade
- Inimigo colide com `LIFE` segment → snake encurta, segmento some permanentemente
- Inimigo colide com `WEAPON` segment → weapon fica cinza/piscando por 5s → reaparece; durante 5s nenhum ataque
- Inimigo colide com `HEAD` → `isGameOver = true`
- Testes existentes (`snake-modes.test.mjs`, `souls-mode.test.mjs`) continuam passando

---

## Design Notes

- `ShooterMode.id` retorna `"traditional"` para não precisar alterar o menu/HTML/GameApp — nova funcionalidade, zero breaking change na camada de UI
- Reutiliza `EnemyAiSystem.DefaultChaseStrategy` existente para movimentação de inimigos (evita duplicação)
- Projéteis usam coordenadas fracionárias (float) para movimento suave no RAF
