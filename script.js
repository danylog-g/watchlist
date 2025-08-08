// Data structure
let movies = [], shows = [], seasons = [], episodes = [];
let currentRecordId = null; // Track record being rated

// Google Sheets configuration (loaded from json)
let GOOGLE_SHEET_ID = "abc123";
let movieSheetName = "Sheet1", showSheetName = "Sheet2", seasonSheetName = "Sheet3", episodeSheetName = "Sheet4";
let API_URL = "https://script.google.com/macros/s/abc123/exec";

// Google Sheets headers
let movieHeaders = ['MovieId', 'Title', 'Year', 'Director', 'Type', 'Genre', 'Date Added', 'Date Watched', 'Duration', 'X Rating', 'Y Rating'];
let showHeaders = ['ShowId', 'Title', 'Year Range', 'Director', 'Type', 'Genre', 'Date Added', 'Date Finished',
    'Total Seasons', 'Total Episodes', 'X Rating', 'X Avg Rating', 'Y Rating', 'Y Avg Rating'];
let seasonHeaders = ['ShowId', 'Season #', 'Year Range', 'Director', 'Date Added', 'Date Finished',
    'TotalEpisodes', 'Finished Episodes', 'X Rating', 'X Avg Rating', 'Y Rating', 'Y Avg Rating'];
let episodeHeaders = ['ShowId', 'Season #', 'Episode #', 'Title', 'Date Added', 'Date Watched', 'Duration', 'X Rating', 'Y Rating'];

// Centralize Google Sheets Stuff
const sheetConfig = {
    Movie: { key: 'Movies', headers: movieHeaders, arrayRef: () => movies },
    Show: { key: 'Shows', headers: showHeaders, arrayRef: () => shows },
    Season: { key: 'Seasons', headers: seasonHeaders, arrayRef: () => seasons },
    Episode: { key: 'Episodes', headers: episodeHeaders, arrayRef: () => episodes }
};

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    // Set up event listeners
    document.getElementById('add-movie-btn').addEventListener('click', openAddRecordModal);
    document.getElementById('save-new-movie-btn').addEventListener('click', addRecord);
    document.getElementById('save-rating-btn').addEventListener('click', saveRating);
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.close-add-modal').addEventListener('click', closeAddModal);
    document.getElementById('import-config-btn').addEventListener('click', triggerFileInput);
    document.getElementById('config-file-input').addEventListener('change', handleConfigFile);

    // Add sort functionality to table headers
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            sortWatchlist(header.dataset.sort);
        });
    });

    // Load data from Google Sheet
    init();

    // Search / Filter
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', renderWatchlist);
});

// Show loading indicator
function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

// Hide loading indicator
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Show status message
function showStatus(message, isSuccess) {
    const statusEl = document.getElementById('sync-status');
    statusEl.textContent = message;
    switch (isSuccess) {
        case false: statusEl.className = 'status-message status-error'; return;
        case true: statusEl.className = 'status-message status-success'; return;
        case 2: statusEl.className = 'status-message status-neutral'; return;
    }
}

// Open add movie modal
function openAddRecordModal() {
    document.getElementById('new-date-added').value = getTodayDate("yyyy-mm-dd");
    document.getElementById('new-movie-name').value = '';
    document.getElementById('add-movie-modal').style.display = 'flex';

    const Type = document.getElementById('new-media-type').value;

    if(Type == "Movie") {
        document.getElementById('duration-field').style.display = 'flex';
        document.getElementById('tSeasons-field').style.display = 'none';
        document.getElementById('tEpisodes-field').style.display = 'none';
        document.getElementById('show-field').style.display = 'none';
        document.getElementById('season-num-field').style.display = 'none';
        document.getElementById('season-num-field').style.display = 'none';
        document.getElementById('title-field').style.display = 'flex';
        document.getElementById('genre-field').style.display = 'flex';
        document.getElementById('director-field').style.display = 'flex';
    } 
    else if(Type == "Show") {
        document.getElementById('duration-field').style.display = 'none';
        document.getElementById('tSeasons-field').style.display = 'flex';
        document.getElementById('tEpisodes-field').style.display = 'flex';
        document.getElementById('show-field').style.display = 'none';
        document.getElementById('season-num-field').style.display = 'none';
        document.getElementById('episode-num-field').style.display = 'none';
        document.getElementById('title-field').style.display = 'flex';
        document.getElementById('genre-field').style.display = 'flex';
        document.getElementById('director-field').style.display = 'flex';
    }
    else if(Type == "Season") {
        document.getElementById('duration-field').style.display = 'none';
        document.getElementById('tSeasons-field').style.display = 'none';
        document.getElementById('tEpisodes-field').style.display = 'flex';
        document.getElementById('show-field').style.display = 'flex';
        document.getElementById('season-num-field').style.display = 'flex';
        document.getElementById('season-num-field').style.display = 'none';
        document.getElementById('title-field').style.display = 'none';
        document.getElementById('genre-field').style.display = 'none';
        document.getElementById('director-field').style.display = 'flex';
    }
    else if(Type == "Episode") {
        document.getElementById('duration-field').style.display = 'flex';
        document.getElementById('tSeasons-field').style.display = 'none';
        document.getElementById('tEpisodes-field').style.display = 'none';
        document.getElementById('show-field').style.display = 'flex';
        document.getElementById('season-num-field').style.display = 'flex';
        document.getElementById('episode-num-field').style.display = 'flex';
        document.getElementById('title-field').style.display = 'flex';
        document.getElementById('genre-field').style.display = 'none';
        document.getElementById('director-field').style.display = 'none';
    }
}

