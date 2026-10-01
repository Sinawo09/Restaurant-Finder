// Shared page setup: the same file supports the home, directory, and contact pages.
document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');

  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
      navigation.classList.toggle('is-open', !isOpen);
    });
  }

  document.querySelectorAll('.current-year').forEach((yearElement) => {
    yearElement.textContent = new Date().getFullYear();
  });

  const resultsContainer = document.querySelector('#restaurant-results');
  if (resultsContainer) {
    setupRestaurantDirectory(resultsContainer);
  }

  const contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    setupContactForm(contactForm);
  }
});

// Set up search, filters, saved favourites, and restaurant cards on the directory page.
async function setupRestaurantDirectory(resultsContainer) {
  const searchForm = document.querySelector('#restaurant-search-form');
  const searchInput = document.querySelector('#restaurant-search');
  const cuisineFilter = document.querySelector('#cuisine-filter');
  const categoryFilter = document.querySelector('#category-filter');
  const locationFilter = document.querySelector('#location-filter');
  const favouritesFilter = document.querySelector('#favourites-filter');
  const resultsCount = document.querySelector('#results-count');
  const detailsDialog = document.querySelector('#restaurant-dialog');
  const nearbyButton = document.querySelector('#find-nearby');
  const locationStatus = document.querySelector('#location-status');
  const browseAllButton = document.querySelector('#browse-all-restaurants');
  let restaurants = [];
  let favouriteIds = loadFavouriteIds();
  let userCoordinates = null;
  let isNearMeActive = false;

  // Apply any category chosen from the home page.
  const requestedCategory = new URLSearchParams(window.location.search).get('category');
  if (requestedCategory && [...categoryFilter.options].some((option) => option.value === requestedCategory || option.textContent === requestedCategory)) {
    categoryFilter.value = requestedCategory;
  }

  resultsContainer.innerHTML = '<p class="status-message">Loading restaurants...</p>';
  resultsContainer.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch('data/restaurants.json');
    if (!response.ok) {
      throw new Error(`Restaurant data request failed: ${response.status}`);
    }
    restaurants = await response.json();
    if (!Array.isArray(restaurants)) {
      throw new Error('Restaurant data must be a list.');
    }
    renderRestaurants();
  } catch (error) {
    console.error('Could not load restaurant data:', error);
    resultsContainer.innerHTML = '<p class="status-message">We couldn\'t load the restaurant information. Please try again later.</p>';
    resultsCount.textContent = '';
  } finally {
    resultsContainer.setAttribute('aria-busy', 'false');
  }

  // Search as the user types, and also support submitting with the Search button.
  searchInput.addEventListener('input', renderRestaurants);
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    renderRestaurants();
  });
  cuisineFilter.addEventListener('change', renderRestaurants);
  // Keep the existing category, city, and favourites filters working alongside cuisine.
  categoryFilter.addEventListener('change', renderRestaurants);
  locationFilter.addEventListener('change', renderRestaurants);
  favouritesFilter.addEventListener('change', renderRestaurants);

  // Ask for location only after the user chooses to sort nearby restaurants.
  nearbyButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = 'Your browser does not support location. You can still search by city.';
      return;
    }

    nearbyButton.disabled = true;
    nearbyButton.textContent = 'Finding your location...';
    locationStatus.textContent = 'Waiting for location permission...';

    navigator.geolocation.getCurrentPosition((position) => {
      userCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      isNearMeActive = true;
      nearbyButton.disabled = false;
      nearbyButton.textContent = 'Find Restaurants Near Me';
      locationStatus.textContent = 'Sorted by distance. Your location is not saved or shared.';
      browseAllButton.hidden = false;
      renderRestaurants();
    }, (error) => {
      nearbyButton.disabled = false;
      nearbyButton.textContent = 'Find Restaurants Near Me';
      isNearMeActive = false;
      userCoordinates = null;
      browseAllButton.hidden = true;
      locationStatus.textContent = error.code === 1
        ? 'Location access was not allowed. You can still search by city.'
        : 'We could not determine your location. You can still search by city.';
    });
  });

  // Clear filters as well as distance sorting so all restaurants are visible again.
  browseAllButton.addEventListener('click', () => {
    searchInput.value = '';
    cuisineFilter.value = '';
    categoryFilter.value = '';
    locationFilter.value = '';
    favouritesFilter.checked = false;
    userCoordinates = null;
    isNearMeActive = false;
    locationStatus.textContent = '';
    browseAllButton.hidden = true;
    renderRestaurants();
  });

  resultsContainer.addEventListener('click', (event) => {
    const favouriteButton = event.target.closest('[data-favourite-id]');
    const detailsButton = event.target.closest('[data-details-id]');

    if (favouriteButton) {
      const restaurantId = Number(favouriteButton.dataset.favouriteId);
      if (favouriteIds.includes(restaurantId)) {
        favouriteIds = favouriteIds.filter((id) => id !== restaurantId);
      } else {
        favouriteIds.push(restaurantId);
      }
      saveFavouriteIds(favouriteIds);
      renderRestaurants();
    }

    if (detailsButton && detailsDialog) {
      const restaurant = restaurants.find((item) => item.id === Number(detailsButton.dataset.detailsId));
      if (restaurant) {
        document.querySelector('#dialog-image').src = restaurant.image;
        document.querySelector('#dialog-image').alt = `A dish from ${restaurant.name}`;
        document.querySelector('#dialog-title').textContent = restaurant.name;
        document.querySelector('#dialog-meta').textContent = `${restaurant.category} · ${restaurant.city}`;
        document.querySelector('#dialog-description').textContent = restaurant.description;
        document.querySelector('#dialog-address').textContent = restaurant.address;
        const bookingLink = document.querySelector('#dialog-booking');
        bookingLink.href = `https://www.google.com/search?q=${encodeURIComponent(`${restaurant.name} ${restaurant.city} reservations`)}`;
        bookingLink.setAttribute('aria-label', `Find booking options for ${restaurant.name} (opens in a new tab)`);
        detailsDialog.showModal();
      }
    }
  });

  const closeDialogButton = document.querySelector('.dialog-close');
  if (closeDialogButton && detailsDialog) {
    closeDialogButton.addEventListener('click', () => detailsDialog.close());
  }

  // Read the controls and combine their matches, so search and cuisine narrow the same list.
  function renderRestaurants() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCuisine = cuisineFilter.value;
    const selectedCategory = categoryFilter.value;
    const selectedLocation = locationFilter.value;
    const showOnlyFavourites = favouritesFilter.checked;

    const matchingRestaurants = restaurants.filter((restaurant) => {
      const searchableText = `${restaurant.name} ${restaurant.category} ${restaurant.city} ${restaurant.address}`.toLowerCase();
      const matchesSearch = searchableText.includes(searchTerm);
      const matchesCuisine = !selectedCuisine || restaurant.cuisine === selectedCuisine;
      const matchesCategory = !selectedCategory || restaurant.category === selectedCategory;
      const matchesLocation = !selectedLocation || restaurant.city === selectedLocation;
      const matchesFavourites = !showOnlyFavourites || favouriteIds.includes(restaurant.id);
      return matchesSearch && matchesCuisine && matchesCategory && matchesLocation && matchesFavourites;
    });

    // Keep the user's location in memory only, and sort a copy of the matching list.
    const displayedRestaurants = userCoordinates
      ? matchingRestaurants.map((restaurant) => ({
        ...restaurant,
        distanceKm: Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude)
          ? calculateDistance(userCoordinates.latitude, userCoordinates.longitude, restaurant.latitude, restaurant.longitude)
          : null
      })).sort((first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity))
      : matchingRestaurants;

    resultsContainer.replaceChildren();
    if (displayedRestaurants.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'status-message';
      emptyMessage.textContent = 'No restaurants found. Try another search.';
      resultsContainer.append(emptyMessage);
      resultsCount.textContent = '0 places';
      return;
    }

    displayedRestaurants.forEach((restaurant) => {
      resultsContainer.append(createRestaurantCard(restaurant, favouriteIds.includes(restaurant.id)));
    });
    resultsCount.textContent = `${displayedRestaurants.length} ${displayedRestaurants.length === 1 ? 'place' : 'places'}`;
  }
}

