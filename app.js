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

// 努力値を0〜32の生の値で表示するヘルパー
function formatEVValue(evVal) {
    return parseInt(evVal) || 0;
}

// 努力値が全部0かどうか判定するヘルパー
function isAllZeroEV(p) {
    return (parseInt(p.努力値.H) || 0) === 0 &&
           (parseInt(p.努力値.A) || 0) === 0 &&
           (parseInt(p.努力値.B) || 0) === 0 &&
           (parseInt(p.努力値.C) || 0) === 0 &&
           (parseInt(p.努力値.D) || 0) === 0 &&
           (parseInt(p.努力値.S) || 0) === 0;
}

// 状態管理変数
let currentPokemonName = "";
let currentInstances = [];
let currentSelectedItems = new Set(); // 複数選択対応
let currentSortedItems = [];

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

// ビュー切り替え（素早さ分布 / 実数値一覧）
function switchView(viewName) {
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });
    document.getElementById('view-speed').style.display = viewName === 'speed' ? 'flex' : 'none';
    document.getElementById('view-table').style.display = viewName === 'table' ? 'flex' : 'none';

    // チャートのリサイズ対応
    if (viewName === 'speed' && speedChartInstance) {
        setTimeout(() => speedChartInstance.resize(), 50);
    }
}

// データ初期化
async function init() {
    // タブ切り替えイベント
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
    });

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
    
    // 最初のポケモンを初期表示（直接呼び出し）
    if (sorted.length > 0) {
        const firstItem = sorted[0];
        listEl.firstChild.classList.add('active');
        showDetail(firstItem.name, firstItem.count);
    }
}

function showDetail(pokemonName, totalCount) {
    document.getElementById('detail-panel').style.display = 'flex';
    document.getElementById('detail-name').innerText = pokemonName;
    document.getElementById('detail-usage').innerText = `採用率: ${((totalCount / totalBuilds) * 100).toFixed(1)}% (${totalCount}件)`;
    
    currentPokemonName = pokemonName;
    
    // 該当ポケモンの全個体データを抽出
    currentInstances = [];
    buildsData.forEach(build => {
        build.ポケモン.forEach(p => {
            if (p.名前 === pokemonName) currentInstances.push(p);
        });
    });
    
    // もちもの比率のカウント・ソート
    const itemCount = {};
    currentInstances.forEach(p => {
        const item = p.もちもの || "なし";
        itemCount[item] = (itemCount[item] || 0) + 1;
    });
    
    currentSortedItems = Object.keys(itemCount).sort((a, b) => itemCount[b] - itemCount[a]);
    
    // デフォルトで採用率1位のもちものを選択状態にする
    currentSelectedItems = new Set([currentSortedItems[0] || "なし"]);
    
    // もちもの選択タブを生成
    drawItemSelector(currentInstances, currentSortedItems, currentSelectedItems);
    
    // ドーナツグラフの描画
    drawItemChart(currentInstances, currentSortedItems);
    
    // 選択されたもちもので絞り込んだ各ビューを更新
    updateFilteredViews();
}

// もちものクイックフィルター用タブバーの描画（複数選択対応）
function drawItemSelector(instances, sortedItems, selectedItems) {
    const selectorContainer = document.getElementById('item-selector-tabs');
    selectorContainer.innerHTML = '';
    
    // もちものごとの個体数カウント
    const itemCount = {};
    instances.forEach(p => {
        const item = p.もちもの || "なし";
        itemCount[item] = (itemCount[item] || 0) + 1;
    });
    
    sortedItems.forEach(item => {
        const count = itemCount[item] || 0;
        const btn = document.createElement('button');
        btn.className = `item-tab ${selectedItems.has(item) ? 'active' : ''}`;
        btn.setAttribute('data-item', item);
        
        btn.innerHTML = `
            <span class="tab-item-name">${item}</span>
            <span class="tab-item-count">${count}</span>
        `;
        
        btn.onclick = () => {
            selectItem(item);
        };
        
        selectorContainer.appendChild(btn);
    });
}

// もちもの選択時のアクション（複数選択トグル）
function selectItem(itemName) {
    if (currentSelectedItems.has(itemName)) {
        // 最後の1つは外せない
        if (currentSelectedItems.size > 1) {
            currentSelectedItems.delete(itemName);
        }
    } else {
        currentSelectedItems.add(itemName);
    }
    
    // タブのアクティブ状態の更新
    document.querySelectorAll('.item-tab').forEach(btn => {
        btn.classList.toggle('active', currentSelectedItems.has(btn.getAttribute('data-item')));
    });
    
    updateFilteredViews();
}

