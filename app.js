import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyAp1ZVuW95Api3kaQUPgttESZ0RGTEi8H8", authDomain: "cdc-qc-system.firebaseapp.com", projectId: "cdc-qc-system", storageBucket: "cdc-qc-system.firebasestorage.app", messagingSenderId: "745920606237", appId: "1:745920606237:web:7fb9c22a84de208e6e56f4" };
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx1aCB8jyqFnPrekpu3QIAIWCaIpAeRIVjJOkDxTpzjOhw9oAk86NO4f1YhL6TkiZQedA/exec";

window.defaultSpecialPiles = { '23': 'FULL', '54': 'PARTIAL', '100': 'FULL', '135': 'PARTIAL', '174': 'FULL', '201': 'PARTIAL', '251': 'PARTIAL', '283': 'FULL', '339': 'FULL', '377': 'FULL', '432': 'FULL', '476': 'FULL' };
window.exceptionDates = []; window.exceptionA = []; window.exceptionB = []; 
window.extraWorkA = []; window.extraWorkB = []; 
window.pileNumbers = {}; window.statusSample = {}; window.statusLab = {}; window.statusTest = {}; window.remarks = {}; window.contractorReports = {}; 
window.specialPilesData = window.defaultSpecialPiles; 
window.scheduleData = []; window.concreteData = []; 
window.currentFilter = 'ALL'; window.currentView = 'table'; window.currentCalDate = new Date(2026, 4, 1); window.currentSmartFilter = 'ALL'; 
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
                        window.exceptionDates = data.exceptionDates || []; window.exceptionA = data.exceptionA || []; window.exceptionB = data.exceptionB || [];
                        window.extraWorkA = data.extraWorkA || []; window.extraWorkB = data.extraWorkB || []; 
                        window.pileNumbers = data.pileNumbers || {}; window.statusSample = data.statusSample || {}; window.statusLab = data.statusLab || {};
                        window.statusTest = data.statusTest || data.completionStatus || {}; window.remarks = data.remarks || {}; window.contractorReports = data.contractorReports || {};
                        window.specialPilesData = data.specialPilesDataStr ? JSON.parse(data.specialPilesDataStr) : (data.specialPilesData || window.defaultSpecialPiles);
                    }
                    window.refreshAll();
                });
                onSnapshot(doc(db, 'scheduleData', 'concreteState'), (snapshot) => {
                    window.concreteData = snapshot.exists() ? snapshot.data().records : [];
                    if (window.currentView === 'concrete') window.calculateConcreteStats();
                });
            }
        });
    } catch (e) { alert("雲端連線失敗"); }
};

window.saveDataToCloud = async () => { 
    if (isCloudEnabled && auth.currentUser) { 
        await setDoc(doc(db, 'scheduleData', 'mainState'), { 
            exceptionDates: window.exceptionDates, exceptionA: window.exceptionA, exceptionB: window.exceptionB, extraWorkA: window.extraWorkA, extraWorkB: window.extraWorkB, pileNumbers: window.pileNumbers, statusSample: window.statusSample, statusLab: window.statusLab, statusTest: window.statusTest, remarks: window.remarks, contractorReports: window.contractorReports, specialPilesDataStr: JSON.stringify(window.specialPilesData)
        }, { merge: true }); 
    } 
};
window.saveConcreteDataToCloud = async () => {
    if (isCloudEnabled && auth.currentUser) { await setDoc(doc(db, 'scheduleData', 'concreteState'), { records: window.concreteData }, { merge: true }); }
    else { localStorage.setItem('Concrete_ACI214_DB', JSON.stringify(window.concreteData)); }
};