// Build each restaurant card from data, including its real address and map link.
function createRestaurantCard(restaurant, isFavourite) {
  const card = document.createElement('article');
  card.className = 'restaurant-card';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'card-image-wrap';
  const image = document.createElement('img');
  image.className = 'card-image';
  image.src = restaurant.image;
  image.alt = `A dish from ${restaurant.name}`;
  image.loading = 'lazy';
  imageWrap.append(image);

  const favouriteButton = document.createElement('button');
  favouriteButton.className = 'card-favourite';
  favouriteButton.type = 'button';
  favouriteButton.dataset.favouriteId = restaurant.id;
  favouriteButton.setAttribute('aria-pressed', String(isFavourite));
  favouriteButton.setAttribute('aria-label', isFavourite ? `Remove ${restaurant.name} from favourites` : `Add ${restaurant.name} to favourites`);
  favouriteButton.textContent = isFavourite ? '♥' : '♡';
  imageWrap.append(favouriteButton);

  const body = document.createElement('div');
  body.className = 'card-body';
  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = restaurant.category;
  const city = document.createElement('p');
  city.className = 'card-city';
  city.textContent = restaurant.city;
  const name = document.createElement('h3');
  name.textContent = restaurant.name;
  const description = document.createElement('p');
  description.className = 'card-description';
  description.textContent = restaurant.description;
  const address = document.createElement('p');
  address.className = 'card-address';
  address.textContent = restaurant.address;

  if (Number.isFinite(restaurant.distanceKm)) {
    const distance = document.createElement('p');
    distance.className = 'card-distance';
    distance.textContent = `${restaurant.distanceKm.toFixed(1)} km away`;
    body.append(meta, city, name, description, address, distance);
  } else {
    body.append(meta, city, name, description, address);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const locationLink = document.createElement('a');
  locationLink.className = 'map-link';
  locationLink.href = getRestaurantMapLink(restaurant);
  locationLink.target = '_blank';
  locationLink.rel = 'noopener noreferrer';
  locationLink.setAttribute('aria-label', `View ${restaurant.name} on Google Maps (opens in a new tab)`);
  locationLink.textContent = 'View Location ↗';
  const detailsButton = document.createElement('button');
  detailsButton.className = 'details-button';
  detailsButton.type = 'button';
  detailsButton.dataset.detailsId = restaurant.id;
  detailsButton.textContent = 'View Details →';
  const saveButton = document.createElement('button');
  saveButton.className = 'save-button';
  saveButton.type = 'button';
  saveButton.dataset.favouriteId = restaurant.id;
  saveButton.setAttribute('aria-pressed', String(isFavourite));
  saveButton.textContent = isFavourite ? '♥ Saved' : '♡ Favourite';
  actions.append(locationLink, detailsButton, saveButton);
  body.append(actions);
  card.append(imageWrap, body);
  return card;
}

// Use each record's map link, or build a search from coordinates/address if it is missing.
function getRestaurantMapLink(restaurant) {
  if (typeof restaurant.mapLink === 'string' && restaurant.mapLink.startsWith('https://www.google.com/maps/')) {
    return restaurant.mapLink;
  }

  const hasCoordinates = Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude);
  const search = hasCoordinates
    ? `${restaurant.latitude},${restaurant.longitude}`
    : restaurant.address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
}