// 絞り込み条件に連動するビュー（素早さ分布グラフ、実数値テーブル）の更新
function updateFilteredViews() {
    // もちもので個体をフィルタリング（複数対応） + 努力値全0を除外
    const filteredInstances = currentInstances.filter(p =>
        currentSelectedItems.has(p.もちもの || "なし") && !isAllZeroEV(p)
    );
    
    // タイトルの動的書き換え
    const itemsText = [...currentSelectedItems].join('・');
    document.getElementById('speed-chart-title').innerText = `素早さ実数値 分布 (${itemsText})`;
    document.getElementById('table-title').innerText = `実数値配分一覧 - ${itemsText} (件数順)`;
    
    // 描画更新
    drawSpeedChart(filteredInstances, currentPokemonName);
    buildStatsTable(filteredInstances, currentPokemonName);
    buildMoveTable(filteredInstances);
}

function drawItemChart(instances, sortedItems) {
    const itemCount = {};
    instances.forEach(p => {
        const item = p.もちもの || "なし";
        itemCount[item] = (itemCount[item] || 0) + 1;
    });
    
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
            // グラフをクリックしたときにフィルター連動させる
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const index = elements[0].index;
                    const clickedItem = sortedItems[index];
                    if (clickedItem) {
                        selectItem(clickedItem);
                    }
                }
            },
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(ctx) {
                    const total = instances.length;
                    const val = ctx.raw;
                    const perc = ((val/total)*100).toFixed(1);
                    return `${sortedItems[ctx.dataIndex]}: ${perc}% (${val}件)`;
                }}}
            }
        }
    });
}

function drawSpeedChart(filteredInstances, pokemonName) {
    const baseStats = baseStatsData[pokemonName];
    const ctx = document.getElementById('speedChart').getContext('2d');
    if (speedChartInstance) speedChartInstance.destroy();
    
    if (!baseStats) return;
    
    const baseS = baseStats.S;
    
    // 素早さの取りうる全範囲を計算
    const minSpeed = Math.floor((baseS + 20) * 0.9);      // 下降補正, EV0
    const maxSpeed = Math.floor((baseS + 20 + 32) * 1.1);  // 上昇補正, EV32
    const neutralMaxSpeed = baseS + 20 + 32;                // 補正なし最速
    
    // 実データの素早さ集計
    const speedCount = {};
    filteredInstances.forEach(p => {
        const s = calculateStat('S', baseS, p.努力値.S, p.せいかく);
        speedCount[s] = (speedCount[s] || 0) + 1;
    });
    
    const total = filteredInstances.length;
    
    // 全範囲のラベルとデータを生成（割合表示）
    const labels = [];
    const data = [];
    for (let s = minSpeed; s <= maxSpeed; s++) {
        labels.push(String(s));
        data.push(total > 0 ? parseFloat(((speedCount[s] || 0) / total * 100).toFixed(1)) : 0);
    }
    
    // 補正なし最速ラインのインデックス
    const neutralLineLabel = String(neutralMaxSpeed);
    
    speedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '割合(%)',
                data: data,
                backgroundColor: data.map((v, i) => {
                    return (minSpeed + i) > neutralMaxSpeed ? '#ef4444' : '#6366f1';
                }),
                borderColor: data.map((v, i) => {
                    return (minSpeed + i) > neutralMaxSpeed ? '#f87171' : '#818cf8';
                }),
                borderWidth: 1,
                borderRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        callback: v => v + '%'
                    },
                    title: { display: true, text: '割合', color: '#94a3b8', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 20,
                        font: { size: 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => `素早さ実数値: ${items[0].label}`,
                        label: (ctx) => {
                            const pct = ctx.raw;
                            const count = speedCount[minSpeed + ctx.dataIndex] || 0;
                            return `${pct}% (${count}件 / ${total}件)`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        neutralLine: {
                            type: 'line',
                            drawTime: 'beforeDatasetsDraw',
                            xMin: neutralLineLabel,
                            xMax: neutralLineLabel,
                            borderColor: 'rgba(250, 204, 21, 0.85)',
                            borderWidth: 2,
                            borderDash: [6, 4],
                            label: {
                                display: false
                            }
                        }
                    }
                }
            }
        }
    });
}

