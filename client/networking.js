const params = new URLSearchParams(window.location.search);
const isSingleMode = params.get('mode') === 'single';

window.selfId = -1;

const neutralizeTeams = (teamsToNeutralize) => {
    for(let i = 0; i < boardW; i++){
        for(let j = 0; j < boardH; j++){
            if(teamsToNeutralize.includes(teams[i][j]) === true){
                // delete kings, neutralize other pieces
                if(board[i][j] === 6){
                    board[i][j] = 0;
                }
                teams[i][j] = 0;
            }
        }
    }
};

const handlePieceUpdate = (x, y, piece, team) => {
    if(selectedSquareX === x && selectedSquareY === y){
        unconfirmedSX = unconfirmedSY = selectedSquareX = selectedSquareY = legalMoves = undefined;
        draggingSelected = false;
        moveWasDrag = false;
    }
    // set a piece
    // x, y, piece, team
    board[x][y] = piece;
    teams[x][y] = team;

    if(piece === 6 && team === selfId){
        gameOver = false;
        gameOverTime = undefined;
        
        interpSquare = [x, y];
        setTimeout(() => {
            if(gameOver === false){
                interpSquare = undefined;
            }
        }, 1200)
    }
};

const handleMoveUpdate = (startX, startY, finX, finY) => {
    if(audioLoaded === true){
        const teamIsSelfId = teams[finX][finY] === selfId || teams[startX][startY] === selfId;
        if(teamIsSelfId){
            try {
                if(board[finX][finY] !== 0){
                    audios.capture[Math.random() < 0.5 ? 1 : 0].play();
                } else {
                    audios.move[Math.random() < 0.5 ? 0 : 1].play();
                }
            } catch(e){}
        }
    }

    if(board[finX][finY] === 6 && teams[finX][finY] === selfId){
        // le king is dead
        interpSquare = [finX, finY];
        gameOver = true;
        gameOverTime = time;

        try {
            audios.gameover[0].play();
        } catch(e){}

        setTimeout(() => {
            const buf = new Uint8Array(0);
            send(buf);
        }, respawnTime - 100)
    }

    // move a piece
    board[finX][finY] = board[startX][startY];
    board[startX][startY] = 0;

    teams[finX][finY] = teams[startX][startY];
    teams[startX][startY] = 0;

    if(teams[finX][finY] !== selfId || moveWasDrag === false){
        if(interpolatingPieces[finX] === undefined){
            interpolatingPieces[finX] = {};
        }
        interpolatingPieces[finX][finY] = [startX, startY];
    }

    if(selectedSquareX === startX && selectedSquareY === startY){
        unconfirmedSX = unconfirmedSY = selectedSquareX = selectedSquareY = legalMoves = undefined;
        draggingSelected = false;
        moveWasDrag = false;

        legalMoves = [];
    }
    if(teams[finX][finY] === selfId) curMoveCooldown = window.moveCooldown;
};

let ws;
let worldStartRequested = false;
let worldStartCompleted = false;
window.requireCaptcha = true;
if(!isSingleMode){
    ws = new WebSocket(HOST);
    ws.binaryType = "arraybuffer";

    ws.addEventListener("message", function (data) {
        const msg = new Uint16Array(data.data);

        if(msg.byteLength === 4 && msg[0] === 60001){
            window.requireCaptcha = msg[1] === 1;
            if(window.requireCaptcha === false && worldStartRequested && worldStartCompleted === false){
                startWorldWithoutCaptcha();
            }
        }

        else if(msg[0] === 64535 && msg[1] === 12345){
            let teamsToNeutralize = [];
            for(let i = 2; i < msg.length; i++){
                teamsToNeutralize.push(msg[i]);
            }

            // neutralize
            neutralizeTeams(teamsToNeutralize);
        }

    else if(msg[0] === 47095){
        const data = new Uint8Array(msg.buffer);
        // chat msg
        const txt = stringHTMLSafe(decodeText(data, 4)).replaceAll('&nbsp;', ' ');

        if(msg[1] !== 65534){
            const color = teamToColor(msg[1]);
            appendChatMessage(txt, `rgb(${color.r},${color.g},${color.b})`);
        } else {
            appendChatMessage(txt, 'rainbow');
        }
    }

    else if(msg[0] === 48027) {
        // leaderboard [id, name, kills]
        const prevLB = document.querySelector('.lb-group');
        if(prevLB){
            const toRemove = prevLB.querySelectorAll('.lb-players');
            for(let i = 0; i < toRemove.length; i++){
                toRemove[i].remove();
            }
        }

        const u8 = new Uint8Array(msg.buffer);

        let i = 1;

        const arr = [];

        while(i < msg.length-1){
            const id = msg[i++];
            const kills = msg[i++];
            const len = msg[i++];
            const startByteInd = i * 2;

            const name = decodeText(u8, startByteInd, startByteInd + len);

            i += Math.ceil(len / 2);

            const color = teamToColor(id);

            arr.push({name, id, kills, color});
        }

        arr.sort((a, b) => b.kills - a.kills);

        for(let i = 0; i < arr.length; i++){
            const {name, id, kills, color} = arr[i];
            addToLeaderboard(name, id, "Leaderboard", kills, `rgb(${color.r},${color.g},${color.b})`);
        }
    }

    else if(msg.byteLength > 10){
        // this is the entire board
        let ind = 1;
        selfId = msg[0];
        document.querySelector('.chatContainer').classList.remove('hidden');
        for(let i = 0; i < boardW; i++){
            for(let j = 0; j < boardH; j++){
                board[i][j] = msg[ind++];
            }
        }

        for(let i = 0; i < boardW; i++){
            for(let j = 0; j < boardH; j++){
                teams[i][j] = msg[ind++];
            }
        }
    }
    
    else if(msg.byteLength === 8){
        handlePieceUpdate(msg[0], msg[1], msg[2], msg[3]);
    }
    
    else if(msg.byteLength === 10) {
        handleMoveUpdate(msg[0], msg[1], msg[2], msg[3]);
    }

    changed = true;
});
}

