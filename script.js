// Global variables
let watchlistData = [];
let currentDataView = [];
let currentSort = { column: null, direction: 'asc' };
let config = {
  sheetId: "abc123",
  movieSheet: "Movies",
  showSheet: "Shows",
  seasonSheet: "Seasons",
  episodeSheet: "Episodes",
  apiUrl: "https://script.google.com/macros/s/abc123/exec"
};
let showMap = {};

// DOM Elements
const tableBody = document.getElementById('watchlist-body');
const searchInput = document.getElementById('search-input');
const addMovieBtn = document.getElementById('add-movie-btn');
const importConfigBtn = document.getElementById('import-config-btn');
const configFileInput = document.getElementById('config-file-input');
const loader = document.getElementById('loader');
const syncStatus = document.getElementById('sync-status');
const emptyState = document.getElementById('empty-state');
const ratingModal = document.getElementById('rating-modal');
const addModal = document.getElementById('add-movie-modal');
const mediaTypeSelect = document.getElementById('new-media-type');

// Initialize application
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupEventListeners();
  await loadData();
  renderTable();
  updateStatistics();
}

function setupEventListeners() {
  // Add movie button
  addMovieBtn.addEventListener('click', () => {
    document.getElementById('new-date-added').valueAsDate = new Date();
    openAddModal();
  });

  // Import config button
  importConfigBtn.addEventListener('click', () => {
    configFileInput.click();
  });

  // Config file input
  configFileInput.addEventListener('change', handleConfigImport);

  // Media type change in add modal
  mediaTypeSelect.addEventListener('change', updateAddModalFields);

  // Save new movie button
  document.getElementById('save-new-movie-btn').addEventListener('click', saveNewMedia);

  // Close modals
  document.querySelectorAll('.close-modal, .close-add-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      ratingModal.style.display = 'none';
      addModal.style.display = 'none';
    });
  });

  // Save rating button
  document.getElementById('save-rating-btn').addEventListener('click', saveRating);

  // Search input
  searchInput.addEventListener('input', () => {
    filterData(searchInput.value);
    renderTable();
  });

  // Table header sorting
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.getAttribute('data-sort');
      sortData(column);
      renderTable();
    });
  });

  // Click outside modals to close
  window.addEventListener('click', (e) => {
    if (e.target === ratingModal) ratingModal.style.display = 'none';
    if (e.target === addModal) addModal.style.display = 'none';
  });
}

