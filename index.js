const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');
const fetch = require('node-fetch');
const ytmp3 = require('youtube-mp3-downloader');
const YDCallbacks = {};
var YD, win, ffmpegPath, client_id, redirect_uri, codeVerifier;
var signedIn = false;

const createWindow = () => {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false, // Default value after Electron v5,
            contextIsolation: true,
            enableRemoteModule: false,
            autoHideMenuBar: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.removeMenu();

    if(process.platform === 'darwin' || process.platform === 'linux'){
        ffmpegPath = '/bin/unix/ffmpeg';
    }
    else if(process.platform === 'win32'){
        ffmpegPath = '/bin/win/ffmpeg.exe';
    }

    win.on('close', function(e){
        if(signedIn){
            var choice = dialog.showMessageBoxSync({
                title: "Spotify Downloader",
                type: "question",
                message: "Stay signed in? Not recommended for shared computers.",
                buttons: ["Yes", "No"]
            });
            if(choice === 1){
                console.log("Clear data");
                win.webContents.session.clearStorageData();
            }
        }
    })

    var loginRes = login();
    redirect_uri = loginRes.redirect_uri;
    client_id = loginRes.client_id;
    codeVerifier = loginRes.codeVerifier;

    win.webContents.on('will-redirect', async function(event, url) {
        console.log("REDIRECTING TO Url: " + url);
        if(url.startsWith("https://accounts.spotify.com/authorize")){
            // User has signed in
            signedIn = true;
        }
    })

    win.webContents.on('will-navigate', async function(event, newUrl) {
        if(newUrl.includes(redirect_uri)){
            signedIn = true;
            console.log("New URL: " + newUrl);
            console.log("URL query: " + JSON.stringify(url.parse(newUrl, true).query));

            var code = url.parse(newUrl, true).query.code;

            var response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: querystring.stringify({
                    client_id,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri,
                    code_verifier: codeVerifier 
                })
            })

            var response = await response.json();
            var token_type = response.token_type;
            var access_token = response.access_token;
            var refresh_token = response.refresh_token;

            win.webContents.on('did-finish-load', function() {
                console.log("Finished loading.");
                win.webContents.send("fromMain", {token_type, access_token, refresh_token});
            });

            var res = await fetch('https://api.spotify.com/v1/me', {
                method: 'GET',
                headers: {
                    Authorization: token_type + ' ' + access_token
                }
            })

            try {
                console.log(await res.json());
            }
            catch(err){ console.log('No song currently playing.')}


            win.loadFile("index.html");
        }
    })
    win.webContents.setWindowOpenHandler(({url}) => {
        console.log("new window opened");
        shell.openExternal(url);
        return {action: 'deny'};
    })
}

function login(){

    var client_id = 'beff1098e9e44628bc2656395189b283';
    var codeVerifier = crypto.randomBytes(32).toString('hex');
    var code_challenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    var redirect_uri = 'http://localhost:3000/callback'

    console.log("Code Verifier: " + codeVerifier + ", Code Challenge: " + code_challenge);

    var authUrl = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id,
            scope: 'user-read-private user-read-email user-modify-playback-state user-read-currently-playing',
            code_challenge_method: 'S256',
            code_challenge,
            redirect_uri,
        });
 
    win.loadURL(authUrl);
    win.show();

    return {client_id, codeVerifier, redirect_uri};
}

ipcMain.on("requestRefreshToken", (event, data) => {
    console.log("Refreshing token...");
    refreshAccessToken(data.refresh_token);
})

async function refreshAccessToken(refresh_token){
    try {
        var response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: querystring.stringify({
                client_id,
                grant_type: 'refresh_token',
                refresh_token,
                redirect_uri,
                code_verifier: codeVerifier 
            })
        })
    }
    catch(err){
        console.log("RefreshAccessToken: " + err);
    }

    var response = await response.json();
    var token_type = response.token_type;
    var access_token = response.access_token;
    var new_refresh_token = response.new_refresh_token;

    win.webContents.send("fromMain", {token_type, access_token, refresh_token: new_refresh_token});
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })    
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})

ipcMain.handle('download-file', async (event, id) => {
    console.log("Id: " + id);
})

ipcMain.on('sendDownload', (event, data) => { 
    let options = {
        properties: ['openDirectory']
    }

    const folder = dialog.showOpenDialogSync(win, options);
    console.log("File Response: " + folder);
    initializeYD(folder);

    convertVideo(data.id, data.name + '.mp3', function(err, res){
        if(err){
            throw err;
        }
        else {
            console.log("Response: " + JSON.stringify(res));
        }
    })
})

ipcMain.on('signOut', (event, data) => {
    signedIn = false;
    win.webContents.session.clearStorageData();
    login();    
})

function initializeYD(outputPath){
    YD = new ytmp3({
        ffmpegPath: __dirname + ffmpegPath,
        outputPath,
        youtubeVideoQuality: 'highestaudio',
        queueParallelism: 2,
        progressTimeout: 500,
        allowWebm: false
    })
    YD.on("finished", function(err, data){
        console.log("Finished");
        console.log(JSON.stringify(data));

        if(YDCallbacks[data.videoId]){
            YDCallbacks[data.videoId](err, data);
        }
        else {
            console.log('Error: No callback for id');
        }
    })

    YD.on("error", function(err, data){
        console.log(err);

        if(data){
            if(YDCallbacks[data.videoId]){
                YDCallbacks[data.videoId](err, data);
            }
            else {
                console.log('Error: No callback for id');
            }
        }
    })

    YD.on("progress", function(progress){
        win.webContents.send("updateProgress", {id: progress.videoId, percentage: progress.progress.percentage});
        console.log(JSON.stringify(progress));
    })
}

function convertVideo(id, outputName, callback){
    YDCallbacks[id] = callback;
    YD.download(id, outputName);
}
