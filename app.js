import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyAp1ZVuW95Api3kaQUPgttESZ0RGTEi8H8", authDomain: "cdc-qc-system.firebaseapp.com", projectId: "cdc-qc-system", storageBucket: "cdc-qc-system.firebasestorage.app", messagingSenderId: "745920606237", appId: "1:745920606237:web:7fb9c22a84de208e6e56f4" };

window.exceptionDates = []; window.extraWorkA = []; window.extraWorkB = []; 
window.pileNumbers = {}; window.statusSample = {}; window.statusLab = {}; window.statusTest = {}; window.remarks = {}; window.contractorReports = {}; 

const scheduleData = []; let currentFilter = 'ALL'; let currentView = 'table'; let currentCalDate = new Date(2026, 4, 1); 
const TOTAL_PILES_LIMIT = 613; let isCloudEnabled = false; let db, auth;
const A2 = 1.023; const D4 = 2.574; const D3 = 0;

const initFirebase = async () => {
    try {
        const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); isCloudEnabled = true; await signInAnonymously(auth);
        onAuthStateChanged(auth, (user) => {
            if (user) {
                onSnapshot(doc(db, 'scheduleData', 'mainState'), (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        window.exceptionDates = data.exceptionDates || []; window.extraWorkA = data.extraWorkA || []; window.extraWorkB = data.extraWorkB || [];
                        window.pileNumbers = data.pileNumbers || {}; window.statusSample = data.statusSample || {}; window.statusLab = data.statusLab || {};
                        window.statusTest = data.statusTest || data.completionStatus || {}; window.remarks = data.remarks || {}; window.contractorReports = data.contractorReports || {};
                    }
                    window.refreshAll();
                });
                onSnapshot(doc(db, 'scheduleData', 'concreteState'), (snapshot) => {
                    window.concreteData = snapshot.exists() ? snapshot.data().records : [];
                    if (window.currentView === 'concrete') window.calculateConcreteStats();
                });
            }
        });
    } catch (e) { document.getElementById('sync-status').innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-500"></i> 連線異常'; }
};

window.saveDataToCloud = async () => { if (isCloudEnabled && auth.currentUser) { try { await setDoc(doc(db, 'scheduleData', 'mainState'), { exceptionDates: window.exceptionDates, extraWorkA: window.extraWorkA, extraWorkB: window.extraWorkB, pileNumbers: window.pileNumbers, statusSample: window.statusSample, statusLab: window.statusLab, statusTest: window.statusTest, remarks: window.remarks, contractorReports: window.contractorReports }, { merge: true }); } catch (err) {} } };

window.saveConcreteDataToCloud = async () => {
    if (isCloudEnabled && auth.currentUser) { await setDoc(doc(db, 'scheduleData', 'concreteState'), { records: window.concreteData }, { merge: true }); }
};

