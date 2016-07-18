import {autoinject, computedFrom, observable} from 'aurelia-framework';
import {User} from './user';
import {Api} from './api';
import config from './config';

// We have no typings for these, so just make TypeScript happy
declare var firebase;
declare var google;
declare var MarkerClusterer;

const mapStyles = {
    styles: [
        {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [
                { color: '#5BA99F' }
            ]
        },
        {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [
                { hue: '#96FF91' }
            ]
        },
        {
            featureType: 'poi',
            elementType: 'geometry',
            stylers: [
                { color: '#EAFFE7' }
            ]
        }
    ]
};

@autoinject
export class Home {
    // Class references for injected classes
    api: Api;
    user: User;

    // Loaded Pokemon from our JSON file
    pokemon: Array<string> = [];

    // Loaded data from the server
    // TODO: Make data for specific locations load instead of everything or this could be huge
    @observable foundPokemon: Array<any> = [];

    // A boolean for showing/hiding the popup
    // we use this to create the draggable map when this displays
    @observable showingPopup: boolean = false;

    // An observed object of coordinates
    @observable currentCoords;

    // Just some map stuff
    mapReady: boolean = false;
    mapMarkers: Array<any> = [];

    geocoder;
    infowindow;
    map;
    dragMap;
    sightingIcon;
    markerCluster;

    // When the popup for adding a new sighting is displayed, we tie everything to this model
    currentSighting = {
        name: null,
        latitude: null,
        longitude: null
    };

    constructor(api: Api, user: User) {
        this.api = api;
        this.user = user;
    }

    activate() {        
        let pokedexPromise = new Promise((resolve, reject) => {
            request('pokedex.json').then((pokemons: Array<any>) => {
                pokemons.forEach(pokemon => {
                    this.pokemon.push(pokemon.ename);
                });
                resolve(pokemons);
            });
        });

        let firebasePromise = new Promise((resolve, reject) => {
            firebase.database().ref('found').on('child_added', data => {
                this.foundPokemon.push(data.val());
                this.markerClusterer();
                resolve(data);
            });
        });

        // Halt execution of viewmodel until all promises resolve
        return Promise.all([pokedexPromise, firebasePromise]);
    }

    @computedFrom('currentSighting.name', 'currentSighting.latitude', 'currentSighting.longitude')
    get sightingIsSubmittable() {
        let currentSighting = this.currentSighting;

        return (currentSighting.name && currentSighting.latitude && currentSighting.longitude);
    }

    // Aka DOM.Ready
    attached() {
        this.mapScripts();
        this.registerEvents();
    }

    /**
     * Register any DOM events
     */
    registerEvents() {
        document.addEventListener('keydown', event => {
            if (event.defaultPrevented) {
                return;
            }

            let isEscape = false;

            if ('key' in event) {
                isEscape = event.key === 'Escape';
            } else {
                isEscape = event.keyCode === 27;
            }

            if (isEscape) {
                this.showingPopup = false;
            }
        });
    }

