# Snake (Traditional, Levels e Souls)

Jogo Snake em HTML/CSS/JS puro, sem dependências externas.

## Como rodar
1. Abra um terminal na pasta do projeto.
2. Suba um servidor estático:

```bash
python3 -m http.server 8000
```

3. Abra no navegador: `http://localhost:8000`

## Modo desenvolvedor (Dev Mode)
- Atalho: `F2` (abre/fecha o painel de códigos).
- Os códigos são **case-insensitive**.
- Digite o código no painel e pressione `Enter` ou clique em `Executar`.
- Escopo: uso local para QA/testes (sem backend/autenticação).

### Catálogo de códigos
1. `SOULS_FLOOR <n>`
Exemplo: `SOULS_FLOOR 9`
Pula para o floor absoluto `n` no modo Souls.

2. `SOULS_BOSS <1|2|3|FINAL>`
Exemplo: `SOULS_BOSS FINAL`
Pula para o boss do ciclo atual (`3/6/9/12`).

3. `SCREEN <MENU|PLAYING|GAMEOVER>`
Exemplo: `SCREEN GAMEOVER`
Força a tela atual para teste de UI.

4. `RUNAS_CARREGADAS <n>`
Exemplo: `RUNAS_CARREGADAS 120`
Define runas em risco da run Souls atual.

5. `RUNAS_CARTEIRA <n>`
Exemplo: `RUNAS_CARTEIRA 500`
Define runas da carteira persistente do perfil Souls.

6. `DESBLOQUEAR_PROXIMA`
Desbloqueia a próxima cobra da ordem fixa, ignorando custo/requisito.

7. `DESBLOQUEAR_TODAS`
Desbloqueia todas as cobras do modo Souls.

8. `RECOMPENSA_AGORA`
Abre imediatamente o modal de recompensa com 3 opções válidas.

9. `RESET_PERFIL_SOULS`
Reseta perfil Souls persistido (`wallet`, desbloqueios, eco, etc.).

## Sidebars
- Esquerda: controles, legenda, sistemas, modos e enciclopédia de chefes.
- Direita: poderes coletados na run Souls (nome, stack e descrição).

## Testes
```bash
node --test
```