// Close add movie modal
function closeAddModal() {
    document.getElementById('add-movie-modal').style.display = 'none';
}

// Add record to the watchlist
function addRecord() {
    const nameInput = document.getElementById('new-name');
    const dateAddedInput = document.getElementById('new-date-added');
    const durationInput = document.getElementById('new-duration');
    const type = document.getElementById('new-media-type').value;
    let record = null;

    const title = nameInput.value.trim();

    if (!title) {
        alert('Please enter a title');
        return;
    }

    const Year = document.getElementById('new-year').value;
    const Director = document.getElementById('new-director').value.split(',').map(d => d.trim()).filter(d => d);
    const Genre = document.getElementById('new-genre').value.split(',').map(g => g.trim()).filter(g => g);
    const Duration = parseFloat(durationInput.value);

    switch(type) {
        case 'Movie':
            record = {
                // Movie-specific fields
                id: Date.now(),
                name: title,
                year: Year || "",
                director: Director || [""],
                type: type || '',
                genre: Genre || [],
                dateAdded: formatDate(dateAddedInput.value),
                dateWatched: null,
                duration: Duration, // Duration in hours
                xRating: 0, // Will be set when watched
                yRating: 0  // Will be set when watched
            };
            movies.push(record);
            break;
        case 'Show':
            record = {
                // Show-specific fields
                id: Date.now(),
                name: title,
                year: Year || "",
                director: Director || [""],
                type: type || '',
                genre: Genre || [],
                dateAdded: formatDate(dateAddedInput.value),
                dateFinished: null,  // Instead of dateWatched
                tSeasons: document.getElementById('tSeasons-field').value,
                tEpisodes: document.getElementById('tEpisodes-field').value,
            };
            shows.push(record);
            break;
    }

    persistRecords([record])
        .then(() => {
            renderWatchlist();
            updateStats();
            closeAddModal();
        })
        .catch(err => showStatus('Save failed: ' + err, false));

    // Clear Fields
    document.getElementById('new-movie-name').value = null;
    document.getElementById('new-movie-year').value = null;
    document.getElementById('new-movie-director').value = null
    document.getElementById('new-movie-genre').value = null;
    document.getElementById('movie-duration').value = 2;
}

// Open rating modal
function openRatingModal(id) {
    const movie = movies.find(m => m.id === id);
    if (!movie) return;

    currentRecordId = id;
    document.getElementById('modal-movie-title').textContent = movie.name;
    document.getElementById('new-date-added').value = getTodayDate("yyyy-mm-dd");

    // Initialize rating stars
    initRatingStars('modal-y-rating', movie.yRating);
    initRatingStars('modal-x-rating', movie.xRating);

    // Show modal
    document.getElementById('rating-modal').style.display = 'flex';
}

// Close rating modal
function closeModal() {
    document.getElementById('rating-modal').style.display = 'none';
    currentRecordId = null;
}

// Save rating from modal
function saveRating() {
    if (!currentRecordId) return;

    const movie = movies.find(m => m.id === currentRecordId);
    if (movie) {
        movie.dateWatched = document.getElementById('date-watched').value;
        movie.yRating = getRating('modal-y-rating');
        movie.xRating = getRating('modal-x-rating');

        // Update local array and save to Google Sheet
        persistRecords([movie])
            .then(() => {
                renderWatchlist();
                updateStats();
                closeModal();
            })
            .catch(err => showStatus('Save failed: ' + err, false));
    }
}