async function loadData() {
  showLoader();
  updateSyncStatus('Loading Data...', 'loading');
  try {
    console.log('Loading data from:', `${config.apiUrl}?action=getAllData`);
    const response = await fetch(`${config.apiUrl}?action=getAllData`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API response:', data);
    
    // Check for error in response
    if (data.error) {
      throw new Error(data.error);
    }
    
    processData(data);
    hideLoader();
    updateSyncStatus('Data loaded successfully', 'success');
    renderTable();
  } catch (error) {
    console.error('Error loading data:', error);
    hideLoader();
    updateSyncStatus(`Failed to load data: ${error.message}`, 'error');
  }
}

function processData(data) {
  watchlistData = [];
  showMap = {};
  
  // Process shows first to create a map for seasons/episodes
  if (data.shows) {
    data.shows.forEach(show => {
      showMap[show.ShowId] = show;
      watchlistData.push(createShowObject(show));
    });
  }
  
  // Process movies
  if (data.movies) {
    data.movies.forEach(movie => {
      watchlistData.push(createMovieObject(movie));
    });
  }
  
  // Process seasons
  if (data.seasons) {
    data.seasons.forEach(season => {
      const show = showMap[season.ShowId];
      if (show) {
        watchlistData.push(createSeasonObject(season, show));
      }
    });
  }
  
  // Process episodes
  if (data.episodes) {
    data.episodes.forEach(episode => {
      const show = showMap[episode.ShowId];
      if (show) {
        watchlistData.push(createEpisodeObject(episode, show));
      }
    });
  }
  
  currentDataView = [...watchlistData];
  console.log('Processed data:', watchlistData);
}

function createMovieObject(movie) {
  return {
    id: `movie-${movie.MovieId}`,
    type: 'Movie',
    title: movie.Title,
    year: movie.Year,
    director: movie.Director,
    genre: movie.Genre,
    dateAdded: movie['Date Added'],
    dateWatched: movie['Date Watched'],
    duration: movie.Duration,
    xRating: movie['X Rating'],
    yRating: movie['Y Rating'],
    rawData: movie
  };
}

function createShowObject(show) {
  return {
    id: `show-${show.ShowId}`,
    type: 'Show',
    title: show.Title,
    year: show['Year Range'],
    director: show.Director,
    genre: show.Genre,
    dateAdded: show['Date Added'],
    dateWatched: show['Date Finished'],
    totalSeasons: show['Total Seasons'],
    totalEpisodes: show['Total Episodes'],
    xRating: show['X Rating'],
    yRating: show['Y Rating'],
    rawData: show
  };
}

function createSeasonObject(season, show) {
  return {
    id: `season-${season.ShowId}-${season['Season #']}`,
    type: 'Season',
    title: `${show.Title} - Season ${season['Season #']}`,
    year: season['Year Range'] || show['Year Range'],
    director: season.Director || show.Director,
    genre: show.Genre,
    dateAdded: season['Date Added'],
    dateWatched: season['Date Finished'],
    totalEpisodes: season['Total Episodes'],
    xRating: season['X Rating'],
    yRating: season['Y Rating'],
    rawData: season
  };
}

function createEpisodeObject(episode, show) {
  return {
    id: `episode-${episode.ShowId}-${episode['Season #']}-${episode['Episode #']}`,
    type: 'Episode',
    title: `${show.Title} S${episode['Season #']}E${episode['Episode #']}: ${episode.Title}`,
    year: show['Year Range'],
    director: episode.Director || show.Director,
    genre: show.Genre,
    dateAdded: episode['Date Added'],
    dateWatched: episode['Date Watched'],
    duration: episode.Duration,
    xRating: episode['X Rating'],
    yRating: episode['Y Rating'],
    rawData: episode
  };
}

function renderTable() {
  tableBody.innerHTML = '';
  
  if (currentDataView.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  currentDataView.forEach(item => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${item.title}</td>
      <td>${item.year || ''}</td>
      <td>${item.director || ''}</td>
      <td>${item.type}</td>
      <td>${item.genre || ''}</td>
      <td>${formatDate(item.dateAdded)}</td>
      <td>${formatDate(item.dateWatched)}</td>
      <td>${item.xRating || ''}</td>
      <td>${item.yRating || ''}</td>
      <td class="actions">
        <button class="btn-rate" data-id="${item.id}">
          <i class="fas fa-star"></i> Rate
        </button>
        <button class="btn-delete" data-id="${item.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to rate buttons
  document.querySelectorAll('.btn-rate').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openRatingModal(id);
    });
  });
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      deleteItem(id);
    });
  });
}

function updateStatistics() {
  const movies = watchlistData.filter(item => item.type === 'Movie');
  const shows = watchlistData.filter(item => item.type === 'Show');
  const watchedMovies = movies.filter(movie => movie.dateWatched);
  const watchedShows = shows.filter(show => show.dateWatched);
  
  // Time spent calculation (only for movies and episodes)
  let totalDuration = 0;
  watchlistData.forEach(item => {
    if ((item.type === 'Movie' || item.type === 'Episode') && item.dateWatched && item.duration) {
      totalDuration += parseFloat(item.duration);
    }
  });
  
  // Rating calculations
  const ratedItems = watchlistData.filter(item => 
    item.dateWatched && (item.xRating || item.yRating)
  );
  
  const totalXRatings = ratedItems.reduce((sum, item) => sum + parseFloat(item.xRating || 0), 0);
  const totalYRatings = ratedItems.reduce((sum, item) => sum + parseFloat(item.yRating || 0), 0);
  
  document.getElementById('total-movies').textContent = movies.length;
  document.getElementById('total-shows').textContent = shows.length;
  document.getElementById('watched-movies').textContent = watchedMovies.length;
  document.getElementById('watched-shows').textContent = watchedShows.length;
  document.getElementById('total-duration').textContent = totalDuration.toFixed(1);
  document.getElementById('avg-x-rating').textContent = 
    ratedItems.length ? (totalXRatings / ratedItems.length).toFixed(1) : '0.0';
  document.getElementById('avg-y-rating').textContent = 
    ratedItems.length ? (totalYRatings / ratedItems.length).toFixed(1) : '0.0';
}

function openRatingModal(id) {
  const item = watchlistData.find(i => i.id === id);
  if (!item) return;
  
  document.getElementById('modal-movie-title').textContent = item.title;
  
  // Convert date to YYYY-MM-DD for input
  document.getElementById('date-watched').value = item.dateWatched ? toYMD(item.dateWatched) : '';
  
  // Setup star ratings
  setupStarRating('modal-x-rating', item.xRating || 0);
  setupStarRating('modal-y-rating', item.yRating || 0);
  
  ratingModal.dataset.id = id;
  ratingModal.style.display = 'block';
}