window.toDateString = (d) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dt=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dt}`; };
window.formatMinguo = (d) => { const y=d.getFullYear()-1911; const m=String(d.getMonth()+1).padStart(2,'0'); const dt=String(d.getDate()).padStart(2,'0'); const day=["日","一","二","三","四","五","六"][d.getDay()]; return `${y}/${m}/${dt}(${day})`; };
const addDays = (d, days) => { let r=new Date(d); r.setDate(r.getDate()+days); return r; };

window.refreshAll = () => { window.generateSchedule(); window.renderTable(currentFilter); window.updateDashboard(); if (currentView === 'calendar') window.renderCalendar(); };

window.generateSchedule = () => {
    scheduleData.length = 0; const startDateA = new Date(2026, 4, 5); const startDateB = new Date(2026, 4, 9); const endDate = new Date(2026, 6, 30); let cA = 1, cB = 1;
    for (let d = new Date(startDateA); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dStr = window.toDateString(d); const isSun = d.getDay() === 0; const isEx = window.exceptionDates.includes(dStr);
        const makeR = (m, c, t) => {
            let dem = addDays(t, 1); if (dem.getDay() === 0) dem = addDays(dem, 1);
            let col = new Date(dem); while (col.getDay() !== 2 && col.getDay() !== 5) col = addDays(col, 1);
            let tes = addDays(t, 28); if (tes.getDay() === 6) tes = addDays(tes, 2); else if (tes.getDay() === 0) tes = addDays(tes, 1);
            return { id: `${m}${c}`, machine: m, sampleDate: new Date(t), demoldDate: dem, collectDate: col, testDate: tes };
        };
        if (d >= startDateA) { if ((!isSun && !isEx) || window.extraWorkA.includes(dStr)) scheduleData.push(makeR('A', cA++, new Date(d))); }
        if (d >= startDateB) { if ((!isSun && !isEx) || window.extraWorkB.includes(dStr)) scheduleData.push(makeR('B', cB++, new Date(d))); }
    }
};

window.renderTable = (filter) => {
    const tbody = document.getElementById('schedule-body'); tbody.innerHTML = '';
    scheduleData.filter(i => filter === 'ALL' || i.machine === filter).forEach(item => {
        const isS = window.statusSample[item.id], isL = window.statusLab[item.id], isT = window.statusTest[item.id];
        const tr = document.createElement('tr'); tr.className = `modern-row row-hover border-b divide-slate-100 ${isT ? 'completed-row' : ''}`;
        tr.innerHTML = `
            <td class="font-black text-slate-700 text-center">${item.id}</td>
            <td><input type="text" class="pile-input" ${isT ? 'readonly' : ''} onchange="updatePile('${item.id}', this.value)" placeholder="輸入樁號 (例如: 12, 13)" value="${window.pileNumbers[item.id] || ''}"></td>
            <td class="bg-blue-50/50"><label class="flex items-center gap-2.5 cursor-pointer justify-center w-full h-full"><input type="checkbox" class="status-checkbox cb-sample" ${isS?'checked':''} ${isT?'disabled':''} onclick="toggleStatus('${item.id}', 'sample')"><span class="font-bold ${isS?'text-gray-400 line-through':'text-[#1E3A8A]'}">${window.formatMinguo(item.sampleDate)}</span></label></td>
            <td class="font-medium text-slate-500 bg-slate-50/50">${window.formatMinguo(item.demoldDate)}</td>
            <td class="bg-orange-50/50"><label class="flex items-center gap-2.5 cursor-pointer justify-center w-full h-full"><input type="checkbox" class="status-checkbox cb-lab" ${isL?'checked':''} ${isT?'disabled':''} onclick="toggleStatus('${item.id}', 'lab')"><span class="font-bold ${isL?'text-gray-400 line-through':'text-[#B45309]'}">${window.formatMinguo(item.collectDate)}</span></label></td>
            <td class="bg-green-50/50"><label class="flex items-center gap-2.5 cursor-pointer justify-center w-full h-full"><input type="checkbox" class="status-checkbox cb-test" ${isT?'checked':''} onclick="toggleStatus('${item.id}', 'test')"><span class="font-black ${isT?'text-gray-400 line-through':'text-[#166534]'}">${window.formatMinguo(item.testDate)}</span></label></td>
            <td><input type="text" class="remark-input" ${isT?'readonly':''} onchange="updateRemark('${item.id}', this.value)" placeholder="點擊填寫..." value="${window.remarks[item.id]||''}"></td>
        `;
        tbody.appendChild(tr);
    });
};

window.updateDashboard = () => {
    const usedA = new Set(); const usedB = new Set(); const workedDates = new Set();
    Object.entries(window.pileNumbers).forEach(([id, val]) => { const nums = (val.match(/\d+/g) || []).map(n => parseInt(n, 10)); if (nums.length > 0) { nums.forEach(n => { if (id.startsWith('A')) usedA.add(n); else if (id.startsWith('B')) usedB.add(n); }); const item = scheduleData.find(s => s.id === id); if (item) workedDates.add(window.toDateString(item.sampleDate)); } });
    const countA = usedA.size; const countB = usedB.size; const pilesCount = countA + countB; const workedDays = workedDates.size;
    
    document.getElementById('prog-piles-ab').innerText = `A: ${countA} | B: ${countB}`;
    document.getElementById('prog-piles-text').innerText = pilesCount;
    document.getElementById('prog-piles-bar').style.width = `${(pilesCount/TOTAL_PILES_LIMIT)*100}%`;

    if (pilesCount > 0 && workedDays > 0) {
        const avgRate = pilesCount / workedDays; const estDays = Math.ceil((TOTAL_PILES_LIMIT - pilesCount) / avgRate);
        let simDate = new Date(); let added = 0; while(added < estDays) { simDate.setDate(simDate.getDate() + 1); const dStr = window.toDateString(simDate); if (simDate.getDay() !== 0 && !window.exceptionDates.includes(dStr)) added++; }
        document.getElementById('prediction-text').innerHTML = `近期產能：約 <span class="bg-white px-2 py-0.5 rounded text-slate-800 shadow-sm border border-orange-100">${avgRate.toFixed(1)} 支/日</span>。剩餘約需 <b class="text-amber-800">${estDays}</b> 工作天，推估 <span class="bg-white px-2 py-0.5 rounded text-[#B45309] shadow-sm border border-orange-100">${window.formatMinguo(simDate)}</span> 完工！`;
    }

    let cS=0, cL=0, cT=0; scheduleData.forEach(i => { if(window.statusSample[i.id]) cS++; if(window.statusLab[i.id]) cL++; if(window.statusTest[i.id]) cT++; });
    document.getElementById('prog-sample-text').innerText = cS; document.getElementById('prog-sample-total').innerText = `/ ${scheduleData.length}`; document.getElementById('prog-sample-bar').style.width = `${(cS/scheduleData.length)*100}%`;
    document.getElementById('prog-lab-text').innerText = cL; document.getElementById('prog-lab-total').innerText = `/ ${scheduleData.length}`; document.getElementById('prog-lab-bar').style.width = `${(cL/scheduleData.length)*100}%`;
    document.getElementById('prog-test-text').innerText = cT; document.getElementById('prog-test-total').innerText = `/ ${scheduleData.length}`; document.getElementById('prog-test-bar').style.width = `${(cT/scheduleData.length)*100}%`;
};

window.toggleStatus = (sampleId, type) => { if (type === 'sample') window.statusSample[sampleId] = !window.statusSample[sampleId]; if (type === 'lab') window.statusLab[sampleId] = !window.statusLab[sampleId]; if (type === 'test') window.statusTest[sampleId] = !window.statusTest[sampleId]; window.saveDataToCloud(); window.refreshAll(); };
window.updatePile = (id, val) => { const v = val.trim(); if (!v) delete window.pileNumbers[id]; else window.pileNumbers[id] = v; window.saveDataToCloud(); window.updateDashboard(); if (!document.getElementById('matrix-modal').classList.contains('hidden')) window.renderMatrixGrid(); if (!document.getElementById('recon-modal').classList.contains('hidden')) window.renderReconTable(); };
window.updateRemark = (id, val) => { const v = val.trim(); if (!v) delete window.remarks[id]; else window.remarks[id] = v; window.saveDataToCloud(); };
window.toggleView = (v) => { currentView = v; document.getElementById('table-view').classList.toggle('hidden', v !== 'table'); document.getElementById('calendar-view').classList.toggle('hidden', v !== 'calendar'); if(v === 'calendar') window.renderCalendar(); };
window.changeMonth = (o) => { currentCalDate.setMonth(currentCalDate.getMonth() + o); window.renderCalendar(); };

window.renderCalendar = () => { 
    const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
    document.getElementById('calendar-title').innerText = `民國 ${year-1911} 年 ${month+1} 月`;
    const eventsMap = {};
    scheduleData.filter(i => currentFilter === 'ALL' || i.machine === currentFilter).forEach(item => {
        const p = window.pileNumbers[item.id] ? `${item.id}(${window.pileNumbers[item.id]})` : item.id;
        const addE = (dt, type, label, tagClass) => { if (dt.getFullYear() === year && dt.getMonth() === month) { const d = dt.getDate(); if (!eventsMap[d]) eventsMap[d] = []; eventsMap[d].push({ label, tagClass, type }); } };
        addE(item.sampleDate, '取樣', p, 'tag-sample');
        addE(item.demoldDate, '拆模', p, 'tag-demold');
        addE(item.collectDate, '收件', p, 'tag-lab');
        addE(item.testDate, '壓測', p, 'tag-test');
    });
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    const tbody = document.getElementById('calendar-body'); tbody.innerHTML = ''; let date = 1;
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j < 7; j++) {
            const cell = document.createElement('td'); cell.className = 'border-r border-b border-slate-200 p-2 align-top h-44 bg-white transition hover:bg-slate-50';
            if (j === 0 || j === 6) cell.classList.add('bg-slate-50/50');
            if (i === 0 && j < firstDay || date > daysInMonth) { cell.innerHTML = ''; } else {
                let isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === date;
                let cellHtml = `<div class="font-black text-xl mb-3 flex justify-between items-center"><span class="${isToday ? 'bg-slate-700 text-white rounded-lg px-2 py-1 shadow-md' : 'text-slate-500'}">${date}</span></div><div class="flex flex-col gap-1.5 overflow-y-auto max-h-32 calendar-scroll pr-1">`;
                if (eventsMap[date]) {
                    eventsMap[date].forEach(e => { cellHtml += `<div class="cal-tag ${e.tagClass} break-all"><b>${e.type}:</b> ${e.label}</div>`; });
                }
                cellHtml += `</div>`; cell.innerHTML = cellHtml; date++;
            }
            row.appendChild(cell);
        }
        tbody.appendChild(row); if (date > daysInMonth) break;
    }
 };

// Modal Functions
window.calculateMaterials = () => {
    const totalSandM3 = (parseFloat(document.getElementById('calc-sand-bucket').value)||0) * ((parseFloat(document.getElementById('calc-vol').value)||0)/1000) * (parseFloat(document.getElementById('calc-batches').value)||0);
    const totalCemTon = (parseFloat(document.getElementById('calc-cem-bucket').value)||0) * ((parseFloat(document.getElementById('calc-vol').value)||0)/1000) * (parseFloat(document.getElementById('calc-batches').value)||0) * 1.4;
    const resDiv = document.getElementById('calc-result');
    resDiv.innerHTML = `<div class="flex justify-around items-center"><div class="text-center">理論砂用量<br><span class="text-2xl font-black text-slate-800">${totalSandM3.toFixed(2)} m³</span></div><div class="text-center">理論水泥用量<br><span class="text-2xl font-black text-slate-800">${totalCemTon.toFixed(2)} 噸</span></div></div><div class="text-center text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 font-bold mt-2">🚩請與施工組報表比對</div>`;
    resDiv.classList.remove('hidden');
};

window.openMatrixModal = () => { window.renderMatrixGrid(); document.getElementById('matrix-modal').classList.remove('hidden'); };
window.closeMatrixModal = () => { document.getElementById('matrix-modal').classList.add('hidden'); };
window.renderMatrixGrid = () => {
    const counts = new Array(TOTAL_PILES_LIMIT + 1).fill(0);
    Object.values(window.pileNumbers).forEach(val => { const nums = (val.match(/\d+/g) || []).map(n => parseInt(n, 10)); nums.forEach(n => { if (n >= 1 && n <= TOTAL_PILES_LIMIT) counts[n]++; }); });
    const container = document.getElementById('matrix-container'); container.innerHTML = '';
    let statMissing = 0, statOk = 0, statError = 0;
    for (let i = 1; i <= TOTAL_PILES_LIMIT; i++) {
        const box = document.createElement('div'); let statusClass = '';
        if (counts[i] === 0) { statusClass = 'box-missing'; statMissing++; } else if (counts[i] === 1) { statusClass = 'box-ok'; statOk++; } else { statusClass = 'box-error'; statError++; box.title = `重複 ${counts[i]} 次！`; }
        box.className = `matrix-box ${statusClass}`; box.innerText = i; container.appendChild(box);
    }
    document.getElementById('matrix-count-missing').innerText = statMissing; document.getElementById('matrix-count-ok').innerText = statOk; document.getElementById('matrix-count-error').innerText = statError;
};

window.openReconModal = () => { window.renderReconTable(); document.getElementById('recon-modal').classList.remove('hidden'); };
window.closeReconModal = () => { document.getElementById('recon-modal').classList.add('hidden'); };
window.updateContractorReport = (dateStr, val) => { const num = parseInt(val, 10); if (isNaN(num)) delete window.contractorReports[dateStr]; else window.contractorReports[dateStr] = num; window.saveDataToCloud(); window.renderReconTable(); };
window.renderReconTable = () => {
    const dailyStats = {};
    scheduleData.forEach(item => {
        const count = (window.pileNumbers[item.id] || "").match(/\d+/g)?.length || 0;
        if (count > 0) {
            const dateStr = window.toDateString(item.sampleDate);
            if (!dailyStats[dateStr]) dailyStats[dateStr] = { A: 0, B: 0, total: 0, dateObj: item.sampleDate };
            dailyStats[dateStr][item.machine] += count; dailyStats[dateStr].total += count;
        }
    });
    const sortedDates = Object.keys(dailyStats).sort((a, b) => new Date(b) - new Date(a));
    const tbody = document.getElementById('recon-body'); tbody.innerHTML = '';
    if(sortedDates.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold">尚無資料。</td></tr>'; return; }
    sortedDates.forEach(dStr => {
        const stat = dailyStats[dStr]; const reportVal = window.contractorReports[dStr] !== undefined ? window.contractorReports[dStr] : '';
        let statusHtml = '<span class="text-slate-400 text-sm font-bold">- 待填報 -</span>'; 
        if (reportVal !== '') {
            const rNum = parseInt(reportVal, 10);
            if (rNum === stat.total) statusHtml = '<span class="bg-[#F2F7F4] text-[#84A98C] px-3 py-1.5 rounded-lg border border-[#84A98C]/30 font-bold"><i class="fa-solid fa-check"></i> 數量申報吻合</span>';
            else statusHtml = `<span class="bg-[#FEF2F2] text-[#DC2626] px-3 py-1.5 rounded-lg border border-[#F87171]/50 font-bold animate-pulse"><i class="fa-solid fa-xmark"></i> 誤差 ${Math.abs(rNum - stat.total)} 支</span>`;
        }
        tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50 transition"><td class="p-4 font-bold text-slate-600">${window.formatMinguo(stat.dateObj)}</td><td class="p-4 text-center font-bold text-slate-500">${stat.A||'-'}</td><td class="p-4 text-center font-bold text-slate-500">${stat.B||'-'}</td><td class="p-4 font-black text-lg text-slate-800 text-center">${stat.total}</td><td class="p-4 text-center bg-[#FCF9F2]"><input type="number" class="border border-[#C2A878] rounded-md px-3 py-1.5 w-24 text-center font-bold text-[#C2A878] outline-none" value="${reportVal}" onchange="updateContractorReport('${dStr}', this.value)"></td><td class="p-4 text-center">${statusHtml}</td></tr>`;
    });
};