window.toDateString = (d) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dt=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dt}`; };
window.formatMinguo = (d) => { const y=d.getFullYear()-1911; const m=String(d.getMonth()+1).padStart(2,'0'); const dt=String(d.getDate()).padStart(2,'0'); return `${y}/${m}/${dt}`; };
const addDays = (d, days) => { let r=new Date(d); r.setDate(r.getDate()+days); return r; };

window.refreshAll = () => {
    window.generateSchedule();
    window.renderTable(window.currentFilter);
    window.updateDashboard();
    window.renderMap();
    if (window.currentView === 'calendar') window.renderCalendar();
    window.updateExtraUI();
};

window.generateSchedule = () => {
    window.scheduleData.length = 0; const startDateA = new Date(2026, 4, 5); const startDateB = new Date(2026, 4, 9); const endDate = new Date(2026, 6, 30); let cA = 1, cB = 1;
    for (let d = new Date(startDateA); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dStr = window.toDateString(d); const isSun = d.getDay() === 0;
        const isExA = window.exceptionDates.includes(dStr) || window.exceptionA.includes(dStr);
        const isExB = window.exceptionDates.includes(dStr) || window.exceptionB.includes(dStr);
        const makeR = (m, c, t) => { 
            let dem = addDays(t, 1); if (dem.getDay() === 0) dem = addDays(dem, 1);
            let col = new Date(dem); while (col.getDay() !== 2 && col.getDay() !== 5) col = addDays(col, 1);
            let tes = addDays(t, 28); if (tes.getDay() === 6) tes = addDays(tes, 2); else if (tes.getDay() === 0) tes = addDays(tes, 1);
            return { id: `${m}${c}`, machine: m, sampleDate: new Date(t), demoldDate: dem, collectDate: col, testDate: tes };
        };
        if (d >= startDateA && ((!isSun && !isExA) || window.extraWorkA.includes(dStr))) { window.scheduleData.push(makeR('A', cA++, new Date(d))); }
        if (d >= startDateB && ((!isSun && !isExB) || window.extraWorkB.includes(dStr))) { window.scheduleData.push(makeR('B', cB++, new Date(d))); }
    }
};

window.toggleView = (v) => { 
    window.currentView = v; 
    document.getElementById('table-view').classList.toggle('hidden', v !== 'table'); 
    document.getElementById('calendar-view').classList.toggle('hidden', v !== 'calendar'); 
    const btnTable = document.getElementById('btn-view-table'); const btnCal = document.getElementById('btn-view-cal');
    if(btnTable) btnTable.className = v === 'table' ? "px-4 py-1.5 rounded-md text-sm font-black bg-slate-800 text-white shadow transition" : "px-4 py-1.5 rounded-md text-sm font-black bg-slate-100 text-slate-700 hover:bg-slate-300 transition border border-slate-300";
    if(btnCal) btnCal.className = v === 'calendar' ? "px-4 py-1.5 rounded-md text-sm font-black bg-slate-800 text-white shadow transition" : "px-4 py-1.5 rounded-md text-sm font-black bg-transparent text-slate-700 hover:bg-slate-300 transition";
    if (v === 'calendar') window.renderCalendar(); 
};

window.switchView = (viewId) => {
    document.getElementById('tab-schedule').classList.remove('active');
    document.getElementById('tab-concrete').classList.remove('active');
    document.getElementById('view-schedule').classList.add('hidden');
    document.getElementById('view-concrete').classList.add('hidden');
    document.getElementById(`tab-${viewId}`).classList.add('active');
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'concrete') { setTimeout(() => window.calculateConcreteStats(), 50); }
};

// 🔥 支援 5 區域過濾
window.filterData = (f) => { 
    window.currentFilter = f; 
    ['btn-ALL', 'btn-A', 'btn-B', 'btn-POND_A', 'btn-POND_BC'].forEach(id => {
        const b = document.getElementById(id);
        if(b) b.className = "px-3 py-1.5 rounded-lg text-xs font-black bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-100 transition";
    });
    const activeBtn = document.getElementById('btn-' + f);
    if(activeBtn) activeBtn.className = "px-3 py-1.5 rounded-lg text-xs font-black bg-slate-800 text-white shadow border border-slate-900 transition";
    if(window.currentView === 'calendar') { window.renderCalendar(); } else { window.renderTable(f); }
};

window.setSmartFilter = (type) => {
    window.currentSmartFilter = type;
    const btnAll = document.getElementById('filter-smart-all'), btnField = document.getElementById('filter-smart-field'), btnTest = document.getElementById('filter-smart-test');
    [btnAll, btnField, btnTest].forEach(b => b.className = "px-3 py-1.5 rounded-md text-sm font-bold text-slate-500 hover:text-slate-800 transition");
    if(type === 'ALL') btnAll.className = "px-3 py-1.5 rounded-md text-sm font-black bg-white text-slate-800 shadow-sm border border-slate-200";
    if(type === 'FIELD') btnField.className = "px-3 py-1.5 rounded-md text-sm font-black bg-[#1E3A8A] text-white shadow-sm";
    if(type === 'TEST') btnTest.className = "px-3 py-1.5 rounded-md text-sm font-black bg-[#166534] text-white shadow-sm";
    window.renderTable(window.currentFilter);
};

window.scrollToTodo = () => {
    window.setSmartFilter('ALL'); 
    setTimeout(() => {
        const today = new Date(); today.setHours(0,0,0,0); let targetId = null;
        for (let item of window.scheduleData) {
            const isS = window.statusSample[item.id], isL = window.statusLab[item.id], isT = window.statusTest[item.id];
            if (!isS && item.sampleDate <= today) { targetId = item.id; break; }
            if (!isL && item.collectDate <= today) { targetId = item.id; break; }
            if (!isT && item.testDate <= today) { targetId = item.id; break; }
        }
        if (!targetId) { for (let item of window.scheduleData) { if (!window.statusSample[item.id] || !window.statusLab[item.id] || !window.statusTest[item.id]) { targetId = item.id; break; } } }
        if (targetId) {
            const row = document.getElementById(`row-${targetId}`);
            if (row) { row.scrollIntoView({behavior: 'smooth', block: 'center'}); row.classList.add('bg-amber-100', 'ring-4', 'ring-amber-400', 'transition-all', 'duration-500'); setTimeout(() => row.classList.remove('bg-amber-100', 'ring-4', 'ring-amber-400'), 3000); }
        } else { window.showModal("任務皆已完成", "所有表單中的排程皆已結案！", "success"); }
    }, 100);
};

window.renderTable = (filter) => {
    const tbody = document.getElementById('schedule-body'); tbody.innerHTML = '';
    const searchTerm = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    let filteredData = window.scheduleData.filter(i => {
        if (filter === 'ALL') return true;
        if (filter === 'A' || filter === 'B') return i.machine === filter;
        // 額外分區條件對應自訂備註或樁號字串
        const pStr = window.pileNumbers[i.id] || '';
        return pStr.includes(filter) || (window.remarks[i.id] || '').includes(filter);
    });
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    
    filteredData.forEach(item => {
        const isS = window.statusSample[item.id], isL = window.statusLab[item.id], isT = window.statusTest[item.id];
        const pNum = window.pileNumbers[item.id] || '';
        const pileCount = (String(pNum).match(/\d+/g) || []).length;
        const countBadge = pileCount > 0 ? `<div class="bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded text-center text-sm shadow-sm border border-blue-200">${pileCount}</div>` : `<div class="text-slate-300 font-black text-center">-</div>`;

        if (window.currentSmartFilter === 'FIELD' && isL) return; 
        if (window.currentSmartFilter === 'TEST' && (!isL || isT)) return; 
        if (searchTerm && !item.id.toLowerCase().includes(searchTerm) && !String(pNum).includes(searchTerm)) return;
        
        const tr = document.createElement('tr'); 
        tr.id = `row-${item.id}`; 
        tr.className = `modern-row row-hover divide-slate-200 divide-x-0 ${isT ? 'completed-row' : ''}`;
        
        let testBadge = '';
        if (!isT && isL) { 
            const diffTime = item.testDate - todayDate; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 0) testBadge = `<span class="ml-1 bg-red-600 text-white px-2 py-0.5 rounded text-[11px] font-black animate-pulse shadow-sm border border-red-700 whitespace-nowrap">今日壓測</span>`;
            else if (diffDays > 0 && diffDays <= 3) testBadge = `<span class="ml-1 bg-amber-500 text-white px-2 py-0.5 rounded text-[11px] font-black shadow-sm border border-amber-600 whitespace-nowrap">剩${diffDays}天</span>`;
            else if (diffDays < 0) testBadge = `<span class="ml-1 bg-slate-600 text-white px-2 py-0.5 rounded text-[11px] font-black shadow-sm border border-slate-700 whitespace-nowrap">逾期${Math.abs(diffDays)}天</span>`;
        }

        tr.innerHTML = `
            <td class="font-black text-slate-800">${item.id}</td>
            <td>${countBadge}</td>
            <td class="pl-3 pr-3"><input type="text" class="pile-input" title="${pNum}" ${isT ? 'readonly' : ''} onchange="updatePile('${item.id}', this.value)" placeholder="輸入對應樁號..." value="${pNum}"></td>
            <td class="bg-blue-50/70"><label class="flex justify-center items-center gap-1.5 cursor-pointer w-full h-full"><input type="checkbox" class="status-checkbox cb-sample" ${isS?'checked':''} onclick="toggleStatus('${item.id}', 'sample')"><span class="font-black whitespace-nowrap text-[15px] ${isS?'text-slate-400 line-through':'text-[#1E3A8A]'}">${window.formatMinguo(item.sampleDate).split('(')[0]}</span></label></td>
            <td class="font-bold text-slate-600 whitespace-nowrap text-[15px]">${window.formatMinguo(item.demoldDate).split('(')[0]}</td>
            <td class="bg-orange-50/70"><label class="flex justify-center items-center gap-1.5 cursor-pointer w-full h-full"><input type="checkbox" class="status-checkbox cb-lab" ${isL?'checked':''} onclick="toggleStatus('${item.id}', 'lab')"><span class="font-black whitespace-nowrap text-[15px] ${isL?'text-slate-400 line-through':'text-[#B45309]'}">${window.formatMinguo(item.collectDate).split('(')[0]}</span></label></td>
            <td class="bg-green-50/70"><label class="flex justify-center items-center gap-1.5 cursor-pointer w-full h-full"><input type="checkbox" class="status-checkbox cb-test" ${isT?'checked':''} onclick="toggleStatus('${item.id}', 'test')"><span class="font-black whitespace-nowrap flex flex-col justify-center items-center text-[15px] ${isT?'text-slate-400 line-through':'text-[#166534]'}"><span>${window.formatMinguo(item.testDate).split('(')[0]}</span>${testBadge}</span></label></td>
            <td class="pl-3 pr-3"><input type="text" class="remark-input" ${isT?'readonly':''} onchange="updateRemark('${item.id}', this.value)" placeholder="輸入備註或狀態..." value="${window.remarks[item.id]||''}"></td>
        `;
        tbody.appendChild(tr);
    });
};

window.toggleStatus = (id, type) => { 
    if (type === 'sample') window.statusSample[id] = !window.statusSample[id]; 
    if (type === 'lab') window.statusLab[id] = !window.statusLab[id]; 
    if (type === 'test') window.statusTest[id] = !window.statusTest[id]; 
    window.saveDataToCloud(); window.refreshAll(); 
};
window.updatePile = (id, val) => { const v = val.trim(); if (!v) delete window.pileNumbers[id]; else window.pileNumbers[id] = v; window.saveDataToCloud(); window.refreshAll(); };
window.updateRemark = (id, val) => { const v = val.trim(); if (!v) delete window.remarks[id]; else window.remarks[id] = v; window.saveDataToCloud(); };

window.updateDashboard = () => {
    const usedA = new Set(); const usedB = new Set(); const workedDates = new Set(); const donePilesList = [];
    Object.entries(window.pileNumbers).forEach(([id, val]) => { 
        const nums = (String(val).match(/\d+/g) || []).map(n => parseInt(n, 10)); 
        if (nums.length > 0) { 
            nums.forEach(n => { donePilesList.push(n); if (id.startsWith('A')) usedA.add(n); else if (id.startsWith('B')) usedB.add(n); }); 
            const item = window.scheduleData.find(s => s.id === id); if (item) workedDates.add(window.toDateString(item.sampleDate)); 
        } 
    });
    const countA = usedA.size; const countB = usedB.size; const pilesCount = countA + countB; const workedDays = workedDates.size;
    const maxDonePile = Math.max(...donePilesList, 0);
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    
    document.getElementById('prog-piles-ab').innerText = `A: ${countA} | B: ${countB}`;
    document.getElementById('prog-piles-text').innerText = pilesCount;
    const pilesPct = ((pilesCount/TOTAL_PILES_LIMIT)*100).toFixed(1);
    document.getElementById('prog-piles-pct').innerText = `${pilesPct}%`;
    document.getElementById('prog-piles-bar').style.width = `${pilesPct}%`;

    let cS=0, cL=0, cT=0; window.scheduleData.forEach(i => { if(window.statusSample[i.id]) cS++; if(window.statusLab[i.id]) cL++; if(window.statusTest[i.id]) cT++; });
    document.getElementById('prog-sample-text').innerText = cS; document.getElementById('prog-sample-total').innerText = `/ ${window.scheduleData.length} 組`; document.getElementById('prog-sample-bar').style.width = `${window.scheduleData.length > 0 ? (cS/window.scheduleData.length)*100 : 0}%`;
    document.getElementById('prog-lab-text').innerText = cL; document.getElementById('prog-lab-total').innerText = `/ ${window.scheduleData.length} 組`; document.getElementById('prog-lab-bar').style.width = `${window.scheduleData.length > 0 ? (cL/window.scheduleData.length)*100 : 0}%`;
    document.getElementById('prog-test-text').innerText = cT; document.getElementById('prog-test-total').innerText = `/ ${window.scheduleData.length} 組`; document.getElementById('prog-test-bar').style.width = `${window.scheduleData.length > 0 ? (cT/window.scheduleData.length)*100 : 0}%`;

    let nextTestDate = null; let nextTestDays = Infinity;
    window.scheduleData.forEach(item => { 
        if (!window.statusTest[item.id] && window.statusLab[item.id]) { 
            const diffTime = item.testDate - todayDate; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays < nextTestDays) { nextTestDays = diffDays; nextTestDate = item.testDate; } 
        } 
    });
    const nextTestEl = document.getElementById('next-test-info');
    if (nextTestDate) {
        let tagClass = "bg-green-100 text-green-800 border border-green-300"; let daysText = `剩 ${nextTestDays} 天`;
        if (nextTestDays === 0) { tagClass = "bg-red-500 text-white animate-pulse border border-red-700"; daysText = "今日壓測!"; } else if (nextTestDays <= 3 && nextTestDays > 0) tagClass = "bg-amber-400 text-amber-900 border border-amber-500"; else if (nextTestDays < 0) { tagClass = "bg-slate-600 text-white border border-slate-800"; daysText = `逾期 ${Math.abs(nextTestDays)} 天`; }
        nextTestEl.innerHTML = `近期: ${window.formatMinguo(nextTestDate).split('(')[0]} <span class="ml-1 font-black opacity-90">(${daysText})</span>`;
        nextTestEl.className = `text-[10px] md:text-[11px] font-black px-2 py-0.5 rounded shadow-sm ${tagClass}`;
    } else { nextTestEl.innerHTML = "無待壓測排程"; nextTestEl.className = "text-[10px] md:text-[11px] font-bold text-green-200 bg-green-800 px-2 py-0.5 rounded border border-green-900"; }

    if (pilesCount > 0 && workedDays > 0) {
        const avgRate = pilesCount / workedDays; 
        const estDays = Math.ceil((TOTAL_PILES_LIMIT - pilesCount) / avgRate);
        let simDate = new Date(); let added = 0; 
        while(added < estDays) { 
            simDate.setDate(simDate.getDate() + 1); 
            const dStr = window.toDateString(simDate); 
            const isExGlobal = window.exceptionDates.includes(dStr); const isExA = isExGlobal || window.exceptionA.includes(dStr); const isExB = isExGlobal || window.exceptionB.includes(dStr); 
            if (simDate.getDay() !== 0 && (!isExA || !isExB)) added++; 
        }
        document.getElementById('prediction-metrics').innerHTML = `<div class="bg-white border border-slate-200 px-4 py-2 rounded-lg flex flex-col items-center"><span class="text-[10px] font-black text-slate-500 uppercase">動態產能</span><span class="text-xl font-black text-slate-800">${avgRate.toFixed(1)} <span class="text-xs text-slate-500 font-bold">支/日</span></span></div><div class="bg-white border border-slate-200 px-4 py-2 rounded-lg flex flex-col items-center"><span class="text-[10px] font-black text-slate-500 uppercase">預估剩餘</span><span class="text-xl font-black text-[#B45309]">${estDays} <span class="text-xs text-slate-500 font-bold">天</span></span></div><div class="bg-orange-50 border border-orange-300 px-4 py-2 rounded-lg flex flex-col items-center"><span class="text-[10px] font-black text-orange-600 uppercase">預估完工日</span><span class="text-xl font-black text-[#B45309]">${window.formatMinguo(simDate).split('(')[0]}</span></div>`;
    } else {
        document.getElementById('prediction-metrics').innerHTML = `<div class="text-slate-500 font-bold px-4 py-2 bg-slate-50 rounded-lg w-full text-center text-sm">歷史數據掃描中...</div>`;
    }

    const radarContainer = document.getElementById('special-pile-radar'); let radarHtml = '';
    Object.entries(window.specialPilesData).sort((a,b)=> Number(a[0]) - Number(b[0])).forEach(([pId, type]) => {
        if (!pId || pId === 'NaN' || pId === '0') return; 
        const idNum = Number(pId);
        const typeIcon = type === 'FULL' ? '<i class="fa-solid fa-layer-group" title="傾度/應力/完整性試驗"></i>' : '<i class="fa-solid fa-ruler-combined" title="傾度/應力計"></i>';
        
        let sClass = 'bg-slate-100 border-slate-300 text-slate-600', sText = '待命中', tagColor = 'bg-slate-700 text-white';

        if (donePilesList.includes(idNum)) {
            sClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-60'; sText = '已完成'; tagColor = 'bg-emerald-600 text-white';
        } else if (donePilesList.includes(idNum - 1) || donePilesList.includes(idNum + 1) || donePilesList.includes(idNum - 2) || donePilesList.includes(idNum + 2)) {
            sClass = 'bg-red-50 border-red-400 text-red-700 ring-1 ring-red-400/50 animate-pulse'; sText = '🚨 鄰樁開鑽'; tagColor = 'bg-red-600 text-white shadow-sm';
        } else if (maxDonePile > 0 && maxDonePile >= idNum - 15 && maxDonePile < idNum) {
            sClass = 'bg-amber-50 border-amber-300 text-amber-800'; sText = '⚠️ 逼近中'; tagColor = 'bg-amber-500 text-white shadow-sm';
        }

        radarHtml += `<div class="inline-flex items-center border rounded-full shadow-sm pl-1 pr-2 py-1 transition hover:-translate-y-0.5 ${sClass}"><span class="${tagColor} text-xs font-black px-2 py-1 rounded-full mr-1.5 flex items-center gap-1">${typeIcon} P${idNum}</span><span class="text-xs font-bold whitespace-nowrap">${sText}</span><button onclick="editSpecialPile('${pId}')" class="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-slate-400 hover:text-blue-600 transition"><i class="fa-solid fa-pen text-[9px]"></i></button></div>`;
    });
    radarContainer.innerHTML = radarHtml;
};

window.renderMap = () => {
    const container = document.getElementById('map-container');
    if (!window.baseCoordinates || window.baseCoordinates.length === 0) return; 
    
    const pileStatusMap = {};
    window.scheduleData.forEach(item => {
        const pNumStr = window.pileNumbers[item.id] || '';
        if (!pNumStr) return;
        const nums = (String(pNumStr).match(/\d+/g) || []);
        const isS = window.statusSample[item.id], isL = window.statusLab[item.id], isT = window.statusTest[item.id];
        
        let targetColor = '#FFFFFF', targetStroke = '#1E3A8A', zIndex = 1, textStatus = '已排程(未取樣)'; 
        if (isT) { targetColor = '#166534'; targetStroke = '#14532D'; zIndex = 4; textStatus = '✅ 已壓測結案'; } 
        else if (isL) { targetColor = '#B45309'; targetStroke = '#78350F'; zIndex = 3; textStatus = '🚚 實驗室已收件'; }
        else if (isS) { targetColor = '#1E3A8A'; targetStroke = '#172554'; zIndex = 2; textStatus = '🧱 已取樣'; }

        const sD = item.sampleDate ? window.formatMinguo(item.sampleDate) : '-'; 
        const lD = item.collectDate ? window.formatMinguo(item.collectDate) : '-'; 
        const tD = item.testDate ? window.formatMinguo(item.testDate) : '-';
        nums.forEach(num => { pileStatusMap[num] = { fill: targetColor, stroke: targetStroke, z: zIndex, sDate: sD, lDate: lD, tDate: tD, textStatus: textStatus }; });
    });
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const mappedPoints = window.baseCoordinates.map(arr => {
        const id = arr[0], x = arr[1], y = -arr[2]; 
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        const statusObj = pileStatusMap[id] || { fill: '#F1F5F9', stroke: '#CBD5E1', z: 0, sDate: '-', lDate: '-', tDate: '-', textStatus: '尚未排程' }; 
        return { id, x, y, ...statusObj }; 
    }).sort((a, b) => a.z - b.z);
    
    const paddingX = 1000, paddingY = 1000;
    const viewBoxStr = `${minX - paddingX} ${minY - paddingY} ${(maxX - minX) + paddingX * 2} ${(maxY - minY) + paddingY * 2}`;
    
    let circlesHtml = '';
    mappedPoints.forEach(p => { 
        let specialDeco = '';
        const sType = window.specialPilesData[String(p.id)];
        if (sType) {
            const strokeColor = sType === 'FULL' ? '#60A5FA' : '#FBBF24';
            specialDeco = `<circle cx="${p.x}" cy="${p.y}" r="110" fill="none" stroke="${strokeColor}" stroke-width="25" stroke-dasharray="40,20" class="animate-[spin_10s_linear_infinite]" style="transform-origin: ${p.x}px ${p.y}px"></circle><text x="${p.x}" y="${p.y-120}" font-size="80" fill="${strokeColor}" text-anchor="middle" font-weight="bold">★</text>`;
        }
        circlesHtml += `${specialDeco}<circle id="map-pile-${p.id}" class="pile-circle" cx="${p.x}" cy="${p.y}" r="60" fill="${p.fill}" stroke="${p.stroke}" stroke-width="15" onmouseover="showTooltip(event, '${p.id}', '${p.sDate}', '${p.lDate}', '${p.tDate}', '${p.textStatus}')" onmouseout="hideTooltip()"></circle>`; 
    });
    
    container.innerHTML = `<svg id="interactive-map" width="100%" height="100%" viewBox="${viewBoxStr}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"><g id="map-group">${circlesHtml}</g></svg>`;

    const svg = document.getElementById('interactive-map');
    if(svg) {
        let isDown = false, startX, startY; let vb = viewBoxStr.split(' ').map(Number);
        const startDrag = (clientX, clientY) => { isDown = true; svg.style.cursor = 'grabbing'; startX = clientX; startY = clientY; };
        const moveDrag = (clientX, clientY) => {
            if (!isDown) return; 
            const dx = (startX - clientX) * (vb[2] / svg.clientWidth); const dy = (startY - clientY) * (vb[3] / svg.clientHeight);
            vb[0] += dx; vb[1] += dy; svg.setAttribute('viewBox', vb.join(' ')); startX = clientX; startY = clientY;
        };
        const stopDrag = () => { isDown = false; svg.style.cursor = 'grab'; };

        svg.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
        svg.addEventListener('mouseleave', stopDrag);
        svg.addEventListener('mouseup', stopDrag);
        svg.addEventListener('mousemove', e => { e.preventDefault(); moveDrag(e.clientX, e.clientY); });
        
        svg.addEventListener('touchstart', e => { if(e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
        svg.addEventListener('touchmove', e => { if(e.touches.length === 1) { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); } }, {passive: false});
        svg.addEventListener('touchend', stopDrag);

        svg.addEventListener('wheel', e => {
            e.preventDefault(); const scale = e.deltaY > 0 ? 1.2 : 0.8; const rect = svg.getBoundingClientRect();
            const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
            const vx = vb[0] + (mx / svg.clientWidth) * vb[2]; const vy = vb[1] + (my / svg.clientHeight) * vb[3];
            vb[2] *= scale; vb[3] *= scale; vb[0] = vx - (mx / svg.clientWidth) * vb[2]; vb[1] = vy - (my / svg.clientHeight) * vb[3];
            svg.setAttribute('viewBox', vb.join(' '));
        }, {passive: false});
    }
};

window.showTooltip = (evt, pile, sDate, lDate, tDate, status) => {
    const tooltip = document.getElementById('map-tooltip');
    tooltip.style.display = 'block'; tooltip.style.left = (evt.pageX + 15) + 'px'; tooltip.style.top = (evt.pageY + 15) + 'px';
    let sType = window.specialPilesData[String(pile)]; let spAlert = '';
    if (sType) {
        const tName = sType === 'FULL' ? '安全監測樁 (全項)' : '安全監測樁 (部分)';
        const tColor = sType === 'FULL' ? 'text-blue-400' : 'text-amber-400';
        spAlert = `<div class="${tColor} text-[12px] mb-1 font-black"><i class="fa-solid fa-star"></i> ${tName}</div>`;
    }
    tooltip.innerHTML = `${spAlert}<div class="font-black text-base mb-1 border-b border-slate-500 pb-1 text-blue-100">樁號: P${pile}</div><div class="text-sm my-1 text-amber-300">狀態: ${status}</div><div class="text-[13px] text-slate-300 mt-2">取樣日: ${sDate}</div><div class="text-[13px] text-slate-300">收件日: ${lDate}</div><div class="text-[13px] text-slate-300">壓測日: ${tDate}</div>`;
};
window.hideTooltip = () => { document.getElementById('map-tooltip').style.display = 'none'; };

window.renderCalendar = () => { 
    const year = window.currentCalDate.getFullYear(), month = window.currentCalDate.getMonth();
    document.getElementById('calendar-title').innerText = `民國 ${year-1911} 年 ${month+1} 月`;
    const eventsMap = {};
    window.scheduleData.filter(i => window.currentFilter === 'ALL' || i.machine === window.currentFilter).forEach(item => {
        const p = window.pileNumbers[item.id] ? `${item.id}(${window.pileNumbers[item.id]})` : item.id;
        const addE = (dt, type, label, tagClass) => { if (dt.getFullYear() === year && dt.getMonth() === month) { const d = dt.getDate(); if (!eventsMap[d]) eventsMap[d] = []; eventsMap[d].push({ label, tagClass, type }); } };
        addE(item.sampleDate, '取樣', p, 'tag-sample'); addE(item.demoldDate, '拆模', p, 'tag-demold'); addE(item.collectDate, '收件', p, 'tag-lab'); addE(item.testDate, '壓測', p, 'tag-test');
    });
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    const tbody = document.getElementById('calendar-body'); tbody.innerHTML = ''; let date = 1;
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('tr');
        for (let j = 0; j < 7; j++) {
            const cell = document.createElement('td'); cell.className = 'border-r border-b border-slate-300 p-2 align-top h-36 bg-white transition hover:bg-slate-100';
            if (j === 0 || j === 6) cell.classList.add('bg-slate-100/50');
            if (i === 0 && j < firstDay || date > daysInMonth) { cell.innerHTML = ''; } else {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
                const isExGlobal = window.exceptionDates.includes(dateStr); const isExA = window.exceptionA.includes(dateStr); const isExB = window.exceptionB.includes(dateStr);
                let exBadge = '';
                if(isExGlobal) exBadge = `<span class="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm font-black border border-red-700 whitespace-nowrap">全區停</span>`; else if (isExA && isExB) exBadge = `<span class="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm font-black border border-red-700 whitespace-nowrap">A/B停</span>`; else if (isExA) exBadge = `<span class="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm font-black border border-red-600 whitespace-nowrap">A停</span>`; else if (isExB) exBadge = `<span class="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm font-black border border-red-600 whitespace-nowrap">B停</span>`;
                let isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === date;
                let cellHtml = `<div class="font-black text-lg mb-1 flex justify-between items-center"><span class="${isToday ? 'bg-slate-800 text-white rounded px-2.5 py-1 shadow-sm' : 'text-slate-600'}">${date}</span> ${exBadge}</div><div class="flex flex-col gap-1 overflow-y-auto max-h-24 calendar-scroll pr-1">`;
                if (eventsMap[date]) { eventsMap[date].forEach(e => { cellHtml += `<div class="cal-tag ${e.tagClass} break-all text-[11px] p-1"><b>${e.type}:</b> ${e.label}</div>`; }); }
                cellHtml += `</div>`; 
                if(isExGlobal || (isExA && isExB)) cell.classList.add('bg-red-50'); else if (isExA || isExB) cell.classList.add('bg-orange-50/50');
                cell.innerHTML = cellHtml; date++;
            }
            row.appendChild(cell);
        }
        tbody.appendChild(row); if (date > daysInMonth) break;
    }
};

window.openMatrixModal = () => { window.renderMatrixGrid(); document.getElementById('matrix-modal').classList.remove('hidden'); };
window.closeMatrixModal = () => { document.getElementById('matrix-modal').classList.add('hidden'); };
window.renderMatrixGrid = () => {
    const counts = new Array(TOTAL_PILES_LIMIT + 1).fill(0);
    Object.values(window.pileNumbers).forEach(val => { const nums = (String(val).match(/\d+/g) || []).map(n => parseInt(n, 10)); nums.forEach(n => { if (n >= 1 && n <= TOTAL_PILES_LIMIT) counts[n]++; }); });
    const container = document.getElementById('matrix-container'); container.innerHTML = ''; let statMissing = 0, statOk = 0, statError = 0;
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
    window.scheduleData.forEach(item => { const count = (String(window.pileNumbers[item.id] || "")).match(/\d+/g)?.length || 0; if (count > 0) { const dateStr = window.toDateString(item.sampleDate); if (!dailyStats[dateStr]) dailyStats[dateStr] = { A: 0, B: 0, total: 0, dateObj: item.sampleDate, ids: [] }; dailyStats[dateStr][item.machine] += count; dailyStats[dateStr].total += count; dailyStats[dateStr].ids.push(item.id); } });
    const sortedDates = Object.keys(dailyStats).sort((a, b) => new Date(b) - new Date(a));
    const tbody = document.getElementById('recon-body'); tbody.innerHTML = '';
    if(sortedDates.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500 font-black">尚無打設登錄資料</td></tr>'; return; }
    sortedDates.forEach((dStr, index) => {
        const stat = dailyStats[dStr]; const reportVal = window.contractorReports[dStr] !== undefined ? window.contractorReports[dStr] : '';
        let statusHtml = '<span class="text-slate-400 text-sm font-black">- 待填報 -</span>'; 
        if (reportVal !== '') {
            const rNum = parseInt(reportVal, 10);
            if (rNum === stat.total) statusHtml = '<span class="bg-[#F2F7F4] text-[#166534] px-4 py-2 rounded-lg font-black whitespace-nowrap"><i class="fa-solid fa-check"></i> 吻合</span>';
            else statusHtml = `<span class="bg-[#FEF2F2] text-[#DC2626] px-4 py-2 rounded-lg font-black animate-pulse whitespace-nowrap"><i class="fa-solid fa-xmark"></i> 誤差 ${Math.abs(rNum - stat.total)} 支</span>`;
        }
        const idBadges = stat.ids.map(id => `<span class="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs mx-0.5 whitespace-nowrap">${id}</span>`).join('');
        tbody.innerHTML += `<tr class="border-b-2 border-slate-100 hover:bg-slate-50 transition"><td class="p-4 text-center font-black text-slate-600 max-w-[150px] whitespace-normal">${idBadges}</td><td class="p-4 font-black text-slate-700 whitespace-nowrap">${window.formatMinguo(stat.dateObj)}</td><td class="p-4 text-center font-black text-[#1E3A8A] text-lg">${stat.A||'-'}</td><td class="p-4 text-center font-black text-[#1E3A8A] text-lg">${stat.B||'-'}</td><td class="p-4 font-black text-2xl text-slate-900 text-center bg-slate-50/50">${stat.total}</td><td class="p-4 text-center bg-[#FCF9F2]"><input type="number" class="border-2 border-[#B45309] rounded-lg px-3 py-2 w-28 text-center font-black text-[#B45309] text-xl outline-none focus:ring-2 focus:ring-orange-400" value="${reportVal}" onchange="updateContractorReport('${dStr}', this.value)"></td><td class="p-4 text-center">${statusHtml}</td></tr>`;
    });
};

window.exportCSV = () => {
    let csv = "\uFEFF取樣編號,打設樁號,取樣日期,取樣狀態,實驗室收件,收件狀態,抗壓會驗,結案狀態,系統備註\n";
    window.scheduleData.forEach(i => { 
        const p = window.pileNumbers[i.id] || ''; const r = window.remarks[i.id] || '';
        csv += `${i.id},"${p}",${window.toDateString(i.sampleDate)},${window.statusSample[i.id]?'已取樣':'未完成'},${window.toDateString(i.collectDate)},${window.statusLab[i.id]?'已收件':'未完成'},${window.toDateString(i.testDate)},${window.statusTest[i.id]?'已結案':'待辦'},"${r}"\n`; 
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); 
    link.download = `預壘樁進度與試體追蹤表_V17.2正式版.csv`; link.click();
};

window.calculateMaterials = () => { const totalSandM3 = (parseFloat(document.getElementById('calc-sand-bucket').value)||0) * ((parseFloat(document.getElementById('calc-vol').value)||0)/1000) * (parseFloat(document.getElementById('calc-batches').value)||0); const totalCemTon = (parseFloat(document.getElementById('calc-cem-bucket').value)||0) * ((parseFloat(document.getElementById('calc-vol').value)||0)/1000) * (parseFloat(document.getElementById('calc-batches').value)||0) * 1.4; const resDiv = document.getElementById('calc-result'); resDiv.innerHTML = `<div class="flex justify-around items-center"><div class="text-center font-black text-sm text-slate-500">理論砂用量<br><span class="text-2xl font-black text-slate-800">${totalSandM3.toFixed(2)} <span class="text-sm">m³</span></span></div><div class="text-center font-black text-sm text-slate-500">理論水泥用量<br><span class="text-2xl font-black text-slate-800">${totalCemTon.toFixed(2)} <span class="text-sm">噸</span></span></div></div>`; resDiv.classList.remove('hidden'); };

window.addExceptionDate = () => { const m = document.getElementById('exception-machine').value; const val = document.getElementById('exception-date-input').value; if (val) { if (m === 'ALL' && !window.exceptionDates.includes(val)) window.exceptionDates.push(val); if (m === 'A' && !window.exceptionA.includes(val)) window.exceptionA.push(val); if (m === 'B' && !window.exceptionB.includes(val)) window.exceptionB.push(val); window.saveDataToCloud(); document.getElementById('exception-date-input').value = ""; window.refreshAll(); } };
window.removeExceptionDate = (m, val) => { if(m === 'ALL') window.exceptionDates = window.exceptionDates.filter(d => d !== val); if(m === 'A') window.exceptionA = window.exceptionA.filter(d => d !== val); if(m === 'B') window.exceptionB = window.exceptionB.filter(d => d !== val); window.saveDataToCloud(); window.refreshAll(); };
window.addExtraDate = () => { const m = document.getElementById('extra-machine').value; const val = document.getElementById('extra-date-input').value; if (val) { if (m === 'A' && !window.extraWorkA.includes(val)) window.extraWorkA.push(val); if (m === 'B' && !window.extraWorkB.includes(val)) window.extraWorkB.push(val); window.saveDataToCloud(); document.getElementById('extra-date-input').value = ""; window.refreshAll(); } };
window.removeExtraDate = (m, val) => { if (m === 'A') window.extraWorkA = window.extraWorkA.filter(d => d !== val); if (m === 'B') window.extraWorkB = window.extraWorkB.filter(d => d !== val); window.saveDataToCloud(); window.refreshAll(); };

window.updateExtraUI = () => {
    const expAll = document.getElementById('exception-list-all'); if(expAll) expAll.innerHTML = '<span class="text-[10px] text-red-400 font-bold w-full">全區停機：</span>'; 
    const expA = document.getElementById('exception-list-a'); if(expA) expA.innerHTML = '<span class="text-[10px] text-orange-400 font-bold w-full">A車停機：</span>';
    const expB = document.getElementById('exception-list-b'); if(expB) expB.innerHTML = '<span class="text-[10px] text-amber-400 font-bold w-full">B車停機：</span>';
    const renderExTag = (container, m, val) => { if(!container) return; const parts = val.split('-'); const tag = document.createElement('span'); tag.className = "bg-white text-red-700 px-2 py-0.5 rounded text-[11px] font-black border border-red-200 shadow-sm whitespace-nowrap"; tag.innerHTML = `${parts[1]}/${parts[2]} <i class="fa-solid fa-xmark cursor-pointer ml-1 opacity-60 hover:opacity-100" onclick="removeExceptionDate('${m}', '${val}')"></i>`; container.appendChild(tag); };
    window.exceptionDates.forEach(val => renderExTag(expAll, 'ALL', val)); window.exceptionA.forEach(val => renderExTag(expA, 'A', val)); window.exceptionB.forEach(val => renderExTag(expB, 'B', val));
    const extraContainer = document.getElementById('extra-list'); if(extraContainer) { extraContainer.innerHTML = ""; const renderExWTag = (m, val) => { const parts = val.split('-'); const tag = document.createElement('span'); tag.className = "bg-white text-blue-700 px-2 py-0.5 rounded text-[11px] font-black border border-blue-200 shadow-sm whitespace-nowrap"; tag.innerHTML = `${m}車:${parts[1]}/${parts[2]} <i class="fa-solid fa-xmark cursor-pointer ml-1 opacity-60 hover:opacity-100" onclick="removeExtraDate('${m}', '${val}')"></i>`; extraContainer.appendChild(tag); }; window.extraWorkA.forEach(val => renderExWTag('A', val)); window.extraWorkB.forEach(val => renderExWTag('B', val)); }
};

window.searchMapPile = () => { const val = document.getElementById('map-search-input').value.trim(); if (!val) return; const num = val.replace(/\D/g, ''); const circle = document.getElementById('map-pile-' + num); if (circle) { document.querySelectorAll('.pile-circle').forEach(c => c.classList.remove('highlight-pile')); circle.classList.add('highlight-pile'); } else { window.showModal("搜尋失敗", `找不到樁號 P${num} 的座標紀錄。`, "error"); } };
window.showModal = (title, msg, type) => { document.getElementById('custom-modal-header').innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check text-emerald-500' : 'triangle-exclamation text-red-500'}"></i> ${title}`; document.getElementById('custom-modal-message').innerHTML = msg; document.getElementById('custom-modal').classList.remove('hidden'); };
window.closeModal = () => document.getElementById('custom-modal').classList.add('hidden');

