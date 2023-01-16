var authenticated = false;
var isPlaying = false;
var access_token, refresh_token, token_type;
var GOOGLE_API_KEY = "API_KEY_HERE";
var songArtistName;
var intervId;
var progressBars = {};
var isSpotifyOpen = false;

document.getElementById("previous").addEventListener("click", previous);
document.getElementById("next").addEventListener("click", next);
document.getElementById("pausePlay").addEventListener("click", pausePlay);
document.getElementById("signOut").addEventListener("click", () => {
    window.api.signOut("signOut", {});
})

function setPlaying(){
    isPlaying = true;
    document.getElementById("pausePlay").innerHTML = "Pause";
}

function setPaused(){
    isPlaying = false;
    document.getElementById("pausePlay").innerHTML = "Play";
}

function previous(){
    if(authenticated){
        console.log("Previous");
        fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                Authorization: token_type + ' ' + access_token
            }
        }).then(() => {
            getCurrentlyPlaying();
        })
    }
}

function next(){
    if(authenticated){
        console.log("Next");
        fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                Authorization: token_type + ' ' + access_token
            }
        }).then(() => {
            getCurrentlyPlaying();
        })

    }
}

function pause(){
    fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
            Authorization: token_type + ' ' + access_token
        }
    })
}

function play(){
    fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
            Authorization: token_type + ' ' + access_token
        }
    })
}

function pausePlay(){
    if(authenticated){
        console.log("Pause Play");
        if(isPlaying){
            pause();
            //setPaused();
        }
        else{
            play();
            //setPlaying();
        }
        getCurrentlyPlaying();
    }
}

function enableButtons(){
    document.getElementById("previous").disabled = false;
    document.getElementById("pausePlay").disabled = false;
    document.getElementById("next").disabled = false;
}

function disableButtons(){
    document.getElementById("previous").disabled = true;
    document.getElementById("pausePlay").disabled = true;
    document.getElementById("next").disabled = true;
}

window.api.receiveTokens("fromMain", (event, obj) => {
    authenticated = true;

    console.log('Obj: ' + JSON.stringify(obj));
    access_token = obj.access_token;
    token_type = obj.token_type;
    if(obj.refresh_token){
        refresh_token = obj.refresh_token;
    }
    
    fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: token_type + ' ' + access_token
        }
    }).then((response) => {
        if(response){
            response.json().then((res) => {
                console.log("Me response: " + JSON.stringify(res));
                document.getElementById("userName").innerHTML = res.display_name;

                if(!intervId){
                    getCurrentlyPlaying();
                    intervId = setInterval(getCurrentlyPlaying, 1000);
                }
            })
        }
        else{
            console.log("No response");
        }
    })
})

function getCurrentlyPlaying(){
    fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
            Authorization: token_type + ' ' + access_token
        }
    }).then((response) => {
        if(response){
            response.json().then((res) => {
                console.log(JSON.stringify(res));
                if(res.error){
                    // Access token expired
                    if(res.error.status === 401){
                        // Refresh access token
                        console.log("Refresh access token");
                        window.api.requestRefreshToken("requestRefreshToken", {refresh_token: refresh_token});
                    }
                }
                else {
                    if(!isSpotifyOpen){
                        isSpotifyOpen = true;
                        enableButtons();
                    }
                    for(var artist of res.item.artists){
                        console.log("Artist: " + JSON.stringify(artist));
                    }

                    console.log("Name: " + res.item.name);

                    // Check if song changed
                    if(songArtistName !== res.item.artists[0].name + " - " + res.item.name){
                        songArtistName = res.item.artists[0].name + " - " + res.item.name;
                        document.getElementById("songArtistName").innerHTML = songArtistName;
                        youtubeSearch(res.item.artists[0].name + " " + res.item.name);
                    }

                    if(res.is_playing){
                        setPlaying();
                    }
                    else {
                        setPaused();
                    }
                }

            }).catch((err) => {
                console.log(err);
                document.getElementById("songArtistName").innerHTML = "No song playing."

                isSpotifyOpen = false;
                disableButtons();
            });
        }
        else{
            console.log("No response");
        }
    })
}

function youtubeSearch(query){
    console.log("Youtube search");
    try {
        fetch("https://www.googleapis.com/youtube/v3/search?" + 
            new URLSearchParams({ 
                key: GOOGLE_API_KEY,
                maxResults: 10,
                part: 'snippet',
                q: query 
            })
        ).then((response) => {
            if(response){
                response.json().then((res) => {
                    console.log('Youtube response: ' + JSON.stringify(res));

                    var ids = "";

                    for(var item of res.items){
                        console.log(item.snippet.title + ': ' + item.id.videoId);
                        ids += item.id.videoId + ',';
                    }
                    // Get rid of end comma
                    ids = ids.substring(0, ids.length - 1);

                    console.log("Ids: " + ids);
                    console.log("Url encoded: " + encodeURIComponent(ids));
                    getVideos(ids);
                    
                })
            }
        }).catch((err) => {
            console.log("Youtube error caught: " + err);
        })
    }
    catch(err){ console.log("Youtube error: " + err);}
}

