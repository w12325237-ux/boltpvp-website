const IP = 'boltpvp.fun';
const SUPPORT_EMAIL = 'kprlord3@gmail.com';
const pages = document.querySelectorAll('.page');
const pageLinks = document.querySelectorAll('[data-page]');
const ticketBubbleCount = document.getElementById('ticketBubbleCount');
const body = document.body;
const siteHeader = document.getElementById('siteHeader');

function goPage(id){
  pages.forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === id));
  window.scrollTo({top:0, behavior:'smooth'});
}
pageLinks.forEach(el => el.addEventListener('click', e => {
  if(el.dataset.page){
    e.preventDefault();
    goPage(el.dataset.page);
  }
}));

let lastScroll = 0;
window.addEventListener('scroll', () => {
  const now = window.scrollY;
  siteHeader.classList.toggle('header-hidden', now > lastScroll && now > 130);
  lastScroll = now;
}, {passive:true});

async function copyIP(btn){
  const original = btn.textContent;
  try{
    await navigator.clipboard.writeText(IP);
    btn.textContent = 'COPIED ✓';
    setTimeout(() => btn.textContent = original, 1400);
  }catch{
    window.prompt('Copy this IP:', IP);
  }
}
document.getElementById('copyIpTwo').onclick = e => copyIP(e.currentTarget);
document.getElementById('copySmallIp').onclick = e => copyIP(e.currentTarget);

document.querySelectorAll('.faq-item button').forEach(btn => {
  btn.addEventListener('click', () => btn.parentElement.classList.toggle('open'));
});

// Login
const playerForm = document.getElementById('playerLoginForm');
const playerIgnInput = document.getElementById('playerIgn');
const loginStrip = document.getElementById('loginStrip');
const headerProfile = document.getElementById('headerProfile');

function getProfile(){ return JSON.parse(localStorage.getItem('boltpvpProfile') || 'null'); }
function saveProfile(profile){ localStorage.setItem('boltpvpProfile', JSON.stringify(profile)); }

function renderProfile(){
  const profile = getProfile();
  if(!profile || !profile.ign){
    loginStrip.classList.remove('logged-away');
    headerProfile.classList.add('hidden');
    return;
  }
  loginStrip.classList.add('logged-away');
  const safeIgn = escapeHtml(profile.ign);
  headerProfile.innerHTML = `
    <img src="https://visage.surgeplay.com/full/110/${encodeURIComponent(profile.ign)}" alt="${safeIgn} skin">
    <div>
      <span>Logged In</span>
      <strong>${safeIgn}</strong>
    </div>
  `;
  headerProfile.querySelector('img').onerror = ev => ev.currentTarget.src = 'assets/bolt-logo.png';
  headerProfile.classList.remove('hidden');
  const ticketIgn = document.getElementById('ticketIgn');
  if(ticketIgn) ticketIgn.value = profile.ign;
}
playerForm.addEventListener('submit', e => {
  e.preventDefault();
  const ign = playerIgnInput.value.trim();
  if(!ign) return;
  saveProfile({ign});
  renderProfile();
});
renderProfile();

// Staffs
const staffs = {
  owner:['ZenZboy','Aquiped_','__Gazda_'],
  executive:['HamizWarsiXD','Xeden_MC'],
  manager:['EvoriX','x1ph','MoazTheTroll']
};
const roleNames = {owner:'Owner', executive:'Executive', manager:'Manager'};
const fallback = ['assets/player-red.png','assets/player-yellow.png','assets/player-pig.png'];
const staffList = document.getElementById('staffList');

