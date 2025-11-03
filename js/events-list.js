/**
 * SECURA - Liste des événements en cartes
 */

let currentEventId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    initializeEventListeners();
});

function loadEvents() {
    const events = storage.getAllEvents();
    const grid = document.getElementById('eventsGrid');
    const empty = document.getElementById('emptyState');

    if (events.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = events.map(event => `
        <div class="card p-6 hover:shadow-xl transition-shadow cursor-pointer" 
             onclick="goToGuests('${event.id}')">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-bold text-primary">${escapeHtml(event.name)}</h3>
                <span class="badge badge-info">${storage.getGuestsByEventId(event.id).length} invités</span>
            </div>
            <p class="text-gray-600">
                <i class="fas fa-calendar"></i> 
                ${new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                ${event.time ? ` à ${event.time}` : ''}
            </p>
            ${event.location ? `<p class="text-sm text-gray-500 mt-2"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.location)}</p>` : ''}
            <div class="flex gap-2 mt-4">
                <button onclick="event.stopPropagation(); editEvent('${event.id}')" class="btn btn-sm btn-outline">Modifier</button>
                <button onclick="event.stopPropagation(); deleteEvent('${event.id}')" class="btn btn-sm btn-danger">Supprimer</button>
            </div>
        </div>
    `).join('');
}

function goToGuests(eventId) {
    window.location.href = `guests.html?event=${eventId}`;
}

function openEventModal(eventId = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const title = document.getElementById('eventModalTitle');

    form.reset();
    if (eventId) {
        const event = storage.getEventById(eventId);
        if (event) {
            document.getElementById('eventId').value = event.id;
            document.getElementById('eventName').value = event.name;
            document.getElementById('eventDate').value = event.date;
            document.getElementById('eventTime').value = event.time || '';
            document.getElementById('eventLocation').value = event.location || '';
            document.getElementById('eventDescription').value = event.description || '';
            title.innerHTML = '<i class="fas fa-edit"></i> Modifier l\'événement';
        }
    } else {
        title.innerHTML = '<i class="fas fa-plus"></i> Nouvel événement';
    }
    modal.classList.add('active');
}

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
}

function initializeEventListeners() {
    document.getElementById('eventForm').addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('eventId').value;
        const event = {
            id: id || undefined,
            name: document.getElementById('eventName').value.trim(),
            date: document.getElementById('eventDate').value,
            time: document.getElementById('eventTime').value,
            location: document.getElementById('eventLocation').value.trim(),
            description: document.getElementById('eventDescription').value.trim()
        };
        storage.saveEvent(event);
        closeEventModal();
        loadEvents();
        showNotification('success', id ? 'Événement modifié' : 'Événement créé');
    });
}

async function deleteEvent(id) {
    const event = storage.getEventById(id);
    const confirmed = await confirmDialog('Supprimer', `Supprimer <strong>${event.name}</strong> ?`, 'Supprimer', 'Annuler');
    if (confirmed) {
        storage.deleteEvent(id);
        loadEvents();
        showNotification('success', 'Événement supprimé');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.openEventModal = openEventModal;
window.closeEventModal = closeEventModal;
window.editEvent = id => openEventModal(id);
window.deleteEvent = deleteEvent;