// 性格によるステータス補正
const NATURE_MODIFIERS = {
    "さみしがり": { A: 1.1, B: 0.9 }, "いじっぱり": { A: 1.1, C: 0.9 }, "やんちゃ": { A: 1.1, D: 0.9 }, "ゆうかん": { A: 1.1, S: 0.9 },
    "ずぶとい": { B: 1.1, A: 0.9 }, "わんぱく": { B: 1.1, C: 0.9 }, "のうてんき": { B: 1.1, D: 0.9 }, "のんき": { B: 1.1, S: 0.9 },
    "ひかえめ": { C: 1.1, A: 0.9 }, "おっとり": { C: 1.1, B: 0.9 }, "うっかりや": { C: 1.1, D: 0.9 }, "れいせい": { C: 1.1, S: 0.9 },
    "おだやか": { D: 1.1, A: 0.9 }, "おとなしい": { D: 1.1, B: 0.9 }, "しんちょう": { D: 1.1, C: 0.9 }, "なまいき": { D: 1.1, S: 0.9 },
    "おくびょう": { S: 1.1, A: 0.9 }, "せっかち": { S: 1.1, B: 0.9 }, "ようき": { S: 1.1, C: 0.9 }, "むじゃき": { S: 1.1, D: 0.9 }
};

let buildsData = [];
let baseStatsData = {};
let totalBuilds = 0;
let itemChartInstance = null;
let speedChartInstance = null;

// 実数値計算関数
function calculateStat(statName, baseVal, evVal, nature) {
    if (!baseVal) return 0;
    const ev = parseInt(evVal) || 0;
    
    if (statName === 'H') {
        return baseVal + 75 + ev;
    } else {
        let modifier = 1.0;
        if (NATURE_MODIFIERS[nature]) {
            modifier = NATURE_MODIFIERS[nature][statName] || 1.0;
        }
        return Math.floor((baseVal + 20 + ev) * modifier);
    }
}

// データ初期化
async function init() {
    try {
        const [buildsRes, statsRes] = await Promise.all([
            fetch('data/M-1_single_builds_translated.json'),
            fetch('data/base_stats.json')
        ]);
        
        buildsData = await buildsRes.json();
        baseStatsData = await statsRes.json();
        totalBuilds = buildsData.length;
        
        processRanking();
    } catch (e) {
        document.getElementById('loading-indicator').innerText = "データの読み込みに失敗しました。";
        console.error(e);
    }
}

function processRanking() {
    const pokeCount = {};
    
    // 集計
    buildsData.forEach(build => {
        build.ポケモン.forEach(p => {
            if (!p.名前) return;
            pokeCount[p.名前] = (pokeCount[p.名前] || 0) + 1;
        });
    });
    
    // ソート
    const sorted = Object.keys(pokeCount)
        .map(name => ({ name, count: pokeCount[name] }))
        .sort((a, b) => b.count - a.count);
        
    const listEl = document.getElementById('pokemon-list');
    document.getElementById('loading-indicator').style.display = 'none';
    
    sorted.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'pokemon-item';
        
        const usagePercent = ((item.count / totalBuilds) * 100).toFixed(1);
        
        li.innerHTML = `
            <span class="pokemon-rank">${index + 1}位</span>
            <span class="pokemon-name">${item.name}</span>
            <span class="pokemon-usage">${usagePercent}%</span>
        `;
        
        li.onclick = () => {
            document.querySelectorAll('.pokemon-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            showDetail(item.name, item.count);
        };
        
        listEl.appendChild(li);
    });
    
    // 最初のポケモンを初期表示
    if (sorted.length > 0) {
        listEl.firstChild.click();
    }
}

function showDetail(pokemonName, totalCount) {
    document.getElementById('detail-panel').style.display = 'flex';
    document.getElementById('detail-name').innerText = pokemonName;
    document.getElementById('detail-usage').innerText = `採用率: ${((totalCount / totalBuilds) * 100).toFixed(1)}% (${totalCount}件)`;
    
    // 該当ポケモンの全個体データを抽出
    const instances = [];
    buildsData.forEach(build => {
        build.ポケモン.forEach(p => {
            if (p.名前 === pokemonName) instances.push(p);
        });
    });
    
    drawItemChart(instances);
    drawSpeedChart(instances, pokemonName);
    buildStatsTable(instances, pokemonName);
}