Object.entries(staffs).forEach(([role, names], roleIndex) => {
  const block = document.createElement('section');
  block.className = `role-block ${role}`;
  block.innerHTML = `<h2 class="role-title">${roleNames[role]}</h2><div class="staff-grid"></div>`;
  const grid = block.querySelector('.staff-grid');
  names.forEach((name, index) => {
    const card = document.createElement('article');
    card.className = 'staff-card hover-card';
    card.innerHTML = `
      <img src="https://visage.surgeplay.com/full/240/${encodeURIComponent(name)}" alt="${escapeHtml(name)} skin">
      <h3>${escapeHtml(name)}</h3>
      <p>${roleNames[role].toUpperCase()}</p>
    `;
    card.querySelector('img').onerror = ev => ev.currentTarget.src = fallback[(index + roleIndex) % fallback.length];
    grid.appendChild(card);
  });
  staffList.appendChild(block);
});

// Ticket system
const ticketModal = document.getElementById('ticketModal');
const ticketForm = document.getElementById('ticketForm');
const ticketStepTypes = document.getElementById('ticketStepTypes');
const ticketSuccess = document.getElementById('ticketSuccess');
const formTitle = document.getElementById('formTitle');
let currentType = '';
let adminFilter = 'unsolved';

function openModal(el){
  el.classList.remove('hidden');
  body.style.overflow = 'hidden';
}
function closeModal(el){
  el.classList.add('hidden');
  if([...document.querySelectorAll('.modal')].every(m => m.classList.contains('hidden'))) body.style.overflow = '';
}

document.getElementById('openTicketFlow').onclick = () => {
  openModal(ticketModal);
  ticketStepTypes.classList.remove('hidden');
  ticketForm.classList.add('hidden');
  ticketSuccess.classList.add('hidden');
  const profile = getProfile();
  if(profile?.ign) document.getElementById('ticketIgn').value = profile.ign;
};
document.getElementById('closeTicket').onclick = () => closeModal(ticketModal);
document.getElementById('successClose').onclick = () => closeModal(ticketModal);

document.querySelectorAll('.type-btn').forEach(button => {
  button.addEventListener('click', () => {
    currentType = button.dataset.type;
    formTitle.textContent = currentType.toUpperCase();
    ticketStepTypes.classList.add('hidden');
    ticketForm.classList.remove('hidden');
  });
});

function getTickets(){ return JSON.parse(localStorage.getItem('boltpvpTickets') || '[]'); }
function saveTickets(tickets){
  localStorage.setItem('boltpvpTickets', JSON.stringify(tickets));
  updateBubble();
}
function updateBubble(){
  const openCount = getTickets().filter(t => !['Solved','Answered'].includes(t.status)).length;
  ticketBubbleCount.textContent = openCount;
}
updateBubble();

