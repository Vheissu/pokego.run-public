declare var firebase;

import {computedFrom, autoinject, TaskQueue} from 'aurelia-framework';

@autoinject
export class User {
    userLoggedIn: boolean = false;

    constructor(taskQueue: TaskQueue) {
        // Gives us an artificial delay before attempting to get
        // any auth information from Firebase
        taskQueue.queueMicroTask(() => {
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    this.userLoggedIn = true;

                    // Save a reference of the currently logged in user,
                    // this is so we can associate markers with users
                    // and if need be, ban them if they troll the site
                    this.saveUser({
                        displayName: user.displayName,
                        email: user.email,
                        providers: user.providerData,
                        uid: user.uid
                    }).catch(error => {
                        console.error(error);
                    })
                } else {
                    this.userLoggedIn = false;
                }
            });

            firebase.auth().getRedirectResult().then(result => {
                if (result && result.credential) {
                    let token = result.credential.accessToken;
                    let user = result.user;

                    this.userLoggedIn = true;
                }
            }).catch(error => {
                let errorCode = error.code;
                let errorMessage = error.message;
                let email = error.email;
                let credential = error.credential;

                this.userLoggedIn = false;

                if (errorCode === 'auth/account-exists-with-different-credential') {
                    alert('You have already signed up with a different auth provider for that email.');
                } else {
                    console.error(error);
                }
            });
        });
    }

    @computedFrom('userLoggedIn')
    get isLoggedIn() {
        return this.userLoggedIn;
    }

    saveUser(user) {
        let updates = {};
        updates['users/' + user.uid] = user;

        return firebase.database().ref().update(updates);
    }

    getUserData(user) {
        return firebase.database.ref(`users/${user}`);
    }

    getLoggedInUser() {
        return firebase.auth().currentUser;
    }

    loginWithFacebook() {
        if (!this.getLoggedInUser()) {
            let provider = new firebase.auth.FacebookAuthProvider();
            firebase.auth().signInWithRedirect(provider);
        } else {
            firebase.auth().signOut();
        }
    }

    loginWithGoogle() {
        if (!this.getLoggedInUser()) {
            let provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithRedirect(provider);
        } else {
            firebase.auth().signOut();
        }
    }

    logout() {
        return firebase.auth().signOut();
    }


}