let connected = false;
    window.send = () => {};

const msgs = [];
if(!isSingleMode){
    window.send = (data) => {
        msgs.push(data);
    }

    ws.onopen = () => {
        connected = true;
        window.send = (data) => {
            ws.send(data);
        }

        for(let i = 0; i < msgs.length; i++){
            window.send(msgs[i]);
        }
        msgs.length = 0;
    }

    ws.onclose = () => {
        connected = false;
        alert('disconnected from server!');
        // alert('disconnected from server.');
        window.send = () => {};
    }

    // join game
    const startWorldWithoutCaptcha = () => {
        if(worldStartCompleted) return;
        worldStartCompleted = true;
        const buf = new Uint8Array(0);
        window.send(buf);
        if(window.hideMenuOverlay){
            window.hideMenuOverlay();
        }
    };

    window.beginWorldMode = () => {
        worldStartRequested = true;
        if(window.requireCaptcha === false || typeof window.grecaptcha === 'undefined'){
            startWorldWithoutCaptcha();
            return;
        }
        grecaptcha.ready(() => {
            grecaptcha.render(document.querySelector(".g-recaptcha"), {
                'sitekey': '0x4AAAAAABDl4Wthv8-PLPyU',
                'callback': (captchaResponse) => {
                    worldStartCompleted = true;
                    const buf = new Uint8Array(captchaResponse.length);
                    encodeAtPosition(captchaResponse, buf, 0);
        
                    window.send(buf);

                    if(window.hideMenuOverlay){
                        window.hideMenuOverlay();
                    }
                }
            })
        })
    }

    if(window.pendingWorldStart){
        window.beginWorldMode();
    }
}

const singleState = {
    bots: [],
    deadTeams: new Set(),
    respawnTimers: new Map(),
    intervals: []
};

const randomEmptySquare = () => {
    for(let tries = 0; tries < 100; tries++){
        const x = Math.floor(Math.random() * boardW);
        const y = Math.floor(Math.random() * boardH);
        if(board[x][y] === 0 && teams[x][y] === 0){
            return {x, y};
        }
    }
    return null;
};

const spawnKing = (teamId) => {
    let position = null;
    outer: for(let tries = 0; tries < 120; tries++){
        const candidate = randomEmptySquare();
        if(!candidate) break;
        for(let x = candidate.x - 3; x <= candidate.x + 3; x++){
            inner: for(let y = candidate.y - 3; y <= candidate.y + 3; y++){
                if(board[x] === undefined || board[x][y] === undefined) continue inner;
                if(board[x][y] === 6){
                    continue outer;
                }
            }
        }
        position = candidate;
        break;
    }

    if(!position){
        position = randomEmptySquare();
    }

    if(position){
        handlePieceUpdate(position.x, position.y, 6, teamId);
    }
};

const spawnNeutralPiece = () => {
    const position = randomEmptySquare();
    if(!position) return;
    let piece = 1 + Math.floor(Math.random() * 4);
    if(Math.random() < 0.045) piece = 5;
    handlePieceUpdate(position.x, position.y, piece, 0);
};

