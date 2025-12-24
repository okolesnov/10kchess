(() => {
    const menuOverlay = document.getElementById('menuOverlay');
    const worldModeBtn = document.getElementById('worldModeBtn');
    const singleModeBtn = document.getElementById('singleModeBtn');
    const singleOptions = document.getElementById('singleOptions');
    const singleMapSize = document.getElementById('singleMapSize');
    const singleBots = document.getElementById('singleBots');
    const singleStartBtn = document.getElementById('singleStartBtn');
    const captchaContainer = document.getElementById('captchaContainer');
    const menuStatus = document.getElementById('menuStatus');

    const menuParams = new URLSearchParams(window.location.search);
    const mode = menuParams.get('mode');
    const size = menuParams.get('size');
    const bots = menuParams.get('bots');
    const autostart = menuParams.get('autostart') === '1';

    if (size && singleMapSize) {
        singleMapSize.value = size;
    }
    if (bots && singleBots) {
        singleBots.value = bots;
    }

    window.hideMenuOverlay = () => {
        if (menuOverlay) {
            menuOverlay.remove();
        }
    };

    const beginWorldMode = () => {
        captchaContainer?.classList.remove('hidden');
        worldModeBtn?.setAttribute('disabled', 'disabled');
        singleModeBtn?.setAttribute('disabled', 'disabled');
        if (menuStatus) {
            menuStatus.textContent = 'Подключение...';
        }
        if (window.beginWorldMode) {
            window.beginWorldMode();
        } else {
            window.pendingWorldStart = true;
        }
    };

    const beginSingleMode = () => {
        const selectedSize = Number.parseInt(singleMapSize.value, 10);
        const selectedBots = Math.max(0, Number.parseInt(singleBots.value, 10) || 0);
        const nextParams = new URLSearchParams();
        nextParams.set('mode', 'single');
        nextParams.set('size', selectedSize);
        nextParams.set('bots', selectedBots);
        nextParams.set('autostart', '1');
        if (window.startSingleGame && mode === 'single') {
            window.startSingleGame({ size: selectedSize, bots: selectedBots });
            return;
        }
        window.location.search = nextParams.toString();
    };

    worldModeBtn?.addEventListener('click', beginWorldMode);

    singleModeBtn?.addEventListener('click', () => {
        singleOptions?.classList.toggle('hidden');
    });

    singleStartBtn?.addEventListener('click', beginSingleMode);

    if (mode === 'single' && autostart) {
        window.pendingSingleStart = {
            size: Number.parseInt(size, 10) || 64,
            bots: Math.max(0, Number.parseInt(bots, 10) || 0),
        };
    } else if (mode !== 'single' && autostart) {
        menuParams.delete('autostart');
        window.history.replaceState({}, '', `${window.location.pathname}?${menuParams.toString()}`);
    }
})();