function setupStarRating(containerId, currentRating) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('i');
    star.className = i <= currentRating ? 'fas fa-star' : 'far fa-star';
    star.dataset.value = i;
    
    star.addEventListener('click', () => {
      // Update all stars in this container
      container.querySelectorAll('i').forEach(s => {
        s.className = s.dataset.value <= i ? 'fas fa-star' : 'far fa-star';
      });
    });
    
    container.appendChild(star);
  }
}

function saveRating() {
  const id = ratingModal.dataset.id;
  const itemIndex = watchlistData.findIndex(i => i.id === id);
  if (itemIndex === -1) return;
  
  const dateWatchedInput = document.getElementById('date-watched').value;
  const xRating = document.querySelectorAll('#modal-x-rating .fas').length;
  const yRating = document.querySelectorAll('#modal-y-rating .fas').length;
  
  // Convert date to DD/MM/YYYY
  const dateWatched = dateWatchedInput ? toDMY(dateWatchedInput) : '';
  
  watchlistData[itemIndex].dateWatched = dateWatched;
  watchlistData[itemIndex].xRating = xRating;
  watchlistData[itemIndex].yRating = yRating;
  
  // Update raw data for sync
  if (watchlistData[itemIndex].rawData) {
    watchlistData[itemIndex].rawData['Date Watched'] = dateWatched;
    watchlistData[itemIndex].rawData['X Rating'] = xRating;
    watchlistData[itemIndex].rawData['Y Rating'] = yRating;
  }
  
  ratingModal.style.display = 'none';
  renderTable();
  updateStatistics();
  syncData();
}

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

function showFields(fieldIds) {
  fieldIds.forEach(id => {
    document.getElementById(id).style.display = 'flex';
  });
}

function saveNewMedia() {
  const type = mediaTypeSelect.value;
  const title = document.getElementById('new-name').value;
  const year = document.getElementById('new-year').value;
  const director = document.getElementById('new-director').value;
  const genre = document.getElementById('new-genre').value;
  const showId = document.getElementById('show-connection').value;
  const seasonNum = parseInt(document.getElementById('season-num').value);
  const episodeNum = parseInt(document.getElementById('episode-num').value);
  const duration = parseFloat(document.getElementById('new-duration').value);
  const totalSeasons = parseInt(document.getElementById('new-season-amnt').value);
  const totalEpisodes = parseInt(document.getElementById('new-episode-amnt').value);
  const dateAddedInput = document.getElementById('new-date-added').value;
  
  // Basic validation
  if (!title && type !== 'Season') {
    alert('Title is required');
    return;
  }
  
  // Convert date to DD/MM/YYYY
  const dateAdded = dateAddedInput ? toDMY(dateAddedInput) : '';
  
  const newItem = {
    id: `new-${Date.now()}`,
    type,
    title,
    year,
    director,
    genre,
    dateAdded,
    dateWatched: '',
    xRating: 0,
    yRating: 0,
    rawData: {}
  };
  
  // Type-specific properties
  if (type === 'Movie') {
    newItem.duration = duration;
    newItem.rawData = {
      MovieId: watchlistData.filter(i => i.type === 'Movie').length + 1,
      Title: title,
      Year: year,
      Director: director,
      Type: type,
      Genre: genre,
      "Date Added": dateAdded,
      "Date Watched": "",
      Duration: duration,
      "X Rating": 0,
      "Y Rating": 0
    };
  } else if (type === 'Show') {
    newItem.totalSeasons = totalSeasons;
    newItem.totalEpisodes = totalEpisodes;
    newItem.rawData = {
      ShowId: watchlistData.filter(i => i.type === 'Show').length + 1,
      Title: title,
      "Year Range": year,
      Director: director,
      Type: type,
      Genre: genre,
      "Date Added": dateAdded,
      "Date Finished": "",
      "Total Seasons": totalSeasons,
      "Total Episodes": totalEpisodes,
      "X Rating": 0,
      "Y Rating": 0
    };
  } else if (type === 'Season') {
    newItem.title = `Season ${seasonNum}`;
    newItem.totalEpisodes = totalEpisodes;
    newItem.rawData = {
      ShowId: showId,
      "Season #": seasonNum,
      "Year Range": year,
      Director: director,
      "Date Added": dateAdded,
      "Date Finished": "",
      "Total Episodes": totalEpisodes,
      "X Rating": 0,
      "Y Rating": 0
    };
  } else if (type === 'Episode') {
    newItem.duration = duration;
    newItem.rawData = {
      ShowId: showId,
      "Season #": seasonNum,
      "Episode #": episodeNum,
      Title: title,
      "Date Added": dateAdded,
      "Date Watched": "",
      Duration: duration,
      "X Rating": 0,
      "Y Rating": 0
    };
  }
  
  watchlistData.push(newItem);
  currentDataView = [...watchlistData];
  
  addModal.style.display = 'none';
  renderTable();
  updateStatistics();
  syncData();
}