const handleKingCapture = (teamId) => {
    if(teamId === 0) return;
    singleState.deadTeams.add(teamId);
    neutralizeTeams([teamId]);
    const existingTimer = singleState.respawnTimers.get(teamId);
    if(existingTimer){
        clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
        singleState.deadTeams.delete(teamId);
        spawnKing(teamId);
    }, respawnTime);
    singleState.respawnTimers.set(teamId, timer);
};

const applyMove = (startX, startY, finX, finY) => {
    const capturedPiece = board[finX][finY];
    const capturedTeam = teams[finX][finY];
    handleMoveUpdate(startX, startY, finX, finY);
    if(capturedPiece === 6 && capturedTeam !== 0){
        handleKingCapture(capturedTeam);
    }
};

const botTurn = (teamId) => {
    if(singleState.deadTeams.has(teamId)) return;
    const candidates = [];
    for(let i = 0; i < boardW; i++){
        for(let j = 0; j < boardH; j++){
            if(teams[i][j] === teamId && board[i][j] !== 0){
                const moves = generateLegalMoves(i, j, board, teams);
                if(moves.length){
                    candidates.push({x: i, y: j, moves});
                }
            }
        }
    }
    if(!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const move = pick.moves[Math.floor(Math.random() * pick.moves.length)];
    applyMove(pick.x, pick.y, move[0], move[1]);
};

window.startSingleGame = (settings) => {
    if(!isSingleMode) return;
    const botCount = Math.max(0, Number.parseInt(settings?.bots ?? 0, 10) || 0);
    singleState.bots = [];
    singleState.deadTeams.clear();
    for(const timer of singleState.respawnTimers.values()){
        clearTimeout(timer);
    }
    singleState.respawnTimers.clear();
    for(const interval of singleState.intervals){
        clearInterval(interval);
    }
    singleState.intervals = [];

    for(let i = 0; i < boardW; i++){
        for(let j = 0; j < boardH; j++){
            board[i][j] = 0;
            teams[i][j] = 0;
        }
    }

    selfId = 1;
    spawnKing(selfId);

    for(let i = 0; i < botCount; i++){
        const teamId = i + 2;
        singleState.bots.push(teamId);
        spawnKing(teamId);
    }

    for(let i = 0; i < Math.min(50, boardW * boardH / 8); i++){
        spawnNeutralPiece();
    }

    const pieceInterval = setInterval(spawnNeutralPiece, 650);
    singleState.intervals.push(pieceInterval);

    const botInterval = setInterval(() => {
        for(const botId of singleState.bots){
            botTurn(botId);
        }
    }, 750);
    singleState.intervals.push(botInterval);

    window.send = (data) => {
        if(singleState.deadTeams.has(selfId)){
            return;
        }
        if(data.byteLength === 0){
            return;
        }
        const decoded = new Uint16Array(data);
        if(decoded.length < 4) return;
        const [sx, sy, fx, fy] = decoded;
        if(board[sx]?.[sy] === 0 || teams[sx][sy] !== selfId) return;
        const legal = generateLegalMoves(sx, sy, board, teams);
        if(legal.find((move) => move[0] === fx && move[1] === fy) === undefined){
            return;
        }
        applyMove(sx, sy, fx, fy);
    };

    if(window.hideMenuOverlay){
        window.hideMenuOverlay();
    }
};

if(isSingleMode && window.pendingSingleStart){
    window.startSingleGame(window.pendingSingleStart);
}
// send(buf);

const encoder = new TextEncoder();
function encodeAtPosition(string, u8array, position) {
	return encoder.encodeInto(
		string,
		position ? u8array.subarray(position | 0) : u8array,
	);
}

window.stringHTMLSafe = (str) => {
	return str.replace(/&/g, '&amp;')
		.replace(/ /g, '&nbsp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

const decoder = new TextDecoder();
function decodeText(u8array, startPos=0, endPos=Infinity){
	return decoder.decode(u8array).slice(startPos, endPos);
}

window.addChatMessage = (message, type) => {
    const div = document.createElement('div');
    if (type !== 'system') div.classList.add('chat-message');
    else div.classList.add('system-message');

    const chatPrefixMap = {
        normal: '',
        system: '<span class="rainbow">[SERVER]</span>',
        dev: '<span class="rainbow">[DEV]</span>',
        guest: '<span class="guest">'
    };

    const chatSuffixMap = {
        normal: '',
        system: '',
        dev: '',
        guest: '</span>'
    };

    div.innerHTML = chatPrefixMap[type] + message + chatSuffixMap[type];
    const chatMessageDiv = document.querySelector('.chat-div');
    chatMessageDiv.appendChild(div);
    chatMessageDiv.scrollTop = chatMessageDiv.scrollHeight;
}
