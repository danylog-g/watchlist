// script.js
document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const watchlistBody = document.getElementById('watchlist-body');
    const emptyState = document.getElementById('empty-state');
    const addMovieBtn = document.getElementById('add-movie-btn');
    const addModal = document.getElementById('add-movie-modal');
    const closeAddModal = document.querySelector('.close-add-modal');
    const saveNewMovieBtn = document.getElementById('save-new-movie-btn');
    const ratingModal = document.getElementById('rating-modal');
    const closeRatingModal = document.querySelector('.close-modal');
    const saveRatingBtn = document.getElementById('save-rating-btn');
    const searchInput = document.getElementById('search-input');
    const importConfigBtn = document.getElementById('import-config-btn');
    const exportConfigBtn = document.getElementById('export-config-btn');
    const configFileInput = document.getElementById('config-file-input');
    const mediaTypeSelect = document.getElementById('new-media-type');
    const showDetailsModal = document.getElementById('show-details-modal');
    const seasonsContainer = document.getElementById('seasons-container');
    const addSeasonBtn = document.getElementById('add-season-btn');
    const seasonModal = document.getElementById('season-modal');
    const saveSeasonBtn = document.getElementById('save-season-btn');
    const showDetailsTitle = document.getElementById('show-details-title');
    const loader = document.getElementById('loader');
    const syncStatus = document.getElementById('sync-status');

    // State management
    let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
    let currentSort = { field: 'dateAdded', direction: 'desc' };
    let currentMovieId = null;
    let currentFilter = '';

    // Initialize the application
    function init() {
        renderWatchlist();
        updateStats();
        setupEventListeners();
        setupSorting();
    }

    // Set up event listeners
    function setupEventListeners() {
        addMovieBtn.addEventListener('click', openAddModal);
        closeAddModal.addEventListener('click', () => addModal.style.display = 'none');
        closeRatingModal.addEventListener('click', () => ratingModal.style.display = 'none');
        saveNewMovieBtn.addEventListener('click', saveNewMovie);
        saveRatingBtn.addEventListener('click', saveRating);
        searchInput.addEventListener('input', handleSearch);
        importConfigBtn.addEventListener('click', () => configFileInput.click());
        exportConfigBtn.addEventListener('click', exportConfig);
        configFileInput.addEventListener('change', importConfig);
        mediaTypeSelect.addEventListener('change', updateAddModalFields);
        addSeasonBtn.addEventListener('click', () => { seasonModal.style.display = 'block'; });

        saveSeasonBtn.addEventListener('click', () => {
            const seasonNumber = parseInt(document.getElementById('season-number').value);
            const totalEpisodes = parseInt(document.getElementById('total-episodes').value);
            const showId = currentMovieId; // We need to track which show we're adding to

            const newSeason = {
                id: Date.now().toString(),
                name: `Season ${seasonNumber}`,
                type: "Season",
                seasonNumber: seasonNumber,
                totalEpisodes: totalEpisodes,
                showConnection: showId,
                dateAdded: new Date().toISOString().split('T')[0]
            };

            watchlist.push(newSeason);
            saveWatchlist();
            viewShowDetails(showId); // Refresh the view
            seasonModal.style.display = 'none';
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                ratingModal.style.display = 'none';
                addModal.style.display = 'none';
                showDetailsModal.style.display = 'none';
                seasonModal.style.display = 'none';
                currentShowId = null;
            });
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === addModal) addModal.style.display = 'none';
            if (e.target === ratingModal) ratingModal.style.display = 'none';
            if (e.target === showDetailsModal) showDetailsModal.style.display = 'none'; currentShowId = null;
            if (e.target === seasonModal) seasonModal.style.display = 'none';
        });
    }

    // Set up sorting for table headers
    function setupSorting() {
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                if (currentSort.field === field) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = field;
                    currentSort.direction = 'asc';
                }
                renderWatchlist();
            });
        });
    }

    // Open add movie modal
    function openAddModal() {
        // Reset form
        document.getElementById('new-name').value = '';
        document.getElementById('new-year').value = '';
        document.getElementById('new-director').value = '';
        document.getElementById('new-genre').value = '';
        document.getElementById('show-connection').value = '';
        document.getElementById('season-num').value = 1;
        document.getElementById('episode-num').value = 1;
        document.getElementById('new-duration').value = 2;
        document.getElementById('new-season-amnt').value = 1;
        document.getElementById('new-episode-amnt').value = 1;

        // Set default date to today
        document.getElementById('new-date-added').valueAsDate = new Date();

        // Update fields based on default type (Movie)
        updateAddModalFields();

        addModal.style.display = 'block';
    }

    // Update add modal fields based on selected media type
    function updateAddModalFields() {
        const type = mediaTypeSelect.value;

        // Hide all fields first
        const fields = [
            'duration-field', 'genre-field', 'director-field',
            'tSeasons-field', 'tEpisodes-field', 'show-field',
            'season-num-field', 'episode-num-field', 'title-field'
        ];

        fields.forEach(field => {
            document.getElementById(field).style.display = 'none';
        });

        // Show relevant fields based on type
        if (type === "Movie") {
            showFields(['duration-field', 'genre-field', 'director-field', 'title-field']);
        } else if (type === "Show") {
            showFields(['tSeasons-field', 'genre-field', 'director-field', 'title-field']);
        } else if (type === "Season") {
            showFields(['tEpisodes-field', 'show-field', 'season-num-field', 'director-field']);
        } else if (type === "Episode") {
            showFields(['duration-field', 'show-field', 'season-num-field',
                'episode-num-field', 'title-field', 'director-field']);
        }
    }

    // Helper function to show fields
    function showFields(fieldIds) {
        fieldIds.forEach(id => {
            document.getElementById(id).style.display = 'flex';
        });
    }

    // Save new movie to watchlist
    function saveNewMovie() {
        const type = document.getElementById('new-media-type').value;
        const name = document.getElementById('new-name').value;
        const year = document.getElementById('new-year').value;
        const director = document.getElementById('new-director').value;
        const genre = document.getElementById('new-genre').value;
        const dateAdded = document.getElementById('new-date-added').value;
        const duration = parseFloat(document.getElementById('new-duration').value);
        const totalSeasons = parseInt(document.getElementById('new-season-amnt').value);
        const totalEpisodes = parseInt(document.getElementById('new-episode-amnt').value);
        const showConnection = document.getElementById('show-connection').value;
        const seasonNumber = parseInt(document.getElementById('season-num').value);
        const episodeNumber = parseInt(document.getElementById('episode-num').value);

        if (!name && type != "Season") {
            alert('Please enter a title');
            return;
        }

        const newMovie = {
            id: Date.now().toString(),
            name: type != 'Season' ? name : "Season " + seasonNumber,
            year,
            director,
            type,
            genre,
            dateAdded,
            dateWatched: null,
            gfRating: null,
            myRating: null,
            duration: type === 'Movie' || type === 'Episode' ? duration : 0,
            totalSeasons: type === 'Show' ? totalSeasons : 0,
            totalEpisodes: type === 'Season' ? totalEpisodes : 0,
            showConnection: (type === 'Season' || type === 'Episode') ? showConnection : '',
            seasonNumber: (type === 'Season' || type === 'Episode') ? seasonNumber : 0,
            episodeNumber: type === 'Episode' ? episodeNumber : 0
        };

        watchlist.push(newMovie);
        saveWatchlist();
        renderWatchlist();
        updateStats();
        addModal.style.display = 'none';
    }

    // Open rating modal
    function openRatingModal(movieId) {
        currentMovieId = movieId;
        const movie = watchlist.find(m => m.id === movieId);

        if (movie) {
            document.getElementById('modal-movie-title').textContent = movie.name;
            document.getElementById('date-watched').value = movie.dateWatched || new Date().toISOString().split('T')[0];

            // Create star ratings
            createStarRating('modal-x-rating', movie.gfRating || 0, 'x');
            createStarRating('modal-y-rating', movie.myRating || 0, 'y');

            ratingModal.style.display = 'block';
        }
    }

    // Create star rating UI
    function createStarRating(containerId, rating, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = `star ${i <= rating ? 'active' : ''}`;
            star.innerHTML = '★';
            star.dataset.value = i;
            star.addEventListener('click', () => setRating(containerId, i, type));
            container.appendChild(star);
        }
    }

    // Set rating value
    function setRating(containerId, value, type) {
        const stars = document.querySelectorAll(`#${containerId} .star`);
        stars.forEach(star => {
            star.classList.toggle('active', star.dataset.value <= value);
        });
    }

    // Save rating
    function saveRating() {
        if (!currentMovieId) return;

        const movieIndex = watchlist.findIndex(m => m.id === currentMovieId);
        if (movieIndex !== -1) {
            const dateWatched = document.getElementById('date-watched').value;
            const xRating = document.querySelectorAll('#modal-x-rating .star.active').length;
            const yRating = document.querySelectorAll('#modal-y-rating .star.active').length;

            watchlist[movieIndex].dateWatched = dateWatched;
            watchlist[movieIndex].gfRating = xRating;
            watchlist[movieIndex].myRating = yRating;

            saveWatchlist();
            renderWatchlist();
            updateStats();
            ratingModal.style.display = 'none';
        }
    }

    // Vied details of a show
    function viewShowDetails(showId) {
        currentShowId = showId;
        const show = watchlist.find(m => m.id === showId);
        if (!show) return;

        showDetailsTitle.textContent = show.name;
        seasonsContainer.innerHTML = '';

        // Get all seasons for this show
        const seasons = watchlist.filter(item =>
            item.type === "Season" && item.showConnection === showId
        ).sort((a, b) => a.seasonNumber - b.seasonNumber);

        // Get all episodes for this show - including those connected directly to the show
        const allEpisodes = watchlist.filter(item =>
            item.type === "Episode" &&
            (item.showConnection === showId ||
                seasons.some(season => season.id === item.showConnection))
        );

        // Render seasons and episodes
        seasons.forEach(season => {
            const seasonElement = document.createElement('div');
            seasonElement.className = 'season-item';

            // Get episodes for this season
            const episodes = allEpisodes.filter(ep =>
                ep.showConnection === season.id ||
                (ep.showConnection === showId && ep.seasonNumber === season.seasonNumber)
            ).sort((a, b) => a.episodeNumber - b.episodeNumber);

            seasonElement.innerHTML = `
            <div class="season-header">
                <div>
                    <strong>Season ${season.seasonNumber}</strong>
                    <span> - ${episodes.length} of ${season.totalEpisodes} episodes</span>
                </div>
                <button class="btn-toggle">▼</button>
            </div>
            <div class="episodes-list">
                ${episodes.length > 0 ?
                    episodes.map(ep => `
                        <div class="episode-item">
                            <div class="episode-info">
                                <span>Episode ${ep.episodeNumber}: ${ep.name}</span>
                                ${ep.dateWatched ?
                            `<span>Watched: ${formatDate(ep.dateWatched)}</span>` :
                            '<span>Not watched</span>'
                        }
                            </div>
                            <div class="episode-actions">
                                <button class="btn-rate" data-id="${ep.id}">Rate</button>
                                <button class="btn-delete" data-id="${ep.id}">Delete</button>
                            </div>
                        </div>
                    `).join('') :
                    '<p>No episodes added yet.</p>'
                }
            </div>
        `;

            // Toggle episodes visibility
            const toggleBtn = seasonElement.querySelector('.btn-toggle');
            const episodesList = seasonElement.querySelector('.episodes-list');

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = episodesList.style.display === 'block';
                episodesList.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = isVisible ? '▼' : '▲';
            });

            seasonsContainer.appendChild(seasonElement);
        });

        // Also show episodes that are connected directly to the show but don't have a season
        const showEpisodes = allEpisodes.filter(ep =>
            ep.showConnection === showId && !seasons.some(season => season.seasonNumber === ep.seasonNumber)
        );

        if (showEpisodes.length > 0) {
            const noSeasonElement = document.createElement('div');
            noSeasonElement.className = 'season-item';
            noSeasonElement.innerHTML = `
            <div>
                <strong>Episodes without a season</strong>
                <span> - ${showEpisodes.length} episodes</span>
                <button class="btn-toggle">▼</button>
            </div>
            <div class="episodes-list">
            ${showEpisodes.map(ep => `
                    <div class="episode-item">
                        <div class="episode-info">
                            <span>Season ${ep.seasonNumber}, Episode ${ep.episodeNumber}: ${ep.name}</span>
                            ${ep.dateWatched ?
                    `<span>Watched: ${formatDate(ep.dateWatched)}</span>` :
                    '<span>Not watched</span>'
                }
                        </div>
                        <div class="episode-actions">
                            <button class="btn-rate" data-id="${ep.id}">Rate</button>
                            <button class="btn-delete" data-id="${ep.id}">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            `;

            // Toggle episodes visibility
            const toggleBtn = noSeasonElement.querySelector('.btn-toggle');
            const episodesList = noSeasonElement.querySelector('.episodes-list');

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = episodesList.style.display === 'block';
                episodesList.style.display = isVisible ? 'none' : 'block';
                toggleBtn.textContent = isVisible ? '▼' : '▲';
            });

            seasonsContainer.appendChild(noSeasonElement);
        }

        if (seasons.length === 0 && showEpisodes.length === 0) {
            seasonsContainer.innerHTML = '<p>No seasons or episodes added yet.</p>';
        }

        showDetailsModal.style.display = 'flex';
    }

    // Delete movie from watchlist
    function deleteMovie(movieId) {
        if (confirm('Are you sure you want to remove this item from your watchlist?')) {
            watchlist = watchlist.filter(m => m.id !== movieId);
            saveWatchlist();
            renderWatchlist();
            updateStats();
        }
    }

    // Handle search filtering
    function handleSearch(e) {
        currentFilter = e.target.value.toLowerCase();
        renderWatchlist();
    }

    // Render watchlist table
    function renderWatchlist() {
        // Filter and sort watchlist
        let filteredList = watchlist.filter(movie =>
            (movie.type === "Movie" || movie.type === "Show") && (
                movie.name.toLowerCase().includes(currentFilter) ||
                movie.director?.toLowerCase().includes(currentFilter) ||
                movie.genre?.toLowerCase().includes(currentFilter) ||
                movie.year?.toString().includes(currentFilter)
            )
        );

        // Sort the list
        filteredList.sort((a, b) => {
            let aValue = a[currentSort.field];
            let bValue = b[currentSort.field];

            // Handle null values
            if (aValue === null || aValue === undefined) aValue = '';
            if (bValue === null || bValue === undefined) bValue = '';

            // Handle numeric values
            if (currentSort.field === 'gfRating' || currentSort.field === 'myRating' ||
                currentSort.field === 'duration') {
                aValue = aValue || 0;
                bValue = bValue || 0;
            }

            if (currentSort.direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        // Clear table
        watchlistBody.innerHTML = '';

        // Show empty state if no movies
        if (filteredList.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Populate table
        filteredList.forEach(movie => {
            let actions = '';
            if (movie.type === "Show") {
                actions = `
                        <button class="btn-view" data-id="${movie.id}">View</button>
                        <button class="btn-rate" data-id="${movie.id}">Rate</button>
                        <button class="btn-delete" data-id="${movie.id}">Delete</button>
                    `;
            } else {
                actions = `
                        <button class="btn-rate" data-id="${movie.id}">Rate</button>
                        <button class="btn-delete" data-id="${movie.id}">Delete</button>
                    `;
            }

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${movie.name}</td>
                <td>${movie.year || '-'}</td>
                <td>${movie.director || '-'}</td>
                <td>${movie.type}</td>
                <td>${movie.genre || '-'}</td>
                <td>${formatDate(movie.dateAdded)}</td>
                <td>${movie.dateWatched ? formatDate(movie.dateWatched) : '-'}</td>
                <td>${movie.gfRating ? '★'.repeat(movie.gfRating) : '-'}</td>
                <td>${movie.myRating ? '★'.repeat(movie.myRating) : '-'}</td>
                <td class="actions">
                    ${actions}
                </td>
            `;

            watchlistBody.appendChild(row);
        });

        // Add event listeners to action buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewShowDetails(e.target.dataset.id);
            });
        });

        document.querySelectorAll('.btn-rate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openRatingModal(e.target.dataset.id);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                deleteMovie(e.target.dataset.id);
            });
        });
    }

    // Update statistics
    function updateStats() {
        const totalMovies = watchlist.filter(m => m.type === 'Movie').length;
        const totalShows = watchlist.filter(m => m.type === 'Show').length;
        const watchedMovies = watchlist.filter(m => m.type === 'Movie' && m.dateWatched).length;
        const watchedShows = watchlist.filter(m => m.type === 'Show' && m.dateWatched).length;

        // Calculate total time spent watching
        const totalDuration = watchlist
            .filter(m => m.dateWatched)
            .reduce((total, m) => total + (m.duration || 0), 0);

        // Calculate average ratings
        const ratedItems = watchlist.filter(m => m.gfRating && m.gfRating > 0);
        const avgXRating = ratedItems.length
            ? (ratedItems.reduce((sum, m) => sum + m.gfRating, 0) / ratedItems.length).toFixed(1)
            : '0.0';

        const myRatedItems = watchlist.filter(m => m.myRating && m.myRating > 0);
        const avgYRating = myRatedItems.length
            ? (myRatedItems.reduce((sum, m) => sum + m.myRating, 0) / myRatedItems.length).toFixed(1)
            : '0.0';

        // Update DOM
        document.getElementById('total-movies').textContent = totalMovies;
        document.getElementById('total-shows').textContent = totalShows;
        document.getElementById('watched-movies').textContent = watchedMovies;
        document.getElementById('watched-shows').textContent = watchedShows;
        document.getElementById('total-duration').textContent = `${totalDuration.toFixed(1)}h`;
        document.getElementById('avg-x-rating').textContent = avgXRating;
        document.getElementById('avg-y-rating').textContent = avgYRating;
    }

    // Save watchlist to localStorage
    function saveWatchlist() {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        showSyncStatus('Changes saved locally');
    }

    // Show sync status message
    function showSyncStatus(message) {
        syncStatus.textContent = message;
        syncStatus.classList.add('visible');

        setTimeout(() => {
            syncStatus.classList.remove('visible');
        }, 3000);
    }

    // Export configuration to JSON file
    function exportConfig() {
        const dataStr = JSON.stringify(watchlist, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = 'watchlist.json';

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        showSyncStatus('Watchlist exported successfully');
    }

    // Import configuration from JSON file
    function importConfig(e) {
        const file = e.target.files[0];
        if (!file) return;

        showLoader(true);

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedData = JSON.parse(e.target.result);

                if (Array.isArray(importedData)) {
                    // Validate each item has required fields
                    const validData = importedData.filter(item =>
                        item.id && item.name && item.type
                    );

                    if (validData.length !== importedData.length) {
                        console.warn('Some imported items were invalid and skipped');
                    }

                    watchlist = validData;
                    saveWatchlist();
                    renderWatchlist();
                    updateStats();
                    showSyncStatus('Watchlist imported successfully');
                } else {
                    throw new Error('Invalid format: Expected array of items');
                }
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                alert('Error importing file. Please make sure it is a valid watchlist JSON file.');
            } finally {
                showLoader(false);
                // Reset file input
                configFileInput.value = '';
            }
        };

        reader.readAsText(file);
    }

    // Show/hide loader
    function showLoader(show) {
        loader.style.display = show ? 'block' : 'none';
    }

    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return '-';

        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    // Initialize the application
    init();
});