# Restaurant Finder

A responsive restaurant directory for discovering places to eat across South Africa. Browse by food category, search by restaurant or city, save favourites, and sort listings by distance from your current location.

## Features

- Search restaurants by name, category, city, or address.
- Filter by food category and city, or show saved favourites.
- Save favourites in the browser using `localStorage`.
- Optionally sort restaurants by distance after granting location access. Your coordinates are only held in memory for the current page session.
- View restaurant details, open map links, and search for reservation options.
- Responsive home, directory, and contact pages.

## Run locally

The directory loads its data with `fetch`, so open the site through a local web server rather than directly opening the HTML files.

From the project folder, run:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000> in your browser. You can also use the VS Code Live Server extension.

Location access generally requires `localhost` or a secure HTTPS connection. It is optional; city and category filters work without it.

## Project structure

```text
restaurant-finder/
├── index.html              # Home page
├── restaurants.html        # Searchable restaurant directory
├── contact.html            # Contact form
├── css/
│   └── style.css           # Site styles
├── data/
│   └── restaurants.json    # Restaurant listings and coordinates
└── js/
    └── script.js           # Search, filters, favourites, and page behavior
```

## Restaurant data

Edit `data/restaurants.json` to update the directory. Each restaurant record includes an ID, name, cuisine, category, address, city, coordinates, description, image URL, and map link. Restaurant images are loaded from Unsplash; map and booking links open external services.

## Contact form

The contact page validates form fields in the browser and displays a success message, but it does not send or store submissions. A backend or form service is needed to receive messages.