window.showModal = (title, msg, type) => { document.getElementById('custom-modal-header').innerText = title; document.getElementById('custom-modal-message').innerHTML = msg; document.getElementById('custom-modal').classList.remove('hidden'); };
window.closeModal = () => document.getElementById('custom-modal').classList.add('hidden');
window.filterData = (f) => { currentFilter = f; window.renderTable(f); if(currentView==='calendar') window.renderCalendar(); };

window.addExceptionDate = () => { const val = document.getElementById('exception-date-input').value; if (val && !window.exceptionDates.includes(val)) { window.exceptionDates.push(val); window.exceptionDates.sort(); window.saveDataToCloud(); document.getElementById('exception-date-input').value = ""; } };
window.addExtraDate = () => { const m = document.getElementById('extra-machine').value; const val = document.getElementById('extra-date-input').value; if (val) { if (m === 'A' && !window.extraWorkA.includes(val)) window.extraWorkA.push(val); if (m === 'B' && !window.extraWorkB.includes(val)) window.extraWorkB.push(val); window.saveDataToCloud(); document.getElementById('extra-date-input').value = ""; } };


// ==========================================
// ACI 214 強度統計分析與 AI 專家診斷
// ==========================================
const zoneMap = {
    'A_NORMAL': 'A車 (一般區)', 'A_POND_BC': 'A車 (滯洪池BC)',
    'B_NORMAL': 'B車 (一般區)', 'B_POND_A': 'B車 (滯洪池A)',
    'A_ALL': '【A車總體品質】', 'B_ALL': '【B車總體品質】', 'ALL': '全區 (A+B)'
};

