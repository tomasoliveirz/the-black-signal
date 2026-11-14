
# Percorre o jogo. Avalia cada escolha.

Revisão visual · versão 0.5 · capturas de 14 de Novembro de 2026. São imagens do jogo a correr, com plantas geradas a partir dos dados reais dos mapas.

Disponível no endereço HTTPS temporário abaixo. O caminho em tomasoliveira.xyz está preparado no VPS, mas o DNS público aponta actualmente para outro servidor.

Visita visual publicada

 · GitHub repository

Jogar a versão actual

Ler a passagem para outro agente

Descarregar os dados dos mapas

Versão para avaliação, ainda sem equilíbrio competitivo validado. Faltam partidas com seis pessoas, testes em vários equipamentos e validação prolongada da voz pela Internet.

## Menu, salas e selecção

A coluna esquerda contém identidade, entrada nas salas, idioma e definições. A direita contém os seis mapas e, depois de entrar, os jogadores, o início da partida e o chat. A intenção é manter o cenário visível enquanto preparas a sessão.

| Controlo | Comportamento real |
| --- | --- |
| Create public room | Cria uma sala nova que aparece na lista pública. Ficas como dono. |
| Create private room | Cria uma sala fora da lista, com código de convite aleatório. O código permite entrar; não é uma palavra-passe de conta. |
| Public room / Refresh | Lista salas públicas, jogadores, mapa e estado da partida. Actualizar pede a lista actual. |
| Room code | Um código escrito tem prioridade sobre o selector de sala pública quando carregas em Entrar. |
| Map cards | Permitem prever o mapa antes de entrar; o dono define o mapa antes da partida. A selecção fica bloqueada durante o jogo. |
| Start match | O dono inicia imediatamente. Bots preenchem os lugares activos livres. Ainda não existe confirmação de pronto por jogador. |
| Leave room | Sai da sessão. O papel de dono passa para outro jogador ligado, se existir. |

## Como uma partida funciona realmente

Existem seis lugares activos: quatro Operativos e dois Echoes. As pessoas ocupam lugares livres; os bots preenchem os restantes quando o dono inicia. Quem entra durante uma partida assiste e pode ocupar um lugar activo livre na seguinte. O servidor sorteia os papéis com aleatoriedade criptográfica e comunica-os em privado. Os Echoes conhecem o parceiro; os Operativos desconhecem os Echoes.

Todos começam numa de seis posições predefinidas perto da entrada. O lugar determina o spawn, não o papel secreto. Os spawns estão agrupados de propósito: o primeiro dia serve para observar e preparar em conjunto, com o combate desactivado.

| Relógio | Fase | O que muda |
| --- | --- | --- |
| Before 00:00 · 20 s | Preparação | Revelação do papel; movimento e acções bloqueados. |
| 00:00–05:00 | Dia 1 · 300 s | Recursos do sector 1. Tiros e garras não causam dano. |
| 05:00–06:00 | Noite 1 · 60 s | O combate desbloqueia e mantém-se disponível depois desta noite. Primeira oportunidade de transformação. |
| 06:00–09:30 | Dia 2 · 210 s | Desbloqueiam os recursos do sector 2; o sector 1 continua utilizável. |
| 09:30–10:40 | Noite 2 · 70 s | Nova transformação disponível para cada Echo. |
| 10:40–13:40 | Dia 3 · 180 s | Desbloqueiam os recursos do sector 3. Conclui o terceiro transmissor. |
| 13:40–16:00 | Caçada final · 140 s | A extração aquece durante 45 s. Os três transmissores têm de estar activos. Permanece 5 s na área verde. |
| After the result · 20 s | Resultado | A sala regressa ao lobby para outra partida. |

Reparar não adianta o relógio. Completar um objectivo não antecipa a primeira noite. O limite de 16 minutos exclui os 20 segundos de preparação. Uma vitória pode terminar a partida mais cedo. Nesta versão não existe construção de bases, economia de crafting ou construção de barricadas: transportas células de energia e reparas transmissores existentes.

## Seis mapas, um conjunto comum de regras

Todos os mapas usam três transmissores, 18 recolhas de recursos e 12 armários de sangue. As posições são fixadas pela seed do mapa, não voltam a ser sorteadas em cada ronda. As plantas seguintes usam posições e colisões reais desta versão. São plantas explicativas, não um minimapa já existente dentro do jogo.

Importante: abrir um sector activa as recolhas e interacções dessa zona. Não fecha portas físicas nem impede atravessar um sector posterior. Por isso, podes ver caixas vazias antes de os respectivos recursos desbloquearem. Isto precisa de uma indicação visual mais clara.

### Amberwood

A floresta de outono usa um trilho legível e a cabana como referência principal. Árvores e rochas quebram linhas de visão; as clareiras permitem encontrar grupos e observar comportamentos.