function buildStatsTable(filteredInstances, pokemonName) {
    const baseStats = baseStatsData[pokemonName];
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = '';
    
    if (!baseStats) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">種族値データがありません</td></tr>';
        return;
    }
    
    if (filteredInstances.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">このもちものを所持したビルドが見つかりませんでした</td></tr>';
        return;
    }
    
    // 性格と努力値の組み合わせで集計
    const buildCount = {};
    const buildInstances = {};
    
    filteredInstances.forEach(p => {
        const hash = `${p.せいかく}_${p.努力値.H}_${p.努力値.A}_${p.努力値.B}_${p.努力値.C}_${p.努力値.D}_${p.努力値.S}`;
        buildCount[hash] = (buildCount[hash] || 0) + 1;
        if (!buildInstances[hash]) {
            buildInstances[hash] = p;
        }
    });
    
    // 件数順（降順）にソート
    const sortedHashes = Object.keys(buildCount).sort((a, b) => buildCount[b] - buildCount[a]);
    
    sortedHashes.forEach(hash => {
        const p = buildInstances[hash];
        const count = buildCount[hash];
        const percentage = ((count / filteredInstances.length) * 100).toFixed(1);
        
        // 実数値を計算
        const stats = {
            H: calculateStat('H', baseStats.H, p.努力値.H, p.せいかく),
            A: calculateStat('A', baseStats.A, p.努力値.A, p.せいかく),
            B: calculateStat('B', baseStats.B, p.努力値.B, p.せいかく),
            C: calculateStat('C', baseStats.C, p.努力値.C, p.せいかく),
            D: calculateStat('D', baseStats.D, p.努力値.D, p.せいかく),
            S: calculateStat('S', baseStats.S, p.努力値.S, p.せいかく)
        };
        
        // 努力値配分を可読性の高い文字列にする
        const evs = [
            formatEVValue(p.努力値.H),
            formatEVValue(p.努力値.A),
            formatEVValue(p.努力値.B),
            formatEVValue(p.努力値.C),
            formatEVValue(p.努力値.D),
            formatEVValue(p.努力値.S)
        ];
        
        // 努力値配分のテキスト表示
        const evString = evs.join('-');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium">${p.せいかく}</td>
            <td class="stat-num">${stats.H}</td>
            <td class="stat-num">${stats.A}</td>
            <td class="stat-num">${stats.B}</td>
            <td class="stat-num">${stats.C}</td>
            <td class="stat-num">${stats.D}</td>
            <td class="stat-num">${stats.S}</td>
            <td><span class="ev-badge">${evString}</span></td>
            <td style="color:var(--accent-hover); font-weight:600;">${count}件 <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary)">(${percentage}%)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// 技採用率テーブルの描画
function buildMoveTable(filteredInstances) {
    const container = document.getElementById('move-table-container');
    if (!container) return;
    
    const tbody = document.getElementById('move-tbody');
    const titleEl = document.getElementById('move-table-title');
    tbody.innerHTML = '';
    
    if (filteredInstances.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-secondary);">データがありません</td></tr>';
        return;
    }
    
    // 技の出現回数を集計
    const moveCount = {};
    filteredInstances.forEach(p => {
        if (!p.技 || !Array.isArray(p.技)) return;
        p.技.forEach(move => {
            if (move) moveCount[move] = (moveCount[move] || 0) + 1;
        });
    });
    
    const total = filteredInstances.length;
    const sortedMoves = Object.keys(moveCount).sort((a, b) => moveCount[b] - moveCount[a]);
    
    const itemsText = [...currentSelectedItems].join('・');
    titleEl.innerText = `技採用率 - ${itemsText} (${total}件中)`;
    
    sortedMoves.forEach((move, idx) => {
        const count = moveCount[move];
        const pct = ((count / total) * 100).toFixed(1);
        const barWidth = (count / total) * 100;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; white-space:nowrap;">${move}</td>
            <td style="width:100%;">
                <div class="move-bar-container">
                    <div class="move-bar" style="width:${barWidth}%;"></div>
                </div>
            </td>
            <td style="white-space:nowrap; text-align:right; font-weight:600; color:var(--accent-hover);">${pct}% <span style="font-size:0.8rem; font-weight:normal; color:var(--text-secondary);">(${count}件)</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// 起動
init();
