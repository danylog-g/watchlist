// Movie data structure
let movies = [];
let currentMovieId = null; // Track movie being rated

// Google Sheets configuration (loaded from json)
let GOOGLE_SHEET_ID = "abc123";
let GOOGLE_SHEET_NAME = "Sheet1";
let API_URL = "https://script.google.com/macros/s/abc123/exec";

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    // Set up event listeners
    document.getElementById('add-movie-btn').addEventListener('click', openAddMovieModal);
    document.getElementById('save-new-movie-btn').addEventListener('click', addMovie);
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
    loadFromGoogleSheet();

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
function openAddMovieModal() {
    document.getElementById('new-date-added').value = getTodayDate("yyyy-mm-dd");
    document.getElementById('new-movie-name').value = '';
    document.getElementById('add-movie-modal').style.display = 'flex';
}

// Close add movie modal
function closeAddModal() {
    document.getElementById('add-movie-modal').style.display = 'none';
}

// Add a movie to the watchlist
function addMovie() {
    const nameInput = document.getElementById('new-movie-name');
    const dateAddedInput = document.getElementById('new-date-added');
    const durationInput = document.getElementById('movie-duration');
    const typeInput = document.getElementById('new-media-type');

    const movieName = nameInput.value.trim();

    if (!movieName) {
        alert('Please enter a movie title');
        return;
    }

    const Duration = parseFloat(durationInput.value);

    const movie = {
        id: Date.now(),
        name: movieName,
        year: parseInt(document.getElementById('new-movie-year').value) || '',
        director: document.getElementById('new-movie-director').value.trim() || '',
        type: typeInput.value || '',
        genre: document.getElementById('new-movie-genre').value.split(',').map(g => g.trim()).filter(g => g) || [],
        dateAdded: formatDate(dateAddedInput.value),
        dateWatched: null,
        duration: Duration, // Duration in hours
        xRating: 0, // Will be set when watched
        yRating: 0  // Will be set when watched
    };

    // Add to local array and save to Google Sheet
    movies.push(movie);
    renderWatchlist();
    updateStats();
    saveToGoogleSheet();
    closeAddModal();

    // Clear Fields
    document.getElementById('new-movie-name').value = "";
    document.getElementById('new-date-added').value = "";
    document.getElementById('movie-duration').value = "";
    document.getElementById('new-media-type').value = "";
}

// Open rating modal
function openRatingModal(id) {
    const movie = movies.find(m => m.id === id);
    if (!movie) return;

    currentMovieId = id;
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
    currentMovieId = null;
}