function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  
  watchlistData = watchlistData.filter(item => item.id !== id);
  currentDataView = currentDataView.filter(item => item.id !== id);
  
  renderTable();
  updateStatistics();
  syncData();
}

function filterData(query) {
  if (!query) {
    currentDataView = [...watchlistData];
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  currentDataView = watchlistData.filter(item => {
    return (
      (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
      (item.director && item.director.toLowerCase().includes(lowerQuery)) ||
      (item.genre && item.genre.toLowerCase().includes(lowerQuery)) ||
      (item.type && item.type.toLowerCase().includes(lowerQuery)) ||
      (item.year && item.year.toString().includes(lowerQuery))
    );
  });
}

function sortData(column) {
  if (currentSort.column === column) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.direction = 'asc';
  }
  
  currentDataView.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    
    // Handle empty values
    if (!valA) valA = '';
    if (!valB) valB = '';
    
    // Numeric sorting for ratings and years
    if (column === 'gfRating' || column === 'myRating' || column === 'year') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    }
    // Date sorting
    else if (column === 'dateAdded' || column === 'dateWatched') {
      valA = new Date(toYMD(valA)).getTime();
      valB = new Date(toYMD(valB)).getTime();
    }
    
    if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

async function syncData() {
  showLoader();
  updateSyncStatus('Syncing data...', 'loading');
  
  try {
    // Prepare data for each sheet
    const movies = watchlistData
      .filter(item => item.type === 'Movie')
      .map(item => ({ ...item.rawData }));
    
    const shows = watchlistData
      .filter(item => item.type === 'Show')
      .map(item => ({ ...item.rawData }));
    
    const seasons = watchlistData
      .filter(item => item.type === 'Season')
      .map(item => ({ ...item.rawData }));
    
    const episodes = watchlistData
      .filter(item => item.type === 'Episode')
      .map(item => ({ ...item.rawData }));
    
    console.log('Sending sync data:', { movies, shows, seasons, episodes });
    
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        movies, 
        shows, 
        seasons, 
        episodes 
      }),
      headers: { 
        'Content-Type': 'application/json' 
      }
    });
    
    const result = await response.json();
    console.log('Sync response:', result);
    
    if (!response.ok || result.error) {
      throw new Error(result.error || `HTTP error: ${response.status}`);
    }
    
    updateSyncStatus('Data synced successfully', 'success');
  } catch (error) {
    console.error('Sync error:', error);
    updateSyncStatus(`Sync failed: ${error.message}`, 'error');
  } finally {
    hideLoader();
  }
}

function handleConfigImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const newConfig = JSON.parse(event.target.result);
      
      // Validate config structure
      if (!newConfig.apiUrl || !newConfig.sheetId) {
        throw new Error('Invalid config file structure');
      }
      
      config = { ...newConfig };
      updateSyncStatus('Config imported successfully', 'success');
      
      // Clear file input
      e.target.value = '';
      
      // Reload data with new config
      loadData();
    } catch (error) {
      console.error('Error parsing config:', error);
      updateSyncStatus(`Invalid config: ${error.message}`, 'error');
    }
  };
  
  reader.onerror = () => {
    updateSyncStatus('Error reading file', 'error');
  };
  
  reader.readAsText(file);
}

// Helper functions
function formatDate(dateString) {
  if (!dateString) return '';
  // Return as-is since we're using DD/MM/YYYY format
  return dateString;
}

function showLoader() {
  loader.style.display = 'block';
}

function hideLoader() {
  loader.style.display = 'none';
}

function updateSyncStatus(message, type) {
  syncStatus.textContent = message;
  syncStatus.className = `status-message status-${type}`;
}

// Helper functions for date conversion
function toYMD(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  const [day, month, year] = ddmmyyyy.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function toDMY(ymd) {
  if (!ymd) return '';
  const [year, month, day] = ymd.split('-');
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}