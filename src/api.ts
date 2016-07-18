declare var firebase;

export class Api {

    getFoundPokemon() {
        let foundPokemon = firebase.database().ref('found');

        return foundPokemon;
    }

    savePokemonSighting(uid, data) {
        data.foundby = uid;
        data.when = firebase.database.ServerValue.TIMESTAMP;

        let newSightingKey = firebase.database().ref().child('found').push().key;

        let updates = {};
        updates['found/' + newSightingKey] = data;

        return firebase.database().ref().update(updates);
    }

}