// Calculate the great-circle distance between two points on Earth in kilometres.
function calculateDistance(latitudeOne, longitudeOne, latitudeTwo, longitudeTwo) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = toRadians(latitudeTwo - latitudeOne);
  const longitudeDifference = toRadians(longitudeTwo - longitudeOne);
  const haversine = Math.min(1, Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(toRadians(latitudeOne)) * Math.cos(toRadians(latitudeTwo))
    * Math.sin(longitudeDifference / 2) ** 2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * centralAngle;
}

// Read saved IDs safely so malformed storage never stops the directory from loading.
function loadFavouriteIds() {
  try {
    const savedIds = JSON.parse(localStorage.getItem('restaurant-finder-favourites') || '[]');
    return Array.isArray(savedIds) ? savedIds.filter((id) => Number.isInteger(id)) : [];
  } catch (error) {
    console.warn('Saved favourites could not be read:', error);
    return [];
  }
}

function saveFavouriteIds(favouriteIds) {
  try {
    localStorage.setItem('restaurant-finder-favourites', JSON.stringify(favouriteIds));
  } catch (error) {
    console.warn('Saved favourites could not be stored:', error);
  }
}

// Validate each contact field and show its message next to that field.
function setupContactForm(form) {
  const fields = [
    { input: form.elements.name, error: document.querySelector('#name-error'), message: 'Please enter your name.' },
    { input: form.elements.email, error: document.querySelector('#email-error'), message: 'Please enter a valid email address.' },
    { input: form.elements.subject, error: document.querySelector('#subject-error'), message: 'Please enter a subject.' },
    { input: form.elements.message, error: document.querySelector('#message-error'), message: 'Please enter a message.' }
  ];

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let isFormValid = true;

    fields.forEach(({ input, error, message }) => {
      const value = input.value.trim();
      const isEmail = input.type === 'email';
      const isValid = value.length > 0 && (!isEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      input.setAttribute('aria-invalid', String(!isValid));
      error.textContent = isValid ? '' : message;
      if (!isValid) {
        isFormValid = false;
      }
    });

    if (isFormValid) {
      document.querySelector('#form-success').hidden = false;
      form.reset();
      fields.forEach(({ input }) => input.setAttribute('aria-invalid', 'false'));
    } else {
      document.querySelector('#form-success').hidden = true;
      const firstInvalidField = fields.find(({ input }) => input.getAttribute('aria-invalid') === 'true');
      firstInvalidField.input.focus();
    }
  });

  fields.forEach(({ input, error }) => {
    input.addEventListener('input', () => {
      if (input.value.trim()) {
        input.setAttribute('aria-invalid', 'false');
        error.textContent = '';
      }
    });
  });
}