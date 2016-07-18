# pokego.run
Pokego.run app. This is the source code for [Pokego.run](https://pokego.run) built using the Aurelia CLI. It is written in TypeScript, Sass for styling, Autoprefixer for cross-browser prefixes and CSSNano to reduce CSS size in the bundle.

## Install
- Pull down the repository
- Install the Aurelia CLI globally: `npm install aurelia-cli -g`
- Make sure the typings tool is globally installed: `npm install typings -g`
- Go into project directory: `npm install`
- Install the TypeScript typings: `typings install`
- Run the app locally: `au run --watch`

## Before you run it
This app uses Firebase, so you will need to configure an app to use with it and then open up `index.html` and add in your API details down the bottom. You'll see they are currently blank.

Google Maps is also used for this, so you'll need to open up `src/config.ts` and add in your Google Maps API key as well.