Cabana → Celeiro → Torre. A saída fica junto do mastro distante. A torre visual é uma referência; os pequenos geradores portáteis são os objectivos de reparação.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

### Hollow Mire

Uma floresta mais densa, com árvores mortas, cores frias e neblina mais forte. Favorece a discrição por esconder movimentos atrás da vegetação, mas mantém o trilho principal como eixo.

Trilho Sul → Bosque → Antena. A densidade é uma escolha de ambiente; é preciso avaliar a leitura dos recursos e a detecção de monstros neste cenário.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

### Frostpeak

A neve e o relevo mais elevado criam um mapa claro com silhuetas escuras. Pinheiros, montes de neve e rochas oferecem cobertura sem repetir a paleta quente da floresta.

Abrigo → Crista → Torre. O terreno afecta o movimento e as linhas de visão; o fundo branco pode competir com os indicadores claros das interacções.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

### Ashfall

Uma cidade abandonada organizada por uma rua. Fachadas, cabos, passeios e a estação de serviço substituem volumes anónimos por destinos reconhecíveis.

Lavandaria → Loja 24H → Armazém. Os edifícios dividem linhas de visão e oferecem cobertura lateral. Muitas fachadas são cenário e colisão, não interiores totalmente exploráveis.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

### Foundry 9

Uma nave industrial comprida, com estrutura elevada, cargas, tubagens e vias marcadas. As luzes quentes separam o espaço de jogo da cobertura escura.

Receção → Fornos → Manutenção. O eixo comprido original mantém-se. Este mapa teve resultados fracos para os bots Operativos e precisa de testes humanos antes de ser considerado equilibrado.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

### Marrow Mall

Um centro comercial importado, com lojas, quiosques, pilares e ramificações de serviço. Foram acrescentadas orientação e luz sem substituir a arquitectura principal.

Átrio → Galeria → Serviço. Os transmissores ficam em ramificações realmente acessíveis, em vez de todos no corredor principal. A largura reduzida continua a ser uma limitação; o mapa não foi reconstruído para ficar maior.

T = transmissor · C = célula de energia · A = munições · M = kit médico · F = sinalizador · losango rosa = sangue · pontos brancos = seis spawns · círculo verde = extração. As formas discretas são volumes de colisão.

Descarregar planta completa

## O que faz cada objecto

Aponta para um objecto próximo. A indicação E identifica a acção seleccionada. Ao premir E, esse alvo fica fixo durante o gesto: desviar o olhar interrompe o progresso e mudar para outro alvo exige largar E. O servidor verifica também distância, paredes, estado e inventário. Passar por cima de um recurso não o recolhe automaticamente.

| Objecto | Quantidade / função | Interacção e limites |
| --- | --- | --- |
| Célula de energia | 6 no total · 2 por sector | Recolhe com E até 1,9 m. Só transportas uma. R larga-a para outro jogador. Cada transmissor precisa de uma célula. |
| Transmissor | 3 no total · 1 por sector | Instala uma célula com E e mantém E até 2,6 m para reparar: 8 s sozinho ou 5 s com pelo menos dois Operativos. Os Echoes simulam a reparação sem acrescentar progresso. |
| Caixa de munições | 6 no total · 2 por sector | +3 tiros. Máximo de 12. Todos começam com 4 tiros. Só são gastos num disparo autorizado. |
| Kit médico | 3 no total · 1 por sector | Recolhe com E; Q recupera até 50 pontos de vida humana. Não te reanima depois de ficares abatido. |
| Sinalizador | 3 recolhas · cada jogador começa também com 1 | G lança para a frente, depois de desbloquear o combate. Dura 15 s; raio de 6 m; atordoa inicialmente os monstros durante 2 s com linha de visão; reduz para metade a velocidade dos monstros próximos. |
| Armário de sangue | 12 no total · 4 por sector | Só para Echoes, durante o dia. Mantém E durante 6 s para +30 de energia, até 100. Cada armário só é usado uma vez por ronda, globalmente. Deixa uma pista visível durante 40 s. |
| Jogador abatido | Alvo de reanimação ou execução | Forma humana: mantém E durante 5 s para reanimar com 50 de vida. Monstro: mantém E durante 2,5 s para executar. Dano, distância e interrupções afectam a acção. |
| Círculo de extração | Uma saída, com raio específico do mapa | Só na caçada final, após 45 s de aquecimento e com todos os transmissores activos. Um Operativo de pé permanece lá dentro 5 s. A primeira fuga dá vitória imediata a todos os Operativos. |
| Mastro, edifícios, árvores e adereços | Orientação, ambiente e cobertura | O mastro assinala a zona da saída. Edifícios e adereços sólidos bloqueiam movimento ou visão conforme as respectivas colisões. O cenário não pode ser desmontado nem transformado em barricadas. |