window.addConcreteRecord = () => {
    const dateStr = document.getElementById('concrete-date').value || window.toDateString(new Date());
    const id = document.getElementById('concrete-id').value.trim() || `P-${Math.floor(Math.random()*1000)}`;
    const s1 = parseFloat(document.getElementById('concrete-s1').value);
    const s2 = parseFloat(document.getElementById('concrete-s2').value);
    const s3 = parseFloat(document.getElementById('concrete-s3').value);
    const zone = document.getElementById('concrete-zone-select').value; 

    if(isNaN(s1) || isNaN(s2) || isNaN(s3)) { alert("請完整填寫 3 顆試體數值！"); return; }
    const max = Math.max(s1, s2, s3); const min = Math.min(s1, s2, s3);
    const avg = (s1 + s2 + s3) / 3; const range = max - min;

    window.concreteData.push({ timestamp: Date.now(), date: dateStr, id: id, zone: zone, s1: s1, s2: s2, s3: s3, avg: avg, range: range });
    window.concreteData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    document.getElementById('concrete-s1').value = ''; document.getElementById('concrete-s2').value = ''; document.getElementById('concrete-s3').value = ''; document.getElementById('concrete-id').value = '';
    window.saveConcreteDataToCloud();
    window.calculateConcreteStats();
};