// Initialize rating stars with initial value
function initRatingStars(containerId, initialRating = 0) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        const star = document.createElement('i');
        star.classList.add('fas', 'fa-star', 'star');
        if (i <= initialRating) {
            star.classList.add('filled');
        }
        star.dataset.value = i;

        star.addEventListener('click', function () {
            // Reset all stars
            const stars = container.querySelectorAll('.star');
            stars.forEach(s => s.classList.remove('filled'));

            // Fill stars up to the clicked one
            for (let j = 1; j <= i; j++) {
                stars[j - 1].classList.add('filled');
            }
        });

        container.appendChild(star);
    }
}

// Get rating from star container
function getRating(containerId) {
    const container = document.getElementById(containerId);
    const filledStars = container.querySelectorAll('.filled').length;
    return filledStars;
}

// Remove record from watchlist
function removeRecord(id) {
    if (confirm('Are you sure you want to remove this movie?')) {
        const toDelete = movies.find(m => m.id === id);
        if (!toDelete) return;
        deleteAndPersist(toDelete)
            .then(() => {
                renderWatchlist();
                updateStats();
            })
            .catch(err => showStatus('Delete failed: ' + err, false));
    }
}

// Render the watchlist table
function renderWatchlist() {
    const tbody = document.getElementById('watchlist-body');
    const emptyState = document.getElementById('empty-state');

    // Combine movies and shows into a single array
    const combined = [
        ...movies.map(m => ({ ...m, kind: 'Movie' })),
        ...shows.map(s => ({ ...s, kind: 'Show' }))
    ];

    // Check if combined array is empty
    if (combined.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    // Get filter term
    const term = document.getElementById('search-input').value.trim().toLowerCase();

    // Filter items
    const filtered = combined.filter(item => {
        if (!term) return true;
        return (
            item.name.toLowerCase().includes(term) ||
            (item.director || '').toLowerCase().includes(term) ||
            (item.type || '').toLowerCase().includes(term) ||
            (item.genre || []).join(' ').toLowerCase().includes(term)
        );
    });

    // Handle no results after filtering
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    // Hide empty state and render results
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    filtered.forEach(item => {
        const row = document.createElement('tr');

        // Format dates
        const dateAdded = item.dateAdded ? formatDate(item.dateAdded) : '';
        const dateWatched = item.dateWatched ? formatDate(item.dateWatched) : 'Not watched';

        // Use item.watchDate for movies vs shows
        const watchDate = getWatchDate(item);

        // Create rating stars
        const xRatingStars = item.xRating > 0 ? createRatingStars(item.xRating) : '-';
        const yRatingStars = item.yRating > 0 ? createRatingStars(item.yRating) : '-';

        // Create action buttons
        const actions = document.createElement('div');
        actions.className = 'actions';

        if (!item.dateWatched) {
            const watchBtn = document.createElement('button');
            watchBtn.className = 'action-btn';
            watchBtn.innerHTML = '<i class="fas fa-check"></i> Rate';
            watchBtn.title = 'Mark as watched and rate';
            watchBtn.onclick = () => openRatingModal(item.id);
            actions.appendChild(watchBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = 'Edit rating';
            editBtn.onclick = () => openRatingModal(item.id);
            actions.appendChild(editBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'action-btn btn-secondary';
        removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
        removeBtn.title = 'Remove movie';
        removeBtn.onclick = () => removeRecord(item.id);
        actions.appendChild(removeBtn);

        // Build row
        row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${item.year || '-'}</td>
                    <td>${item.director || '-'}</td>
                    <td>${item.type || '-'}</td>
                    <td>${item.genre.join(', ') || '-'}</td>
                    <td>${dateAdded}</td>
                    <td>${dateWatched}</td>
                    <td>${xRatingStars}</td>
                    <td>${yRatingStars}</td>
                    <td></td>
                `;

        // Append actions to the last cell
        row.querySelector('td:last-child').appendChild(actions);

        tbody.appendChild(row);
    });
}

// Create HTML for rating stars
function createRatingStars(rating) {
    if (rating === 0) return '-';

    let stars = '';
    for (let i = 1; i <= 10; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star filled" style="color:#ffc2d1"></i>';
        } else {
            stars += '<i class="fas fa-star"></i>';
        }
    }
    return stars;
}

// Sort the watchlist
function sortWatchlist(sortBy) {
    // Get header cell and flip direction
    const th = document.querySelector(`th[data-sort="${sortBy}"]`);
    // Default to ascending, otherwise toggle
    const direction = th.dataset.order === 'asc' ? 'desc' : 'asc';
    th.dataset.order = direction;

    // Sort with basic compare
    movies.sort((a, b) => {
        let cmp = 0;
        // Handle different data types
        if (sortBy === 'name') {
            cmp = a.name.localeCompare(b.name);
        } else if (sortBy === 'year') {
            cmp = (a.year || 0) - (b.year || 0);
        } else if (sortBy === 'director') {
            cmp = (a.director || '').localeCompare(b.director || '');
        } else if (sortBy === 'genre') {
            // Compare first genre
            const ga = a.genre[0] || '';
            const gb = b.genre[0] || '';
            cmp = ga.localeCompare(gb);
        } else if (sortBy === 'dateAdded' || sortBy === 'dateWatched') {
            const da = a[sortBy] ? new Date(a[sortBy]) : new Date(0);
            const db = b[sortBy] ? new Date(b[sortBy]) : new Date(0);
            cmp = da - db;
        } else {
            // For Ratings
            cmp = (a[sortBy] || 0) - (b[sortBy] || 0);
        }

        return direction === 'asc' ? cmp : -cmp;
    });

    // Re-Render entire watchlist
    renderWatchlist();
}

// Parse whatever string you give me into a real Date object (or null)
function parseDate(dateString) {
    if (!dateString) return null;

    // If it's already a Date (unlikely here), just return it:
    if (dateString instanceof Date) return dateString;

    // 1) ISO with time: "2025-08-07T04:00:00.000Z"
    let m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(dateString);
    if (m) {
        const [_, y, M, d] = m;
        // Use UTC so no timezone shift
        return new Date(Date.UTC(+y, +M - 1, +d));
    }

    // 2) Pure ISO date: "2025-08-07"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [y, M, d] = dateString.split('-').map(Number);
        return new Date(y, M - 1, d);
    }

    // 3) Browser-munged US style: "8/7/2025" or "08/07/2025"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        const [mth, day, yr] = dateString.split('/').map(Number);
        return new Date(yr, mth - 1, day);
    }

    // 4) DD-MM-YYYY: "07-08-2025"
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
        const [day, mth, yr] = dateString.split('-').map(Number);
        return new Date(yr, mth - 1, day);
    }

    // Fallback: let JS try
    const d = new Date(dateString);
    return isNaN(d) ? null : d;
}

// Turn a Date (or parseable string) into "DD-MM-YYYY"
function formatDate(dateString) {
    const d = parseDate(dateString);
    if (!d) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
}


// Return in dd-mm-yyyy format
function getTodayDate(mode) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    switch (mode) {
        case "dd-mm-yyyy": return `${day}-${month}-${year}`;
        case "yyyy-mm-dd": return `${year}-${month}-${day}`;
    }
}

// Update statistics
function updateStats() {
    document.getElementById('total-movies').textContent = movies.length;

    const watched = movies.filter(m => m.dateWatched).length;
    document.getElementById('watched-movies').textContent = watched;

    // Calculate total duration only for watched movies
    const totalDuration = movies
        .filter(m => m.dateWatched) // only watched ones
        .reduce((sum, movie) => sum + (movie.duration || 0), 0);
    document.getElementById('total-duration').textContent = totalDuration;

    // Calculate average ratings
    const xRatings = movies.filter(m => m.xRating > 0).map(m => m.xRating);
    const avgXRating = xRatings.length ?
        (xRatings.reduce((a, b) => a + b, 0) / xRatings.length).toFixed(1) : '0.0';
    document.getElementById('avg-x-rating').textContent = avgXRating;

    const yRatings = movies.filter(m => m.yRating > 0).map(m => m.yRating);
    const avgYRating = yRatings.length ?
        (yRatings.reduce((a, b) => a + b, 0) / yRatings.length).toFixed(1) : '0.0';
    document.getElementById('avg-y-rating').textContent = avgYRating;

    // Other Stuff
    const totalMovies = movies.length;
    const totalShows = shows.length;
    const watchedMovies = movies.filter(m => m.dateWatched).length;
    const watchedShows = shows.filter(s => s.dateFinished).length;
    document.getElementById('total-movies').textContent = totalMovies;
    document.getElementById('total-shows').textContent = totalShows;
    document.getElementById('watched-movies').textContent = watchedMovies;
    document.getElementById('watched-shows').textContent = watchedShows;
}

// Ask for file to upload
function triggerFileInput() {
    document.getElementById('config-file-input').click();
}

// Handle the JSON file for Google Sheets
function handleConfigFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const cfg = JSON.parse(e.target.result);
            updateConfig(cfg);
            showStatus('Configuration loaded!', true);
            init(); // Reload data with new configuration
        } catch {
            showStatus('Invalid config file', false);
        }
    };
    reader.readAsText(file);
}

// Update Google Sheets Config
function updateConfig(config) {
    GOOGLE_SHEET_ID = config.sheetId;
    movieSheetName = config.movieSheet;
    showSheetName = config.showSheet;
    seasonSheetName = config.seasonSheet;
    episodeSheetName = config.episodeSheet;
    API_URL = config.apiUrl;
}

// JSONP function
function loadWithJsonp(url, callbackName) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const separator = url.includes('?') ? '&' : '?';
        const fullUrl = `${url}${separator}callback=${callbackName}`;
        
        console.log('Fetching URL:', fullUrl);
        script.src = fullUrl;

        // Timeout handling
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
        }, 15000); // 15 seconds timeout

        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) document.body.removeChild(script);
            clearTimeout(timeout);
        }

        window[callbackName] = (data) => {
            cleanup();
            console.log('Received data for', callbackName, data);
            resolve(data);
        };

        script.onerror = () => {
            cleanup();
            console.error('Script load error for URL:', script.src);
            reject(new Error('JSONP request failed'));
        };

        document.body.appendChild(script);
    });
}

function fetchSheet(name) {
    const sheetName = {
        Movies: movieSheetName,
        Shows: showSheetName,
        Seasons: seasonSheetName,
        Episodes: episodeSheetName
    }[name];
    
    return new Promise((resolve, reject) => {
        const callbackName = `callback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const url = `${API_URL}?action=get&sheetId=${GOOGLE_SHEET_ID}&sheetName=${sheetName}`;
        
        loadWithJsonp(url, callbackName)
            .then(data => resolve({ name, data }))
            .catch(error => {
                console.error(`Error fetching ${name} sheet:`, error);
                reject(error);
            });
    });
}

function fetchAll() {
    return Promise.allSettled(
        ['Movies', 'Shows', 'Seasons', 'Episodes'].map(n => fetchSheet(n))
    ).then(results => {
        return results.map(result => 
            result.status === 'fulfilled' ? result.value : null
        ).filter(Boolean);
    });
}

// Function to poppulate important shit
function populateArrays(arr) {
    arr.forEach(({ name, data }) => {
        // Properly assign to the correct array
        if (name === 'Movies') movies = data;
        else if (name === 'Shows') shows = data;
        else if (name === 'Seasons') seasons = data;
        else if (name === 'Episodes') episodes = data;
    });
}

// Load data from Google Sheet
function init() {
    showLoader();
    fetchAll()
        .then(populateArrays)
        .then(() => {
            renderWatchlist();
            updateStats();
            hideLoader();
            showStatus('Data loaded successfully!', true);
        })
        .catch(err => {
            hideLoader();
            showStatus('Failed to load data: ' + err.message, false);
            console.error('Fetch error:', err);
        });
}

// Save data to Google Sheet
function saveRecords(sheetKey, records, headers) {
    const sheetName = {
        Movies: movieSheetName,
        Shows: showSheetName,
        Seasons: seasonSheetName,
        Episodes: episodeSheetName
    }[sheetKey];

    return fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            sheetId: GOOGLE_SHEET_ID,
            sheetName,
            headers,
            records
        })
    });
}

// Helper functions for sheet stuff
// Upsert one or more records into the correct sheet
function persistRecords(records) {
    if (!records || !records.length) return Promise.resolve();
    const type = records[0].type;
    const cfg = sheetConfig[type];
    if (!cfg) throw new Error(`Unknown type: ${type}`);

    return saveRecords(cfg.key, records, cfg.headers);
}

// Remove a single record and then persist the whole array
function deleteAndPersist(record) {
    const type = record.type;
    const cfg = sheetConfig[type];
    cfg.arrayRef() = cfg.arrayRef().filter(r => r.id !== record.id);
    return saveAllOfType(type);
}

// Create helper function
function getWatchDate(item) {
    return item.type === 'Movie' 
        ? item.dateWatched 
        : item.dateFinished;
}