A célula extra em cada sector dá redundância: perder uma ou alguém a levar não deve bloquear automaticamente o objectivo. Uma célula largada numa posição inválida é recuperada para um ponto do sector. As caixas e os armários são sólidos, pelo que também afectam o movimento.

## Pistolas, Echoes, morte e vitória

A pistola usa um raio instantâneo validado pelo servidor, apontado pela câmara em terceira pessoa e novamente traçado a partir da posição dos olhos. Não simula uma bala em voo. Cada disparo válido gasta um tiro, tem intervalo de 0,38 s e alcance máximo de 60 unidades. Causa 30 de dano humano ou 25 ao monstro. Paredes e volumes dos jogadores interrompem o raio. Esta versão não tem carregadores, recolha de armas, multiplicador de tiro na cabeça ou regeneração de munições.

O fogo amigo fica activo quando o combate desbloqueia. Quatro tiros completos abatem um humano com 100 de vida; seis tiros gastam os 150 da forma monstruosa. Esgotar essa forma obriga o Echo a voltar a humano, tira-lhe a energia, atordoa-o 3 s e limita a vida humana a 40. Isto não mata definitivamente o Echo.

Um Echo precisa de pelo menos 50 de energia para se transformar, gasta 15 ao entrar na forma monstruosa e depois 0,9 por segundo enquanto transformado. O ganho passivo durante o dia é de 0,12 por segundo: cinco minutos parado dão apenas 36. Por isso, procurar um armário importa antes da primeira caçada. Há uma transformação por noite. Voltar cedo a humano com F não devolve essa oportunidade. A forma termina com a noite.

A garra causa 30 de dano, tem intervalo de 1,45 s e preparação de 0,22 s. Exige um alvo a menos de 2 m, à frente do monstro e com linha de visão. Quatro garras completas abatem um humano saudável. Pode atingir mais do que um alvo válido próximo dentro do arco frontal.

Ao chegar a zero de vida humana ficas abatido durante até 40 s. Podes rastejar e alguém em forma humana pode reanimar-te. Novos tiros normais não terminam imediatamente um abatido. Um monstro pode executar com E, ou morres quando termina o tempo de sangramento. A reanimação dá 50 de vida e 2 s de protecção contra dano de monstro; as acções ofensivas ficam bloqueadas nessa protecção. A morte passa-te a espectador. Não existe respawn a meio da ronda.

Os Operativos vencem ao evacuar pelo menos um Operativo, ou ao eliminar definitivamente ambos os Echoes depois de abrir o combate. Os Echoes vencem ao eliminar todos os Operativos sem fuga, ou ao atingir o limite final sem extração. Uma fuga válida no mesmo instante do limite tem prioridade sobre a derrota por tempo.

## Som que comunica o espaço

Os efeitos gravados incluem passos, disparos, tiro vazio, recolha, cura, reanimação, sinalizadores, transformação, impactos, transmissores e extração. O material dos passos varia por mapa: terra, neve, piso duro ou metal. O movimento humano agachado não emite passos. Outras acções, vozes próximas e máquinas continuam audíveis enquanto estás agachado.

Os efeitos no mundo e as vozes usam direcção HRTF e redução de volume com a distância. As paredes filtram e atenuam os emissores suportados. Os interiores acrescentam reverberação discreta. O ouvinte acompanha a orientação da câmara e o jogador controlado ou observado. Estas pistas ajudam a perceber onde há actividade; auscultadores facilitam a avaliação.

A voz exige activação voluntária. Activa o microfone nas definições e mantém Z durante o jogo. O servidor encaminha os frames apenas para pessoas vivas ou abatidas da mesma sala, num raio de 22 m. Mortos, evacuados e espectadores não recebem nem transmitem voz de proximidade da partida. Podes desligar a escuta ou silenciar pessoas na lista. Abrir a página não pede autorização de microfone.

As três faixas fornecidas para o lobby são baralhadas sem repetição imediata. A música toca no menu e na espera, desaparece gradualmente ao iniciar a partida e regressa na espera. Podes mudar de faixa e ajustar a música independentemente dos efeitos, ambiente e voz. Os browsers exigem uma interacção inicial para reproduzir áudio. Hover, foco e cliques têm sons de resposta discretos.

O transporte actual de voz é PCM mono a 16 kHz, em pacotes de 40 ms pelo WebSocket do jogo, sem WebRTC. Tem fila de recepção limitada, limites por emissor e controlo de acumulação. Funciona, mas consome mais largura de banda e pode sofrer mais com atrasos TCP do que um transporte dedicado com compressão. A voz não tem cifra ponta a ponta: HTTPS/WSS cifra o transporte e o servidor encaminha o áudio.

## Contas, salas e o que o servidor decide

