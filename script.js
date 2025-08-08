// Movie data structure
let movies = [];
let currentMovieId = null; // Track movie being rated

// Google Sheets configuration (loaded from json)
let GOOGLE_SHEET_ID = "abc123";
let GOOGLE_SHEET_NAME = "Sheet1";
let API_URL = "https://script.google.com/macros/s/abc123/exec";

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    // Set today's date as default for date added
    const today = new Date().toISOString().split('T')[0];

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
    document.getElementById('new-date-added').value = new Date().toISOString().split('T')[0];
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

    const movieName = nameInput.value.trim();

    if (!movieName) {
        alert('Please enter a movie title');
        return;
    }

    const movie = {
        id: Date.now(),
        name: movieName,
        dateAdded: dateAddedInput.value,
        dateWatched: null,
        duration: 0, // Duration in hours
        xRating: 0, // Will be set when watched
        yRating: 0  // Will be set when watched
    };

    // Add to local array and save to Google Sheet
    movies.push(movie);
    renderWatchlist();
    updateStats();
    saveToGoogleSheet();
    closeAddModal();
}

// Open rating modal
function openRatingModal(id) {
    const movie = movies.find(m => m.id === id);
    if (!movie) return;

    currentMovieId = id;
    document.getElementById('modal-movie-title').textContent = movie.name;
    document.getElementById('date-watched').value = new Date().toISOString().split('T')[0];
    document.getElementById('movie-duration').value = movie.duration > 0 ? movie.duration : 2;

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
        movie.duration = parseInt(document.getElementById('movie-duration').value);
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

    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    movies.forEach(movie => {
        const row = document.createElement('tr');

        // Format dates
        const dateAdded = new Date(movie.dateAdded).toLocaleDateString();
        const dateWatched = movie.dateWatched ?
            new Date(movie.dateWatched).toLocaleDateString() : 'Not watched';

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
                    <td>${dateAdded}</td>
                    <td>${dateWatched}</td>
                    <td>${movie.duration > 0 ? movie.duration : '-'}</td>
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
    movies.sort((a, b) => {
        // Handle different data types
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'dateAdded' || sortBy === 'dateWatched') {
            const dateA = a[sortBy] ? new Date(a[sortBy]) : new Date(0);
            const dateB = b[sortBy] ? new Date(b[sortBy]) : new Date(0);
            return dateB - dateA; // Newest first
        } else if (sortBy === 'duration') {
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        } else {
            // For ratings
            return (b[sortBy] || 0) - (a[sortBy] || 0);
        }
    });

    renderWatchlist();
}

// Update statistics
function updateStats() {
    document.getElementById('total-movies').textContent = movies.length;

    const watched = movies.filter(m => m.dateWatched).length;
    document.getElementById('watched-movies').textContent = watched;

    // Calculate total duration
    const totalDuration = movies.reduce((sum, movie) => sum + (movie.duration || 0), 0);
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
                dateAdded: row['Date Added'] || '',
                dateWatched: row['Date Watched'] || null,
                duration: parseInt(row.Duration) || 0,
                xRating: parseInt(row['X Rating']) || 0,
                yRating: parseInt(row['Y Rating']) || 0
            }));

            renderWatchlist();
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

    // Prepare data
    const dataToSend = {
        action: 'update',
        sheetId: GOOGLE_SHEET_ID,
        sheetName: GOOGLE_SHEET_NAME,
        movies: movies.map(movie => ({
            Title: movie.name,
            'Date Added': movie.dateAdded,
            'Date Watched': movie.dateWatched || '',
            Duration: movie.duration || '',
            'X Rating': movie.xRating || '',
            'Y Rating': movie.yRating || ''
        }))
    };

    // Create form
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = API_URL;
    form.target = 'hiddenFrame';
    form.style.display = 'none';

    // Add data as hidden input
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(dataToSend);
    form.appendChild(input);

    // Add to document
    document.body.appendChild(form);

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.name = 'hiddenFrame';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Handle response
    iframe.onload = () => {
        try {
            const response = JSON.parse(iframe.contentDocument.body.textContent);
            if (response.success) {
                showStatus('Data saved to Google Sheet!', true);
            } else {
                showStatus('Error saving data: ' + response.message, false);
            }
        } catch (e) {
            showStatus('Data saved successfully!', true);
        }
        document.body.removeChild(form);
        document.body.removeChild(iframe);
    };

    // Submit form
    form.submit();
}