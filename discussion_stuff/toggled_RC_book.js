function toggled_RC_book() {

    const mapDataNode = document.getElementById('json-beatmapset');
    if (!mapDataNode) return;
    const mapData = JSON.parse(mapDataNode.textContent);

    const urlParts = window.location.pathname.split('/');
    const discussionIndex = urlParts.indexOf('discussion');
    const urlBeatmapId = discussionIndex !== -1 ? Number(urlParts[discussionIndex + 1]) : NaN;
    const selectedBeatmap = document.querySelector('.beatmap-list__item--current[data-id]');
    const selectedBeatmapId = selectedBeatmap ? Number(selectedBeatmap.dataset.id) : NaN;
    const activeModeLink = document.querySelector('.game-mode-link--active[data-mode]');
    const activeMode = activeModeLink ? activeModeLink.dataset.mode : null;

    let mode = 'osu';
    let targetMap = null;
    if (mapData.beatmaps && mapData.beatmaps.length > 0) {
        targetMap = Number.isInteger(urlBeatmapId)
            ? mapData.beatmaps.find(beatmap => beatmap.id === urlBeatmapId)
            : null;

        if (!targetMap && Number.isInteger(selectedBeatmapId)) {
            targetMap = mapData.beatmaps.find(beatmap => beatmap.id === selectedBeatmapId);
        }

        if (!targetMap && activeMode) {
            targetMap = mapData.beatmaps.find(beatmap => beatmap.mode === activeMode);
        }

        if (!targetMap) targetMap = mapData.beatmaps[0];
        mode = targetMap.mode;
    }

    const difficultyRating = targetMap && Number.isFinite(Number(targetMap.difficulty_rating))
        ? Number(targetMap.difficulty_rating)
        : null;
    const difficultyName = targetMap?.version || 'current difficulty';
    let difficultyRange = 'unknown star range';
    if (difficultyRating !== null) {
        if (difficultyRating < 1.81) difficultyRange = 'easy';
        else if (difficultyRating < 2.51) difficultyRange = 'normal';
        else if (difficultyRating < 3.51) difficultyRange = 'hard';
        else if (difficultyRating < 4.25) difficultyRange = 'insane';
        else difficultyRange = 'expert';
    }

    const difficultyTier = difficultyRating === null
        ? 'easy'
        : difficultyRating < 1.81
            ? 'easy'
            : difficultyRating < 2.51
                ? 'normal'
                : difficultyRating < 3.51
                    ? 'hard'
                    : difficultyRating < 4.25
                        ? 'insane'
                        : 'expert';

    const rcLinks = {
        osu: {
            easy: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21#:~:text=Expert-,Easy,-Rules',
            normal: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21#:~:text=4%20or%20lower.-,Normal,-Rules',
            hard: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21#:~:text=5%20or%20lower.-,Hard,-Rules',
            insane: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21#:~:text=6%20or%20lower.-,Insane,-Rules',
            expert: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21#:~:text=7%20or%20lower.-,Expert,-Rules'
        },
        taiko: {
            easy: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21taiko#:~:text=16%E2%80%9320%20beats-,Kantan,-Rules',
            normal: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21taiko#:~:text=more1.-,Futsuu,-Rules',
            hard: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21taiko#:~:text=more1.-,Muzukashii,-Rules',
            insane: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21taiko#:~:text=more1.-,Oni,-Rules',
            expert: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21taiko#:~:text=more1.-,Inner%20Oni,-Guidelines'
        },
        fruits: {
            easy: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21catch#:~:text=%2D-,Cup,-Rules',
            normal: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21catch#:~:text=2.5%20or%20lower.-,Salad,-Rules',
            hard: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21catch#:~:text=3%20or%20lower.-,Platter,-Rules',
            insane: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21catch#:~:text=3.5%20or%20lower.-,Rain,-Rules',
            expert: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21catch#:~:text=4%20or%20lower.-,Overdose,-Rules'
        },
        mania: {
            easy: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania#:~:text=guidelines%20when%20applicable.-,Easy,-Rules',
            normal: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania#:~:text=than%20two%20columns.-,Normal,-Rules',
            hard: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania#:~:text=cannot%20reasonably%20handle.-,Hard,-Guidelines',
            insane: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania#:~:text=2/1%20beats.-,Insane,-Guidelines',
            expert: 'https://osu.ppy.sh/wiki/en/Ranking_criteria/osu%21mania#:~:text=be%20used%20sparingly.-,Expert,-Guidelines'
        }
    };

    const rcLink = (rcLinks[mode] || rcLinks.osu)[difficultyTier];
    const displayMode = mode === 'osu' ? '' : mode === 'fruits' ? 'catch' : mode;

    const syncOpenPanel = () => {
        const panel = document.getElementById('custom-rc-panel');
        if (!panel) return;

        const panelFrame = panel.querySelector('iframe');
        const panelTitle = panel.querySelector('[data-rc-panel-title]');
        const panelDifficulty = panel.querySelector('[data-rc-difficulty]');
        if (panelFrame && panelFrame.getAttribute('src') !== rcLink) panelFrame.src = rcLink;
        if (panelTitle) panelTitle.textContent = `osu!${displayMode ? `${displayMode} ` : ''}${difficultyTier} RC Guidelines`;
        if (panelDifficulty) {
            panelDifficulty.textContent = difficultyRating === null
                ? `${difficultyName} - ${difficultyRange}`
                : `${difficultyName} - ${difficultyRating.toFixed(2)}★ - ${difficultyRange}`;
        }
    };

    syncOpenPanel();

    const showPanel = (e) => {
        e?.preventDefault?.();

            let panel = document.getElementById('custom-rc-panel');
            if (panel) {
                syncOpenPanel();
                panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                return;
            }

            panel = document.createElement('div');
            panel.id = 'custom-rc-panel';
            panel.className = 'kmh-rc-drawer';
            // Leave layout to the stylesheet; its header shares osu!'s
            // --navbar-height. No hard-coded 70px header or padded spacer.
            panel.innerHTML = `
                <div class="kmh-rc-drawer__header">
                    <div class="kmh-rc-drawer__heading">
                        <span data-rc-panel-title class="kmh-rc-drawer__title">Ranking Criteria</span>
                        <span data-rc-difficulty class="kmh-rc-drawer__subtitle"></span>
                    </div>
                    <button type="button" id="close-rc-panel" class="kmh-rc-drawer__close" aria-label="Close Ranking Criteria panel" title="Close Ranking Criteria panel">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
                <iframe title="osu! Ranking Criteria" referrerpolicy="strict-origin-when-cross-origin"></iframe>
            `;

            document.body.appendChild(panel);
            syncOpenPanel();

            const closeBtn = panel.querySelector('#close-rc-panel');
            closeBtn.onclick = () => {
                panel.style.display = 'none';
            };
    };
    window.KmhOpenRC = showPanel;
}