As contas permitem manter um nome único e uma sessão de sete dias. Os nomes aceitam 3–20 letras ASCII, números ou sublinhados; as palavras-passe exigem 10–128 caracteres. As palavras-passe são guardadas como hashes scrypt com salt. Os tokens de sessão são aleatórios e só o hash é guardado. Em produção, os cookies usam HttpOnly, SameSite=Strict e Secure. As instruções SQLite são parametrizadas.

Os nomes de convidados têm o prefixo Guest para se distinguirem de identidades registadas. Uma conta autenticada substitui o nome enviado pelo cliente. Podes jogar como convidado. Ainda não existe recuperação de palavra-passe, verificação de email, autenticação de dois factores, eliminação de conta ou progressão de jogo; não devem ser presumidas.

As salas isolam mapa, relógios, jogadores, texto e voz. O dono controla o início e a selecção do mapa. Uma ligação interrompida mantém o jogador durante 45 s, com token aleatório de recuperação associado à mesma identidade. A religação pode restaurar o mesmo papel e ID. Recarregar completamente a página perde actualmente o token, que está em memória.

Limitação anti-cheat: os snapshots públicos incluem actualmente posições dos jogadores sem filtrar pela linha de visão do servidor. O servidor rejeita impactos inválidos através de paredes, mas um cliente alterado pode revelar posições. A privacidade da visibilidade continua por reforçar.

O servidor decide movimento, dano, intervalos, recursos, fases, interacções e extração. Os clientes enviam comandos e recebem o estado público mais os seus campos privados. Os snapshots não incluem papéis secretos, vida ou energia dos outros. Os bots passam pelos mesmos bloqueios de acção do servidor; os testes automáticos verificam fugas de papéis secretos.

As protecções incluem verificação de origem em HTTP/WebSocket, limites de payload, ligações e mensagens, conteúdo dos jogadores escapado ou em texto simples, SQL parametrizado, ficheiros de base de dados privados e acesso estático limitado. São medidas concretas, não uma promessa de ausência de falhas. Faltam revisão independente e testes adversariais prolongados.

## Onde o desenho ainda precisa da tua avaliação

| Área | Problema actual para avaliar |
| --- | --- |
| Densidade do menu | Identidade, definições, mapas, jogadores e chat partilham um ecrã. Decide se criar sala deve passar a ser um passo separado. |
| Leitura dos sectores | Os recursos desbloqueiam por tempo, mas o mundo continua transitável. Falta distinguir melhor estações bloqueadas e utilizáveis. |
| Reconhecimento dos objectos | Os recursos e o sangue usam caixas de campo. A forma e a silhueta deveriam comunicar o tipo antes de ler a indicação E. |
| Expectativa de construção | O jogo repara equipamento existente. Barricadas ou crafting exigem uma mecânica nova para desenhar e implementar. |
| Equilíbrio dos mapas | Os bots favorecem os Echoes em vários mapas, sobretudo na fábrica. Resultados de bots não demonstram equilíbrio entre pessoas. |
| Largura do centro comercial | Os objectivos usam ramificações existentes, mas o corredor importado continua estreito. Avalia se precisa de reconstrução estrutural. |
| Resposta visual | Avalia progresso de reparação, instalação de células, pistas de sangue, abatidos e estado da extração à escala do jogador. |
| Jogo por toque | O menu adapta-se a um ecrã estreito, mas o jogo usa teclado e rato. Não existe esquema de controlos por toque. |
| Cobertura dos idiomas | O inglês é inicial; o português é seleccionável e fica guardado. Nomes, mensagens e títulos musicais não são traduzidos automaticamente. A arte importada pode manter marcas originais. |

## Verificação e passagem concreta

Os testes de regras cobrem fases, primeiro dia seguro, reparação, sangue, bloqueios de combate, dano, reanimação, extração e privacidade do estado secreto. Os testes de rede cobrem HTTP/sessão, rejeição de origem externa, salas, permissões do dono, destinatários da voz, religação e logout. A execução actual passou 18 casos de regras e 12 de rede.

A simulação anterior executou 48 partidas com seis bots pelos seis mapas. Não registou mortes prematuras no primeiro dia, partidas bloqueadas ou fugas de estado secreto. Também mostrou uma vantagem forte dos Echoes em vários mapas. As capturas são de Chrome desktop; as vistas dos mapas usam câmaras em exploração livre, enquanto menu, salas e primeiro dia são do fluxo em execução.

Pendente: avaliação com seis pessoas, voz com perdas de pacotes, mais browsers/equipamentos, revisão independente de segurança, recuperação de contas e ferramentas de moderação. O estado de deploy e a evidência exacta estão em DEPLOYMENT.json junto desta página.

AGENT_HANDOFF.mdRULES.mdlayouts.jsonDEPLOYMENT.json