function drawItemChart(instances) {
    const itemCount = {};
    instances.forEach(p => {
        const item = p.もちもの || "なし";
        itemCount[item] = (itemCount[item] || 0) + 1;
    });
    
    const sortedItems = Object.keys(itemCount).sort((a, b) => itemCount[b] - itemCount[a]);
    const labels = sortedItems.map(i => i.length > 8 ? i.substring(0,8)+'..' : i);
    const data = sortedItems.map(i => itemCount[i]);
    
    const ctx = document.getElementById('itemChart').getContext('2d');
    if (itemChartInstance) itemChartInstance.destroy();
    
    Chart.defaults.color = '#94a3b8';
    itemChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(ctx) {
                    const total = instances.length;
                    const val = ctx.raw;
                    const perc = ((val/total)*100).toFixed(1);
                    return `${sortedItems[ctx.dataIndex]}: ${perc}%`;
                }}}
            }
        }
    });
}

function drawSpeedChart(instances, pokemonName) {
    const baseStats = baseStatsData[pokemonName];
    const speedCount = {};
    
    instances.forEach(p => {
        if (!baseStats) return;
        const s = calculateStat('S', baseStats.S, p.努力値.S, p.せいかく);
        speedCount[s] = (speedCount[s] || 0) + 1;
    });
    
    const speeds = Object.keys(speedCount).map(Number).sort((a, b) => a - b);
    const labels = speeds.map(String);
    const data = speeds.map(s => speedCount[s]);
    
    const ctx = document.getElementById('speedChart').getContext('2d');
    if (speedChartInstance) speedChartInstance.destroy();
    
    speedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '個体数',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function buildStatsTable(instances, pokemonName) {
    const baseStats = baseStatsData[pokemonName];
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = '';
    
    if (!baseStats) {
        tbody.innerHTML = '<tr><td colspan="9">種族値データがありません</td></tr>';
        return;
    }
    
    // もちものごとにグルーピング
    const itemGroups = {};
    instances.forEach(p => {
        const item = p.もちもの || "なし";
        if (!itemGroups[item]) itemGroups[item] = [];
        itemGroups[item].push(p);
    });
    
    // 出現数が多いアイテム順に表示
    const sortedItems = Object.keys(itemGroups).sort((a, b) => itemGroups[b].length - itemGroups[a].length);
    
    sortedItems.forEach(item => {
        const group = itemGroups[item];
        
        // この持ち物グループ内で最も多い「性格と努力値の組み合わせ」を探す
        const buildHashCount = {};
        const buildInfo = {};
        
        group.forEach(p => {
            const hash = `${p.せいかく}_${p.努力値.H}_${p.努力値.A}_${p.努力値.B}_${p.努力値.C}_${p.努力値.D}_${p.努力値.S}`;
            buildHashCount[hash] = (buildHashCount[hash] || 0) + 1;
            if (!buildInfo[hash]) buildInfo[hash] = p;
        });
        
        // 最頻の構成を取得
        const topHash = Object.keys(buildHashCount).sort((a,b) => buildHashCount[b] - buildHashCount[a])[0];
        const p = buildInfo[topHash];
        
        // 実数値計算
        const stats = {
            H: calculateStat('H', baseStats.H, p.努力値.H, p.せいかく),
            A: calculateStat('A', baseStats.A, p.努力値.A, p.せいかく),
            B: calculateStat('B', baseStats.B, p.努力値.B, p.せいかく),
            C: calculateStat('C', baseStats.C, p.努力値.C, p.せいかく),
            D: calculateStat('D', baseStats.D, p.努力値.D, p.せいかく),
            S: calculateStat('S', baseStats.S, p.努力値.S, p.せいかく)
        };
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item}</strong></td>
            <td>${p.せいかく}</td>
            <td>${stats.H}</td>
            <td>${stats.A}</td>
            <td>${stats.B}</td>
            <td>${stats.C}</td>
            <td>${stats.D}</td>
            <td>${stats.S}</td>
            <td style="color:var(--accent-hover)">${group.length} 件</td>
        `;
        tbody.appendChild(tr);
    });
}

// 起動
init();