window.deleteConcreteRecord = (ts) => {
    if(confirm("確定刪除此筆強度試驗資料？")) {
        window.concreteData = window.concreteData.filter(d => d.timestamp !== ts);
        window.saveConcreteDataToCloud();
        window.calculateConcreteStats();
    }
};

window.calculateConcreteStats = () => {
    const targetFc = parseFloat(document.getElementById('fc-prime')?.value) || 280;
    const filter = document.getElementById('concrete-zone-filter')?.value || 'ALL';
    
    let data = window.concreteData;
    if (filter !== 'ALL') {
        if (filter === 'A_ALL') { data = data.filter(d => d.zone && d.zone.startsWith('A_')); } 
        else if (filter === 'B_ALL') { data = data.filter(d => d.zone && d.zone.startsWith('B_')); } 
        else { data = data.filter(d => d.zone === filter); }
    }
    
    let totalAvg = 0, totalRange = 0, n = data.length;
    
    if (n > 0) {
        let minAvg = Infinity; let passCount = 0; const averages = [];
        data.forEach(d => { 
            totalAvg += d.avg; totalRange += d.range; averages.push(d.avg);
            if(d.avg < minAvg) minAvg = d.avg;
            if(d.avg >= targetFc) passCount++;
        });
        const X_bar = totalAvg / n; const R_bar = totalRange / n;
        let varianceSum = 0; averages.forEach(val => { varianceSum += Math.pow(val - X_bar, 2); });
        const sd = Math.sqrt(varianceSum / n);
        const passRate = ((passCount / n) * 100).toFixed(1);

        renderConcreteUI(X_bar, X_bar + (A2 * R_bar), X_bar - (A2 * R_bar), R_bar, D4 * R_bar, targetFc, data);
        generateAIReport(n, X_bar, targetFc, minAvg, passRate, sd, D4 * R_bar, filter);
    } else {
        renderConcreteUI(0, 0, 0, 0, 0, targetFc, []);
        generateAIReport(0, 0, targetFc, 0, 0, 0, 0, filter);
    }
};