    /**
     * Inject mapping scripts into the page
     * and then start the map loading
     * 
     */
    mapScripts() {
        let gScript = document.createElement('script');
        gScript.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsKey}`;
        gScript.id = 'google-api-script';
        gScript.async = true;
        gScript.defer = true;

        let clusterer = document.createElement('script');
        clusterer.src = 'vendor/markerclusterer.js';
        clusterer.id = 'clusterer-script';
        
        gScript.onload = () => { 
            this.infowindow = new google.maps.InfoWindow();
            this.geocoder = new google.maps.Geocoder();           
            this.mapReady = true;

            head.appendChild(clusterer);

            this.initMap();
        }

        let head = document.querySelector('head');
        let gScriptDom = document.getElementById('google-api-script');
        let clustererDom = document.getElementById('clusterer-script');

        if (!gScriptDom) {
            head.appendChild(gScript);
        } else {
            this.mapReady = true;
            this.initMap();
        }
    }

    /**
     * Creates our large background map
     * and then sorts out adding markers to it
     * 
     */
    initMap() {
        // Shared Pokeball sighting icon
        this.sightingIcon = new google.maps.MarkerImage(
            'assets/images/pokeball.png',
            null,
            null,
            null,
            new google.maps.Size(20, 20)
        );

        // Create the big map
        this.map = new google.maps.Map(document.getElementById('main-map'), {
            center: {lat: -34.397, lng: 150.644},
            styles: mapStyles,
            zoom: 16 
        });

        // Get the current location and then center the map
        this.getCurrentLocation().then((coords: any) => {
            this.currentCoords = coords;
            let reCenter = new google.maps.LatLng(coords.lat, coords.lng);
            this.map.setCenter(reCenter);
        });

        // We have a map, now create markers for it
        this.createMainMapMarkers();
    }

    /**
     * Adds Pokemon sighting markers to the map
     * 
     */
    createMainMapMarkers() {
        // Iterate all of our added Pokemon
        this.foundPokemon.forEach(item => {
            // Create a Google Maps marker object
            let marker = new google.maps.Marker({
                icon: this.sightingIcon,
                position: new google.maps.LatLng(item.latitude, item.longitude),
                type: 'sighting'
            });

            // Store reference to current item on marker
            marker._item = item;

            // Display date stuff
            let itemDate = new Date(item.when);
            let itemDisplayDate = `${itemDate.toLocaleDateString()}`;

            let content = `<strong>Found:</strong> ${item.name}<br><strong>When:</strong> ${itemDisplayDate}`;

            // Make sure we don't already have this marker
            google.maps.event.addListener(marker, 'click', ((marker, content) => {
                let self = this;

                return function() {
                    self.infowindow.setContent(content);
                    self.infowindow.open(this.map, marker);
                }
            })(marker, content));

            this.mapMarkers.push(marker);
        });  

        this.markerClusterer();    
    }

    markerClusterer() {
        let options = {
            gridSize: 50,
            imagePath: 'assets/images/m',
            maxZoom: 14
        };

        if (this.markerClustererFound()) {
            this.markerCluster = new MarkerClusterer(this.map, this.mapMarkers, options);
        } else {
            // TODO: refactor this, I am sorry :(
            setTimeout(() => {
                if (this.markerClustererFound()) {
                    this.markerCluster = new MarkerClusterer(this.map, this.mapMarkers, options);
                } else {
                    setTimeout(() => {
                        if (this.markerClustererFound()) {
                            this.markerCluster = new MarkerClusterer(this.map, this.mapMarkers, options);
                        }
                    }, 500);
                }
            }, 500);
        }
    }

    geocodeAddress(address) {
        return new Promise((resolve, reject) => {
            this.geocoder.geocode( { 'address': address }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK) {
                    this.map.setOptions({
                        zoom: 16
                    });
                    this.map.setCenter(results[0].geometry.location);
                    resolve(results[0]);
                } else {
                    reject();
                }
            });
        });
    }

    /**
     * Called from within the page
     * when the user clicks this
     * it will center the map on their location
     * 
     */
    findMe() {
        this.getCurrentLocation().then((coords: any) => {
            let reCenter = new google.maps.LatLng(coords.lat, coords.lng);
            this.map.setCenter(reCenter);
        });
    }

    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    let pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    resolve(pos);
                }, () => {
                    alert('Sorry your current location could not be found. Please make sure you enabled location permissions or manually enter the address below.');
                    reject();
                });
            } else {
                reject();
            }
        });
    }

    handleSightingSubmit(evt) {
        if (this.user.getLoggedInUser()) {  
            if (this.pokemon.includes(this.currentSighting.name.trim())) {
                this.api.savePokemonSighting(this.user.getLoggedInUser().uid, this.currentSighting).then(() => {
                    this.showingPopup = false;
                }).catch(() => {
                    window.alert('Something went wrong, make sure all fields are filled out');
                });
            } else {
                window.alert('You have entered an invalid Pokemon.');
            }   
        }

        evt.preventDefault();
    }

    showingPopupChanged(newVal) {
        if (newVal) {
            this.getCurrentLocation().then((coords: any) => {
                this.currentSighting.latitude = coords.lat;
                this.currentSighting.longitude = coords.lng;

                this.dragMap =  new google.maps.Map(document.getElementById('draggable-geolocation-map'), {
                    center: {lat: -34.397, lng: 150.644},
                    styles: mapStyles,
                    zoom: 17             
                });                

                this.dragMap.setCenter(coords);

                var marker = new google.maps.Marker({
                    draggable: true,
                    icon: this.sightingIcon,
                    position: coords, 
                    map: this.dragMap,
                    title: "Your location"
                }); 

                let self = this;

                google.maps.event.addListener(marker, 'click', function (event) {
                    self.currentSighting.latitude = this.getPosition().lat();
                    self.currentSighting.longitude = this.getPosition().lng();
                });

                google.maps.event.addListener(marker, 'dragend', function (event) {
                    self.currentSighting.latitude = this.getPosition().lat();
                    self.currentSighting.longitude = this.getPosition().lng();
                });

            })
            document.body.classList.add('popup-showing');
        } else {
            this.currentSighting = {
                name: null,
                latitude: null,
                longitude: null
            };
            
            document.body.classList.remove('popup-showing');
        }
    }

    markerClustererFound() {
        return (typeof MarkerClusterer !== 'undefined' && typeof google !== 'undefined' && typeof this.map !== 'undefined');
    }
}

function request(url, type = 'GET') {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(type, url, true);
        xhr.responseType = 'json';

        xhr.onload = function(e) {
            if (this.status === 200) {
                resolve(this.response);
            }
        };

        xhr.onerror = function(e) {
            reject(e);
        }

        xhr.send();
    });
}