window.editSpecialPile = (oldId) => {
    const currentType = window.specialPilesData[oldId]; const newId = prompt(`安全監測樁 P${oldId}：請輸入平移後的新樁號：`, oldId);
    if (newId === null) return; const cleanNewId = newId.trim().replace(/\D/g, '');
    if (cleanNewId === '') { if (confirm(`刪除監測樁 P${oldId}？`)) { delete window.specialPilesData[oldId]; window.saveDataToCloud(); window.refreshAll(); } } 
    else if (cleanNewId !== oldId) { delete window.specialPilesData[oldId]; window.specialPilesData[cleanNewId] = currentType; window.saveDataToCloud(); window.refreshAll(); window.showModal("換樁成功", `✅ 移至 P${cleanNewId}`, "success"); }
};

window.syncFromContractor = async () => {
    const btn = document.getElementById('btn-sync-api'); const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm opacity-80"></i> 同步中...'; btn.disabled = true;
    try {
        const response = await fetch(GAS_API_URL); if (!response.ok) throw new Error("API 回應異常");
        const dataMatrix = await response.json(); const groupedData = {};
        for (let i = 1; i < dataMatrix.length; i++) {
            const cols = dataMatrix[i]; if (cols.length < 6) continue;
            const rawPile = String(cols[0] || '').trim(); const dateStr = String(cols[1] || '').trim().replace(/\//g, '-'); const machine = String(cols[2] || '').trim();
            const pileNum = rawPile.replace(/\D/g, ''); const machLetter = machine.includes('A') ? 'A' : (machine.includes('B') ? 'B' : '');
            if (pileNum && dateStr && machLetter) { const key = `${dateStr}_${machLetter}`; if (!groupedData[key]) groupedData[key] = []; groupedData[key].push(pileNum); }
        }
        let updatedCount = 0;
        window.scheduleData.forEach(item => {
            const itemDateStr = window.toDateString(item.sampleDate); const key = `${itemDateStr}_${item.machine}`;
            if (groupedData[key]) { const newPileStr = groupedData[key].join('、'); if (!window.statusTest[item.id] && window.pileNumbers[item.id] !== newPileStr) { window.pileNumbers[item.id] = newPileStr; updatedCount++; } }
        });
        window.saveDataToCloud(); window.refreshAll(); 
        if (updatedCount > 0) window.showModal("同步成功！", `透過 API 自動更新了 <b class="text-blue-600 text-lg">${updatedCount}</b> 筆排程！`, "success"); 
        else window.showModal("進度載入完成", "目前進度已是最新狀態。", "success"); 
    } catch (error) { window.showModal("API 同步失敗", error.message, "error"); } finally { btn.innerHTML = originalHtml; btn.disabled = false; }
};

// ==========================================
// ACI 214 強度統計分析與 AI 專家診斷 (🔥 5 區域分離統計)
// ==========================================
window.addConcreteRecord = () => {
    const dateStr = document.getElementById('concrete-date').value || window.toDateString(new Date());
    const id = document.getElementById('concrete-id').value.trim() || `P-${Math.floor(Math.random()*1000)}`;
    const s1 = parseFloat(document.getElementById('concrete-s1').value);
    const s2 = parseFloat(document.getElementById('concrete-s2').value);
    const s3 = parseFloat(document.getElementById('concrete-s3').value);
    const machine = document.getElementById('concrete-machine-select').value;

    if(isNaN(s1) || isNaN(s2) || isNaN(s3)) { alert("請完整填寫 3 顆試體數值！"); return; }
    const max = Math.max(s1, s2, s3); const min = Math.min(s1, s2, s3);
    const avg = (s1 + s2 + s3) / 3; const range = max - min;

    window.concreteData.push({ timestamp: Date.now(), date: dateStr, id: id, machine: machine, s1: s1, s2: s2, s3: s3, avg: avg, range: range });
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
    const filter = document.getElementById('concrete-machine-filter')?.value || 'ALL';
    
    let data = filter === 'ALL' ? window.concreteData : window.concreteData.filter(d => d.machine === filter);
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
    
    if(data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500 font-bold">尚無對應區域的檢驗資料。</td></tr>`; }
    
    data.forEach(d => {
        const isFail = d.avg < fcPrime;
        const avgClass = isFail ? 'text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1' : 'text-blue-700';
        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-200">
            <td class="p-3 text-center text-slate-600 font-bold">${d.date.replace(/^\d{4}-/, '')}</td>
            <td class="p-3 text-center font-black text-indigo-700">${d.machine || 'A'}</td>
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

    const labels = data.map(d => `${d.id}(${d.machine})`);
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
    
    const scopeLabel = scope === 'ALL' ? '全區 (整合各機具)' : `指定區域/機具 [${scope}]`;
    let reportHtml = `
        <div class="col-span-1 xl:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-sm mt-6 mb-8">
            <h3 class="text-lg font-black text-amber-900 mb-4 flex items-center gap-2">
                <i class="fa-solid fa-robot text-amber-600 text-xl"></i> AI 專家系統品質診斷報告 (ACI 214) - ${scopeLabel}
            </h3>
            <div id="ai-report-content" class="text-[15px] text-slate-800 font-bold leading-relaxed bg-white/80 p-5 rounded-xl border border-amber-300 shadow-inner">
    `;

    if(total === 0) {
        reportHtml += `目前於 <b>${scopeLabel}</b> 尚無足夠數據進行統計分析。</div></div>`;
        reportContainer.innerHTML = reportHtml;
        return;
    }

    reportHtml += `<p class="mb-3">本次針對 <b>${scopeLabel}</b> 分析共計 <b>${total}</b> 組壓測數據，設計強度目標值為 <b>${target}</b> kgf/cm²。</p>`;
    
    let sdStr = '';
    if (sd < 15) sdStr = '<span class="text-emerald-600 font-black">極佳 (標準差 < 15)</span>，數據極為集中，拌合控制非常穩定。';
    else if (sd < 30) sdStr = '<span class="text-blue-600 font-black">正常 (標準差 15~30)</span>，變異度符合一般施工規範要求。';
    else sdStr = '<span class="text-amber-600 font-black">偏高 (標準差 > 30)</span>，顯示該區段波動顯著，建議查核施工穩定度。';
    
    let highRangeCount = 0;
    window.concreteData.forEach(d => { if((scope === 'ALL' || d.machine === scope) && d.range > uclR) highRangeCount++; });
    let rangeWarning = '';
    if(highRangeCount > 0) {
        rangeWarning = `<br><span class="text-red-600 bg-red-100 px-2 py-0.5 rounded text-sm ml-1 animate-pulse">⚠️ 警告：發現 ${highRangeCount} 組試體組內全距超越 R-UCL，試驗離散度偏高。</span>`;
    }

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

// 正式環境初始化
initFirebase();