window.renderConcreteUI = (CL, UCL, LCL, R_CL, R_UCL, fcPrime, data) => {
    const tbody = document.getElementById('concrete-body'); 
    if(!tbody) return;
    tbody.innerHTML = '';
    document.getElementById('concrete-count').innerText = `總計: ${data.length} 組`;
    
    if(data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 font-bold">目前此區域尚無檢驗資料。</td></tr>`; }
    
    data.forEach(d => {
        const isFail = d.avg < fcPrime;
        const avgClass = isFail ? 'text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1' : 'text-blue-700';
        const zLabel = zoneMap[d.zone] || d.zone || '未歸類';
        
        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-200">
            <td class="p-3 text-center text-slate-600 font-bold">${d.date.replace(/^\d{4}-/, '')}</td>
            <td class="p-3 text-center font-black text-indigo-700">${zLabel}</td>
            <td class="p-3 text-center text-slate-800 font-black">${d.id}</td>
            <td class="p-3 text-center text-slate-500 font-bold">${d.s1}/${d.s2}/${d.s3}</td>
            <td class="p-3 text-center bg-blue-50/50"><span class="font-black ${avgClass}">${d.avg.toFixed(1)}</span></td>
            <td class="p-3 text-center bg-orange-50/50 font-black text-orange-700">${d.range.toFixed(1)}</td>
            <td class="p-3 text-center no-print"><button onclick="deleteConcreteRecord(${d.timestamp})" class="bg-slate-200 hover:bg-red-500 text-slate-600 hover:text-white w-8 h-8 rounded-full transition shadow-sm"><i class="fa-solid fa-trash-can text-sm"></i></button></td>
        </tr>`;
    });

    if(data.length > 0) {
        document.getElementById('x-bar-stats').innerHTML = `UCL: <span class="text-blue-600">${UCL.toFixed(1)}</span> | CL: <span class="text-emerald-600">${CL.toFixed(1)}</span> | LCL: <span class="text-orange-600">${LCL.toFixed(1)}</span>`;
        document.getElementById('r-chart-stats').innerHTML = `UCL: <span class="text-red-600">${R_UCL.toFixed(1)}</span> | CL: <span class="text-emerald-600">${R_CL.toFixed(1)}</span>`;
    } else {
        document.getElementById('x-bar-stats').innerHTML = "等待數據..."; document.getElementById('r-chart-stats').innerHTML = "等待數據...";
    }

    const labels = data.map(d => `${d.id}`);
    const dataX = data.map(d => d.avg);
    const dataR = data.map(d => d.range);
    const hasData = data.length > 0;

    const ctxX = document.getElementById('xBarChart');
    if(ctxX) {
        if(window.xBarChartInst) window.xBarChartInst.destroy();
        window.xBarChartInst = new Chart(ctxX.getContext('2d'), { type: 'line', data: { labels: labels, datasets: [
            { label: '平均強度 (X)', data: dataX, borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)', pointBackgroundColor: '#1E3A8A', borderWidth: 3, pointRadius: 5, fill: true, tension: 0.2 },
            { label: `總平均 (CL)`, data: hasData ? dataX.map(()=>CL) : [], borderColor: '#10B981', borderWidth: 2, pointRadius: 0, borderDash: [5,5] },
            { label: `上限 (UCL)`, data: hasData ? dataX.map(()=>UCL) : [], borderColor: '#F59E0B', borderWidth: 2, pointRadius: 0 },
            { label: `下限 (LCL)`, data: hasData ? dataX.map(()=>LCL) : [], borderColor: '#F59E0B', borderWidth: 2, pointRadius: 0 },
            { label: `設計強度 (${fcPrime})`, data: hasData ? dataX.map(()=>fcPrime) : [], borderColor: '#EF4444', borderWidth: 3, pointRadius: 0, borderDash: [6,6] }
        ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }});
    }

    const ctxR = document.getElementById('rChart');
    if(ctxR) {
        if(window.rChartInst) window.rChartInst.destroy();
        window.rChartInst = new Chart(ctxR.getContext('2d'), { type: 'line', data: { labels: labels, datasets: [
            { label: '全距 (R)', data: dataR, borderColor: '#B45309', backgroundColor: 'rgba(180, 83, 9, 0.1)', pointBackgroundColor: '#78350F', borderWidth: 3, pointRadius: 5, fill: true, tension: 0.2 },
            { label: `全距平均 (CL)`, data: hasData ? dataR.map(()=>R_CL) : [], borderColor: '#10B981', borderWidth: 2, pointRadius: 0, borderDash: [5,5] },
            { label: `上限 (UCL)`, data: hasData ? dataR.map(()=>R_UCL) : [], borderColor: '#EF4444', borderWidth: 2, pointRadius: 0 }
        ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }});
    }
};

const generateAIReport = (total, avg, target, min, passRate, sd, uclR, scope) => {
    let reportContainer = document.getElementById('ai-report-wrapper');
    if(!reportContainer) return;
    
    const scopeLabel = zoneMap[scope] || scope;
    
    let reportHtml = `
        <div class="col-span-1 xl:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-sm mt-6 mb-8">
            <h3 class="text-lg font-black text-amber-900 mb-4 flex items-center gap-2">
                <i class="fa-solid fa-robot text-amber-600 text-xl"></i> AI 專家系統品質診斷報告 (ACI 214) - ${scopeLabel}
            </h3>
            <div id="ai-report-content" class="text-[15px] text-slate-800 font-bold leading-relaxed bg-white/80 p-5 rounded-xl border border-amber-300 shadow-inner">
    `;

    if(total === 0) {
        reportHtml += `目前於 <b>${scopeLabel}</b> 尚無足夠數據進行統計分析。</div></div>`;
        reportContainer.innerHTML = reportHtml; return;
    }

    reportHtml += `<p class="mb-3">本次針對 <b>${scopeLabel}</b> 分析共計 <b>${total}</b> 組壓測數據，設計強度目標值為 <b>${target}</b> kgf/cm²。</p>`;
    
    let sdStr = '';
    if (sd < 15) sdStr = '<span class="text-emerald-600 font-black">極佳 (標準差 < 15)</span>，數據極為集中，拌合控制非常穩定。';
    else if (sd < 30) sdStr = '<span class="text-blue-600 font-black">正常 (標準差 15~30)</span>，變異度符合一般施工規範要求。';
    else sdStr = '<span class="text-amber-600 font-black">偏高 (標準差 > 30)</span>，顯示該區段波動顯著，建議查核施工穩定度。';
    
    let highRangeCount = 0;
    let currentData = filter === 'ALL' ? window.concreteData : 
                      (scope === 'A_ALL' ? window.concreteData.filter(d=>d.zone && d.zone.startsWith('A_')) :
                      (scope === 'B_ALL' ? window.concreteData.filter(d=>d.zone && d.zone.startsWith('B_')) : 
                      window.concreteData.filter(d=>d.zone === scope)));
                      
    currentData.forEach(d => { if(d.range > uclR) highRangeCount++; });
    let rangeWarning = '';
    if(highRangeCount > 0) rangeWarning = `<br><span class="text-red-600 bg-red-100 px-2 py-0.5 rounded text-sm ml-1 animate-pulse">⚠️ 警告：發現 ${highRangeCount} 組試體組內全距超越 R-UCL，試驗離散度偏高。</span>`;

    reportHtml += `<p class="mb-3">1. <b>均勻度變異指標：</b> ${scopeLabel} 強度標準差為 <b>${sd.toFixed(1)}</b>，評估為 ${sdStr}${rangeWarning}</p>`;

    if (passRate == 100) {
        reportHtml += `<p class="mb-3">2. <b>合格率檢核：</b> 區間內抗壓強度 <b class="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">100% 達標</b>。平均強度達 <b>${avg.toFixed(1)}</b> kgf/cm²。</p>`;
        reportHtml += `<div class="mt-5 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 rounded shadow-sm"><div class="font-black mb-1"><i class="fa-solid fa-check-circle"></i> AI 綜合判定：</div>「${scopeLabel} 品質表現正常且安全達標，符合 ACI 214 要求，可繼續維持當前施工與澆置作業。」</div>`;
    } else {
        reportHtml += `<p class="mb-3">2. <b>合格率檢核：</b> ${scopeLabel} 合格率為 <b class="text-red-600 bg-red-100 px-2 py-0.5 rounded">${passRate}%</b>，出現低於設計標準值 (最低 <b class="text-red-600">${min}</b> kgf/cm²)。</p>`;
        reportHtml += `<div class="mt-5 p-4 bg-red-50 border-l-4 border-red-500 text-red-900 rounded shadow-sm"><div class="font-black mb-1"><i class="fa-solid fa-triangle-exclamation animate-pulse"></i> AI 警報判定：</div>「${scopeLabel} 內有試驗點低於法規標準！請立即針對該區塊查驗配比、現場加水狀況與試體養護環境，必要時進行非破壞檢測或鑽心試驗。」</div>`;
    }

    reportHtml += `</div></div>`;
    reportContainer.innerHTML = reportHtml;
};

// 開啟與關閉指南彈窗的函數
window.openGuideModal = () => { document.getElementById('guide-modal').classList.remove('hidden'); };
window.closeGuideModal = () => { document.getElementById('guide-modal').classList.add('hidden'); };

initFirebase();