// Save rating from modal
function saveRating() {
    if (!currentMovieId) return;

    const movie = movies.find(m => m.id === currentMovieId);
    if (movie) {
        movie.dateWatched = document.getElementById('date-watched').value;
        movie.yRating = getRating('modal-y-rating');
        movie.xRating = getRating('modal-x-rating');

        // Update local array and save to Google Sheet
        renderWatchlist();
        updateStats();
        saveToGoogleSheet();
        closeModal();
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

// Remove movie from watchlist
function removeMovie(id) {
    if (confirm('Are you sure you want to remove this movie?')) {
        movies = movies.filter(m => m.id !== id);
        renderWatchlist();
        updateStats();
        saveToGoogleSheet();
    }
}

// Render the watchlist table
function renderWatchlist() {
    const tbody = document.getElementById('watchlist-body');
    const emptyState = document.getElementById('empty-state');

    if (movies.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    // Get Filter Terms
    const term = document
        .getElementById('search-input')
        .value
        .trim()
        .toLowerCase();

    // Handle Filtering
    const filtered = movies.filter(m => {
        if (!term) return true; // Display every movie / show 
        // Fields to Search
        const inTitle    = m.name.toLowerCase().includes(term);
        const inDirector = (m.director || '').toLowerCase().includes(term);
        const inType     = (m.type     || '').toLowerCase().includes(term);
        const inGenre    = m.genre.join(' ').toLowerCase().includes(term);
        return inTitle || inDirector || inType || inGenre;
    });

    // No movies after Filter applied
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    filtered.forEach(movie => {
        const row = document.createElement('tr');

        // Format dates
        const dateAdded = movie.dateAdded ? formatDate(movie.dateAdded) : '';
        const dateWatched = movie.dateWatched ? formatDate(movie.dateWatched) : 'Not watched';

        // Create rating stars
        const xRatingStars = movie.xRating > 0 ? createRatingStars(movie.xRating) : '-';
        const yRatingStars = movie.yRating > 0 ? createRatingStars(movie.yRating) : '-';

        // Create action buttons
        const actions = document.createElement('div');
        actions.className = 'actions';

        if (!movie.dateWatched) {
            const watchBtn = document.createElement('button');
            watchBtn.className = 'action-btn';
            watchBtn.innerHTML = '<i class="fas fa-check"></i> Rate';
            watchBtn.title = 'Mark as watched and rate';
            watchBtn.onclick = () => openRatingModal(movie.id);
            actions.appendChild(watchBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = 'Edit rating';
            editBtn.onclick = () => openRatingModal(movie.id);
            actions.appendChild(editBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'action-btn btn-secondary';
        removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
        removeBtn.title = 'Remove movie';
        removeBtn.onclick = () => removeMovie(movie.id);
        actions.appendChild(removeBtn);

        // Build row
        row.innerHTML = `
                    <td>${movie.name}</td>
                    <td>${movie.year || '-'}</td>
                    <td>${movie.director || '-'}</td>
                    <td>${movie.type || '-'}</td>
                    <td>${movie.genre.join(', ') || '-'}</td>
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
    reader.onload = function (e) {
        try {
            const config = JSON.parse(e.target.result);
            updateConfig(config);
            showStatus('Configuration imported successfully!', true);
            console.log('Configuration imported successfully!');
            // Reload data with new configuration
            loadFromGoogleSheet();
        } catch (error) {
            console.error('Error parsing config file:', error);
            showStatus('Invalid configuration file', false);
        }
    };
    reader.readAsText(file);
}

// Update Google Sheets Config
function updateConfig(config) {
    if (config.sheetId) GOOGLE_SHEET_ID = config.sheetId;
    if (config.sheetName) GOOGLE_SHEET_NAME = config.sheetName;
    if (config.apiUrl) API_URL = config.apiUrl;
}

function loadWithJsonp(url, callbackName) {
    return new Promise((resolve, reject) => {
        // Create script element
        const script = document.createElement('script');
        script.src = `${url}&callback=${callbackName}`;

        // Create callback function
        window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        // Handle errors
        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request failed'));
        };

        // Add to document
        document.body.appendChild(script);
    });
}

// Load data from Google Sheet
function loadFromGoogleSheet() {
    showLoader();
    showStatus('Loading data from Google Sheet...', 2);

    const url = `${API_URL}?action=get&sheetId=${GOOGLE_SHEET_ID}&sheetName=${GOOGLE_SHEET_NAME}`;

    // Use JSONP for GET requests
    loadWithJsonp(url, 'handleSheetData')
        .then(data => {
            movies = data.map(row => ({
                id: Date.now() + Math.random(),
                name: row.Title || '',
                year: parseInt(row.Year) || '',
                director: row.Director || '',
                type: row.Type || '',
                genre: row.Genre ? row.Genre.split(',').map(g => g.trim()).filter(g => g) : [],
                dateAdded: formatDate(row['Date Added']),
                dateWatched: row['Date Watched'] ? formatDate(row['Date Watched']) : null,
                duration: parseFloat(row.Duration) || 0,
                xRating: parseInt(row['X Rating']) || 0,
                yRating: parseInt(row['Y Rating']) || 0
            }));

            sortWatchlist("dateAdded");
            updateStats();
            hideLoader();
            showStatus('Data loaded successfully!', true);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            hideLoader();
            showStatus('Error loading data: ' + error.message, false);
        });
}

// Save data to Google Sheet
function saveToGoogleSheet() {
    showStatus('Saving to Google Sheet...', 2);

    const dataToSend = {
        action: 'update',
        sheetId: GOOGLE_SHEET_ID,
        sheetName: GOOGLE_SHEET_NAME,
        movies: movies.map(movie => ({
            Title: movie.name,
            Year: movie.year || '',
            Director: movie.director || '',
            Type: movie.type || '',
            Genre: movie.genre.join(', ') || '',
            'Date Added': movie.dateAdded,
            'Date Watched': movie.dateWatched || '',
            Duration: movie.duration || '',
            'X Rating': movie.xRating || '',
            'Y Rating': movie.yRating || ''
        }))
    };

    // Use fetch with no-cors mode
    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        body: JSON.stringify(dataToSend)
    })
        .then(() => {
            showStatus('Data saved to Google Sheet!', true);
        })
        .catch(error => {
            console.error('Error saving data:', error);
            showStatus('Error saving to Google Sheet', false);
        });
}