ticketForm.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(ticketForm));
  const profile = getProfile();
  const ticket = {
    id: 'BOLT-' + Date.now().toString().slice(-7),
    type: currentType,
    ign: data.ign || profile?.ign || 'Unknown',
    email: data.email,
    order: data.order,
    explain: data.explain,
    proof: data.proof,
    status: 'Pending',
    response: 'No staff response yet.',
    created: new Date().toLocaleString()
  };
  const tickets = getTickets();
  tickets.unshift(ticket);
  saveTickets(tickets);
  ticketForm.reset();
  ticketForm.classList.add('hidden');
  ticketSuccess.classList.remove('hidden');

  const emailBody = [
    `Ticket ID: ${ticket.id}`,
    `Type: ${ticket.type}`,
    `IGN: ${ticket.ign}`,
    `Contact: ${ticket.email}`,
    `Extra: ${ticket.order || '-'}`,
    `Explain: ${ticket.explain}`,
    `Proof: ${ticket.proof || '-'}`
  ].join('\n');
  window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`BoltPvP Ticket ${ticket.id} - ${ticket.type}`)}&body=${encodeURIComponent(emailBody)}`, '_blank');
});

function statusClass(status){
  if(status === 'Pending') return 'pending';
  if(status === 'Solved') return 'solved';
  return 'answered';
}

function showHistory(){
  const historyWrap = document.getElementById('ticketHistory');
  const tickets = getTickets();
  historyWrap.innerHTML = tickets.length ? '' : '<p>No tickets yet.</p>';
  tickets.forEach(ticket => {
    const item = document.createElement('div');
    item.className = 'ticket-row hover-card';
    item.innerHTML = `
      <h3>${ticket.id} • ${escapeHtml(ticket.type)}</h3>
      <p><b>IGN:</b> ${escapeHtml(ticket.ign)} • <b>CREATED:</b> ${escapeHtml(ticket.created)}</p>
      <p><b>PROBLEM:</b> ${escapeHtml(ticket.explain)}</p>
      <span class="status ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>
      <div class="response"><b>STAFF RESPONSE:</b><br>${escapeHtml(ticket.response)}</div>
    `;
    historyWrap.appendChild(item);
  });
  openModal(document.getElementById('historyModal'));
}
document.getElementById('ticketBubble').onclick = showHistory;
document.getElementById('closeHistory').onclick = () => closeModal(document.getElementById('historyModal'));

// Admin
const adminModal = document.getElementById('adminModal');
document.getElementById('adminOpen').onclick = () => openModal(adminModal);
document.getElementById('closeAdmin').onclick = () => closeModal(adminModal);
document.getElementById('adminLoginBtn').onclick = () => {
  const username = document.getElementById('adminUser').value.trim().toLowerCase();
  const password = document.getElementById('adminPass').value;
  if(username === 'zenzboy' && password === 'boltpvp12'){
    document.getElementById('adminLoginBox').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    renderAdmin();
  }else{
    alert('Wrong login');
  }
};

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    adminFilter = tab.dataset.filter;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderAdmin();
  });
});

function renderAdmin(){
  const wrap = document.getElementById('adminTickets');
  const tickets = getTickets();
  const filtered = tickets.filter(t => {
    if(adminFilter === 'all') return true;
    if(adminFilter === 'solved') return t.status === 'Solved';
    return t.status !== 'Solved';
  });
  wrap.innerHTML = filtered.length ? '' : '<p>No tickets in this tab.</p>';
  filtered.forEach(ticket => {
    const row = document.createElement('div');
    row.className = 'ticket-row hover-card';
    row.innerHTML = `
      <h3>${ticket.id} • ${escapeHtml(ticket.type)}</h3>
      <p><b>IGN:</b> ${escapeHtml(ticket.ign)} • <b>CONTACT:</b> ${escapeHtml(ticket.email)}</p>
      <p><b>EXTRA:</b> ${escapeHtml(ticket.order || '-')}</p>
      <p><b>PROBLEM:</b> ${escapeHtml(ticket.explain)}</p>
      <p><b>PROOF:</b> ${escapeHtml(ticket.proof || '-')}</p>
      <span class="status ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>
      <div class="response"><b>CURRENT RESPONSE:</b><br>${escapeHtml(ticket.response)}</div>
      <div class="admin-reply">
        <textarea placeholder="Write a staff response...">${ticket.response === 'No staff response yet.' ? '' : escapeHtml(ticket.response)}</textarea>
        <button class="mini-btn">RESPOND</button>
      </div>
      <div class="solve-row">
        <button class="mini-btn solve-btn">MARK SOLVED</button>
        <button class="mini-btn unsolve-btn">MARK UNSOLVED</button>
      </div>
    `;
    row.querySelector('.admin-reply button').onclick = () => {
      ticket.response = row.querySelector('textarea').value.trim() || 'No staff response yet.';
      ticket.status = ticket.response === 'No staff response yet.' ? 'Pending' : 'Answered';
      saveTickets(tickets);
      renderAdmin();
    };
    row.querySelector('.solve-btn').onclick = () => {
      if(ticket.response === 'No staff response yet.') ticket.response = 'Your ticket has been solved by staff.';
      ticket.status = 'Solved';
      saveTickets(tickets);
      renderAdmin();
    };
    row.querySelector('.unsolve-btn').onclick = () => {
      ticket.status = 'Pending';
      saveTickets(tickets);
      renderAdmin();
    };
    wrap.appendChild(row);
  });
}

function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));
}