function getVideos(ids){
    try {
        console.log("URL: " + "https://www.googleapis.com/youtube/v3/videos?" + 
            new URLSearchParams({ 
                key: GOOGLE_API_KEY,
                maxResults: 10,
                part: 'player,snippet,statistics',
                id: ids
            }));
        fetch("https://www.googleapis.com/youtube/v3/videos?" + 
            new URLSearchParams({ 
                key: GOOGLE_API_KEY,
                maxResults: 10,
                part: 'snippet,statistics,contentDetails',
                id: ids
            })
        ).then((response) => {
            if(response){
                response.json().then((res) => {
                    console.log('Youtube get video response: ' + JSON.stringify(res));
                    var videos = [];
                    for(var item of res.items){
                        videos.push({
                            title: item.snippet.title,
                            duration: convertDurationString(item.contentDetails.duration),
                            viewCount: parseInt(item.statistics.viewCount).toLocaleString(),
                            thumbnail: item.snippet.thumbnails.medium.url,
                            url: 'https://youtube.com/watch?v=' + item.id,
                            id: item.id
                        })
                        //console.log(item.player.embedHtml.replace('//', 'https://'))
                        //console.log('Duration: ' + convertDurationString(item.contentDetails.duration));
                    }
                    displayVideoList(videos);
                })
            }
        }).catch((err) => {
            console.log("Youtube error caught: " + err);
        })
    }
    catch(err){ console.log("Youtube error: " + err);}
}

function convertDurationString(str){
    var hours = 0;
    var minutes = 0;
    var seconds = 0;
    var number = '';

    for(var i of str.substring(2, str.length)){
        let digit = parseInt(i);
        if(!isNaN(digit)){
            number += i;
        }
        else {
            console.log('parsed:'+ parseInt(number));
            if(i === 'H')
                hours = parseInt(number);
            else if(i === 'M')
                minutes = parseInt(number);
            else if(i === 'S')
                seconds = parseInt(number);
            number = '';
        }
    }

    var formatted = '';

    if(hours > 0){
        formatted += hours + ':';
    }
    if(minutes > 0){
        if(hours > 0 && minutes < 10){
            formatted += '0' + minutes + ':';
        }
        else {
            formatted += minutes + ':';
        }
    }
    if(minutes === 0){
        formatted += '0:';
    }
    if(seconds < 10){
        formatted += '0' + seconds;
    }
    else{
        formatted += seconds;
    }

    return formatted;
}

function displayVideoList(videos){
    var videosDiv = document.getElementById('videos');
    videosDiv.replaceChildren();
    for(let video of videos){

        // Create video row
        var videoRow = document.createElement('div');
        videoRow.className = "row video-item my-3";

        // Create two columns
        var colLeft = document.createElement('div');
        colLeft.className = "col-6";

        var colRight = document.createElement('div');
        colRight.className = "col-6";

        // Create image thumbnail element/link to video
        var videoLink = document.createElement('a');
        videoLink.href = video.url;
        videoLink.target = "_blank";

        var thumbnail = document.createElement('img');
        thumbnail.src = video.thumbnail;

        videoLink.appendChild(thumbnail);
        colLeft.appendChild(videoLink);

        // Create video title element
        var videoTitle = document.createElement('h3');
        videoTitle.appendChild(document.createTextNode(video.title));

        // Create video info div
        var videoInfo = document.createElement('div');
        videoInfo.appendChild(document.createTextNode(video.duration + ' \u00B7 ' + video.viewCount + ' views'));

        let downloadBtn = document.createElement('button');
        downloadBtn.className = "my-2 p-2 btn";
        downloadBtn.appendChild(document.createTextNode('Download'));
        //downloadBtn.id = video.id;
        downloadBtn.addEventListener("click", () => {
            console.log("Downloading id: " + video.id + ', title: ' + video.title);
            window.api.sendDownload("sendDownload", {id: video.id, name: video.title})

            var downloadsGroup = document.getElementById("downloadsGroup");

            let listItem = document.createElement("li");
            listItem.className = "list-group-item";

            let listText =  document.createElement('p');
            listText.appendChild(document.createTextNode(video.title));

            let progress = document.createElement('div');
            progress.className = "progress";

            let progressBar = document.createElement('div');
            progressBar.className = "progress-bar";
            progressBar.role = "progress-bar";
            progressBar.ariaValueNow = "0";
            progressBar.ariaValueMin = "0";
            progressBar.ariaValueMax = "100";
            progressBar.style = "width: 0%";
            progressBar.appendChild(document.createTextNode("0%"));

            // Keep track of individual progress bars
            progressBars[video.id] = progressBar;

            listItem.appendChild(listText);
            progress.appendChild(progressBar);
            listItem.appendChild(progress);

            downloadsGroup.appendChild(listItem);
        })

        colRight.appendChild(videoTitle);
        colRight.appendChild(videoInfo);
        colRight.appendChild(downloadBtn);

        videoRow.appendChild(colLeft);
        videoRow.appendChild(colRight);

        videosDiv.appendChild(videoRow);
    }
}

window.api.updateProgress("updateProgress", (event, obj) => {
    console.log('Updating progress bar with id: ' + obj.id);
    let progressBar = progressBars[obj.id];
    progressBar.style = "width: " + obj.percentage.toString() + "%";
    progressBar.ariaValueNow = obj.percentage.toString();
    progressBar.replaceChildren(document.createTextNode(obj.percentage.toFixed(2).toString() + '%'));
})