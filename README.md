[Искалка по фрагментам видеолекций Р.Н. Константинова по функциональному анализу](https://ngusev.ru/cuetube) (фрагменты выделены Соней Строгановой и Дмитрием Гущиным).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Getting data

Install dependencies:

```
python3 -m venv localpyvenv
source localpyvenv/bin/activate
pip3 install -r requirements.txt
```

Get `client_secret.json` from https://console.developers.google.com/ (API and Services, credentials, OAuth 2.0 key).
Download `youtube-v3-discoverydocument.json` from https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest.
Then execute

```
python3 ./src/mine.py
deactivate
```