var App = new Object();

App.shouldStop = false;
App.stopped = false;
App.ongoing = false;

playGathering = new Object();

var thoughtsFormIsReady = false;
var uploadIsFinished = false;

const uploadBlobsQueue = [];
var uploadBlobsQueueUploading = false;

const videoElement = document.getElementById("video-element");
const linkDownload = document.getElementById("link-download");
const buttonRecord = document.getElementById("button-record");
const buttonStop = document.getElementById("button-stop");
const buttonPause = document.getElementById("button-pause");
const buttonContinue = document.getElementById("button-continue");
const progressBarDiv = document.getElementById("upload-progress");
const uploadQueueCounter = document.getElementById("upload-queue-counter");
const playGatheringTitle = document.getElementById("play-gathering-title");
const playGatheringDescription = document.getElementById("play-gathering-description");
const playGatheringExtraInformation = document.getElementById("play-gathering-extra-information");
const playGatheringExtraInformationBlock = document.getElementById("play-gathering-extra-information-block");
const playGatheringAfterSessionMessage = document.getElementById("play-gathering-after-session-message");
const playGatheringAfterSessionMessageBlock = document.getElementById("play-gathering-after-session-message-block");
const playtesterReward = document.getElementById("playtester-reward-description");
const playtesterRewardBlock = document.getElementById("playtester-reward");
const DownloadGameBlock = document.getElementById("download-game-block");
const DownloadGameLink = document.getElementById("download-game-link");
const thoughtsFormDiv = document.getElementById("sa-contact-inner");
const thoughtsForm = document.getElementById("thoughts-form");
const timedCommentForm = document.getElementById("timed-comment-form");
const timedCommentModal = new bootstrap.Modal(document.getElementById("modal-timed-comment"));
const thanksDiv = document.getElementById("thanks-div");
const errorDiv = document.getElementById("error-div");
const permissionForm = document.getElementById("permission-form");
const permissionScreenBlock = document.getElementById("permission-screen-block");
const permissionTermsBlock = document.getElementById("permission-terms-block");
const permissionMicBlock = document.getElementById("permission-mic-block");
const permissionTermsCheck = document.getElementById("permission-terms-check");
const permissionScreenCheck = document.getElementById("permission-screen-check");
const permissionMicCheck = document.getElementById("permission-mic-check");
const downloadLinksDiv = document.getElementById("download-links");
const timerWrapperElement = document.getElementById("timer-wrapper");
const timerElement = document.getElementById("timer");
const coverElement = document.getElementById("play-gathering-cover");

const developerCheckboxesForm = document.getElementById("developer-checkboxes-form");
const developerCheckboxBlockTemplateDiv = document.getElementById("developer-checkbox-block-template");

var initTime = 0;
var initTimeAt = null;

var screenStream;
var micStream;
var fullStream;

var play_gathering_api_url;
var api_token;

var mimeType;
var mediaRecorder;
var recordedChunks;

var videoPartsMilliseconds = 60_000; // 1 minute
var sessionFinalized = false;
var uploadFinished = true;
var thoughtsSent = false;
var isPaused = false;
var extraInformationPresent = false;
var downloadPresent = false;
var afterSessionMessagePresent = false;


buttonRecord.style.display = "none";
buttonStop.style.display = "none";
buttonPause.style.display = "none";
buttonContinue.style.display = "none";
videoElement.style.display = "none";
linkDownload.style.display = "none";
progressBarDiv.style.display = "none";
thoughtsFormDiv.style.display = "none";
thanksDiv.style.display = "none";
errorDiv.style.display = "none";
permissionForm.style.display = "none";
timerWrapperElement.style.display = "none";
coverElement.style.display = "none";
uploadQueueCounter.style.display = "none";
developerCheckboxesForm.style.display = "none"

function setMimeType(){
  if(MediaRecorder.isTypeSupported("video/webm;codecs=vp9")){
    mimeType = "video/webm;codecs=vp9";
  } else {
    mimeType = "video/webm";
  }

  console.log("Using mimeType: " + mimeType);
}

function startRecord() {
  buttonRecord.disabled = true;
  buttonRecord.style.display = "none";
  buttonPause.style.display = "inline-block";
  buttonStop.style.display = "inline-block";
  videoElement.style.display = "inline-block";
  timerWrapperElement.style.display = "inline-block";
  initTimeAt = new Date().getTime();

  renderTimer();
}

function pauseRecord() {
  sendDebugEvent("pauseRecord");
  buttonPause.style.display = "none";
  buttonContinue.style.display = "inline-block";
  videoElement.pause();
  initTime += ((new Date().getTime()) - initTimeAt);
  isPaused = true;

  if(mediaRecorder.state == "recording")
    mediaRecorder.stop();
}

function continueRecord() {
  sendDebugEvent("continueRecord");
  buttonContinue.style.display = "none";
  buttonPause.style.display = "inline-block";
  videoElement.play();
  isPaused = false;
  initTimeAt = new Date().getTime();
  renderTimer();

  recordVideoChunk();
}

function stopRecord() {
  buttonStop.style.display = "none";
  // progressBarDiv.style.display = "block";
  thoughtsFormDiv.style.display = "block";

  if (afterSessionMessagePresent) {
    playGatheringAfterSessionMessageBlock.style.display = "block";
  }

  videoElement.style.display = "none";
  buttonPause.style.display = "none";
  buttonContinue.style.display = "none";
  timerWrapperElement.style.display = "none";
}

// function uploadFinished() {
//   progressBarDiv.style.display = "none";
//   thanksDiv.style.display = "block";
//   uploadIsFinished = true;

//   if(thoughtsFormIsReady) {
//     thoughtsFormSend();
//   }
// }

function sendingThoughtsFinished() {
  thoughtsSent = true;
  if(uploadFinished)
    thanksDiv.style.display = "block";
}

buttonRecord.addEventListener("click", function () {
  recordScreen();
});

buttonStop.addEventListener("click", function () {
    if(!confirm("Please confirm you want to finish the session")) return;

    sendDebugEvent("buttonStop Clicked");
    stopRecord();
    App.shouldStop = true;
    App.stopped = true;
    sessionFinalized = true;

    if(mediaRecorder.state == "recording") {
      mediaRecorder.stop();
    } else {
      if(!uploadBlobsQueueUploading && uploadBlobsQueue.length == 0) {
        sendSignalSessionFinalized();
        if(thoughtsSent)
          thanksDiv.style.display = "block";
      }
    }
});

buttonPause.addEventListener("click", function () {
  pauseRecord();
});

buttonContinue.addEventListener("click", function () {
  continueRecord();
});

function startRecording() {
    sendDebugEvent("HandleRecord :: ini");
    startRecord();
    App.stopped = false;
    App.ongoing = true;

    recordVideoChunk();
};

// Before try to refactor this be careful that
// race conditions can be generated in the events (specially in Chrome)
// The commit fixing this whs this: cd52e2b
function recordVideoChunk() {
  sendDebugEvent("recordVideoChunk :: start");

  mediaRecorder = new MediaRecorder(fullStream, { mimeType: mimeType });

  recordedChunks = [];

  mediaRecorder.onstart = function () {
    // console.log("mediaRecorder.onstart()");
  }

  mediaRecorder.ondataavailable = function (e) {
    // console.log("mediaRecorder.ondataavailable()");
    // console.log("ondataavailable", e.data.size);
    recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = function () {
    // console.log("mediaRecorder.onstop()");
    sendDebugEvent("recordVideoChunk :: end");
    actualChunks = recordedChunks.splice(0, recordedChunks.length);
    const blob = new Blob(actualChunks, { type: mimeType });
    // getSeekableBlob(blob, uploadVideoPart);
    if(blob.size > 0)
      addBlobToUploadQueue(blob);

    if(App.stopped){
      if(fullStream != null)
        fullStream.getTracks().forEach( track => track.stop() );

      if(micStream != null)
        micStream.getTracks().forEach( track => track.stop() );

      if(screenStream != null)
        screenStream.getTracks().forEach( track => track.stop() );
    }
  };

  mediaRecorder.start();

  setTimeout(function() {
    if(mediaRecorder.state == "recording")
      mediaRecorder.stop();

    if(!App.stopped && !isPaused)
      recordVideoChunk();
  }, videoPartsMilliseconds);
}

// From: https://stackoverflow.com/a/43378874/316700
function getParam(param){
  return new URLSearchParams(window.location.search).get(param);
}

function getPlaySessionInfo() {
  // sendDebugEvent("GetPlaySessionInfo :: ini");

  axios.request({
    method: "get",
    url: play_gathering_api_url,
    headers: { "Authorization": "Playcocola " + api_token }
  }).then(function(response) {
    iniPlayGatheringData(response.data);
    showPlayGatheringInfo(response.data.play_gathering);

    if(response.data.play_gathering.cover_url != null) {
      ShowCover(response.data.play_gathering.cover_url);
    }

    showPermissionForm();
    sendDebugEvent("GetPlaySessionInfo :: end");
  }).catch(function (error) {
    sendDebugEvent("GetPlaySessionInfo :: error");
    const errorMessage = "There was a problem trying to get the information for this Play Session.\n\nPlease try again."
    console.error("On getPlaySessionInfo()", errorMessage, error);
    showError(errorMessage);
  });
}

function ShowCover(cover_url) {
  coverElement.src = cover_url;
  coverElement.style.display = "block";
}

function showError(errorMessage) {
  errorDiv.querySelector("#error-message").innerHTML = marked(errorMessage);
  errorDiv.style.display = "block";
  sendDebugEvent("ShowError: " + errorMessage);
}

function closeErrorDiv() {
  errorDiv.style.display = "none";
  sendDebugEvent("CloseErrorDiv");
  return false;
}

function makeAllLinksTargetBlank(element) {
  element.querySelectorAll("a").forEach( link => link.setAttribute('target', '_blank') );
}

function showPlayGatheringInfo(info) {
  // console.log("showPlayGatheringInfo", info);
  playGatheringTitle.textContent = info.title;
  playGatheringDescription.innerHTML = marked(info.description);

  if (info.playtester_reward != null) {
    playtesterReward.innerHTML = marked(info.playtester_reward);
    playtesterRewardBlock.style.display = "block";
  }

  if (info.after_required_checkboxes_description != null) {
    playGatheringExtraInformation.innerHTML = marked(info.after_required_checkboxes_description);
    extraInformationPresent = true;
  }

  if (info.game_build_url != null) {
    DownloadGameLink.setAttribute("href", info.game_build_url);
    downloadPresent = true;
  }

  if (info.after_session_finished_description != null) {
    playGatheringAfterSessionMessage.innerHTML = marked(info.after_session_finished_description);
    afterSessionMessagePresent = true;
  }

  if (info.required_checkboxes.length > 0) {
    showDeveloperCheckboxes();
  }

  makeAllLinksTargetBlank(playGatheringDescription);
  makeAllLinksTargetBlank(playGatheringExtraInformation);
  makeAllLinksTargetBlank(playGatheringAfterSessionMessage);
  makeAllLinksTargetBlank(developerCheckboxesForm);
}

function showPermissionForm() {
  permissionForm.style.display = "block";
}

async function recordScreen() {
    sendDebugEvent("recordScreen :: ini");
    hidePermissionForm();
    App.shouldStop = false;

    const mimeType = "video/webm;codecs=vp9";
    const constraints = {
      video: {
        cursor: "motion"
      }
    };

    if(!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
      return window.alert("Screen Record not supported!")
    }

    const audioContext = new AudioContext();
    const audioDestination = audioContext.createMediaStreamDestination();

    if(screenStream.getAudioTracks().length > 0) {
      sendDebugEvent("screenStream.getAudioTracks :: system_sound");
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.1;

      const displayAudio = audioContext.createMediaStreamSource(screenStream);
      displayAudio.connect(gainNode);

      gainNode.connect(audioDestination);
    } else {
      sendDebugEvent("screenStream.getAudioTracks :: no_system_sound");
    }

    if(permissionMicCheck.checked){
      const userAudio = audioContext.createMediaStreamSource(micStream);
      userAudio.connect(audioDestination);
    }

    // console.log("audioDestination.stream.getTracks():", audioDestination.stream.getTracks());

    var tracks;

    // if I don't this then the loop mediaRecorder.ondataavailable is never called when mic is not accepted (Mac)
    if(screenStream.getAudioTracks().length > 0 || permissionMicCheck.checked) {
      tracks = [...screenStream.getVideoTracks(), ...audioDestination.stream.getTracks()];
    } else {
      tracks = [...screenStream.getVideoTracks()];
    }

    fullStream = new MediaStream(tracks);

    startRecording()

    videoElement.srcObject = fullStream;
    sendDebugEvent("recordScreen :: end");
}

async function uploadVideoPart(blob) {
  sendDebugEvent("uploadVideoPart :: ini");
  progressBarDiv.style.display = "block";
  uploadFinished = false;

  const filename = "video_part_" + Date.now() + ".webm";
  // createDownloadLink(blob, filename);

  const formData = new FormData();
  formData.append("video_part", blob, filename);

  try {
    let response =
      await axios.request({
        method: "post",
        url: playGathering.playSessionApiURL + "/video_part",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token },
        onUploadProgress: (p) => {
          // console.log("progress: ", p);
          uploadProgressBarUpdate(p.loaded / p.total);
        }
      });
  } catch(error) {
    sendDebugEvent("uploadVideoPart :: error");
    console.error("On uploadVideoPart()", error);
  } finally {
    progressBarDiv.style.display = "none";
    uploadFinished = true;
    uploadBlobsQueueUploading = false;

    if(sessionFinalized && uploadBlobsQueue.length == 0) {
      sendSignalSessionFinalized();
      if(thoughtsSent)
        thanksDiv.style.display = "block";
    }

    uploadNextBlob();
    sendDebugEvent("uploadVideoPart :: end");
  }
}

var lastUploadPercentageDebugEvent = 0;
function uploadProgressBarUpdate(percentage) {
  if(percentage > lastUploadPercentageDebugEvent + 0.1) {
    sendDebugEvent("UploadProgressBarUpdate: " + (percentage * 100).toFixed(2));
    lastUploadPercentageDebugEvent = percentage;
  }

  const bar = progressBarDiv.querySelector(".progress-bar");
  bar.setAttribute("aria-valuenow", percentage * 100);
  bar.style.width = (percentage * 100) + "%";
}

function captureThoughtsFormSubmit() {
  thoughtsForm.addEventListener("submit", event => {
    event.preventDefault();
    thoughtsFormReady();
  });
}

function captureTimedCommentFormSubmit() {
  timedCommentForm.addEventListener("submit", event => {
    event.preventDefault();
    sendTimedComment();
  });
}

function thoughtsFormReady() {
  thoughtsFormDiv.style.display = "none";
  thoughtsFormSend();
}

async function thoughtsFormSend() {
  sendDebugEvent("ThoughtsFormSend :: ini");

  let formData = new FormData();
  formData.append("user_name", thoughtsForm.querySelector('[name="name"]').value );
  formData.append("user_email", thoughtsForm.querySelector('[name="email"]').value );
  formData.append("user_comment", thoughtsForm.querySelector('[name="comment"]').value );

  try {
    let response =
      await axios.request({
        method: "post",
        url: playGathering.playSessionApiURL + "/comment",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token }
      });

    sendDebugEvent("ThoughtsFormSend :: end");
    sendingThoughtsFinished();
  } catch(error) {
    sendDebugEvent("ThoughtsFormSend :: error");
    console.error("On ThoughtsFormSend()", error);
  }
}

async function sendSignalSessionFinalized() {
  sendDebugEvent("sendSignalSessionFinalized :: ini");

  try {
    let response =
      await axios.request({
        method: "post",
        url: playGathering.playSessionApiURL + "/session_finalized",
        headers: { "Authorization": "Playcocola " + api_token }
      });

    sendDebugEvent("sendSignalSessionFinalized :: end");
    App.ongoing = false;
  } catch(error) {
    sendDebugEvent("sendSignalSessionFinalized :: error");
    console.error("On sendSignalSessionFinalized()", error);
  }
}

async function sendTimedComment() {
  sendDebugEvent("sendTimedComment :: ini");

  let formData = new FormData();
  formData.append("second_at_formatted", timedCommentForm.querySelector('[name="second_at_formatted"]').value );
  formData.append("flair", timedCommentForm.querySelector('[name="flair"]').value );
  formData.append("comment", timedCommentForm.querySelector('[name="comment"]').value );

  try {
    let response =
      await axios.request({
        method: "post",
        url: playGathering.playSessionApiURL + "/add_timed_comment",
        data: formData,
        headers: { "Authorization": "Playcocola " + api_token }
      });

    sendDebugEvent("sendTimedComment :: end");

    timedCommentModal.hide();
    timedCommentForm.reset();
  } catch(error) {
    sendDebugEvent("sendTimedComment :: error");
    console.error("On sendTimedComment()", error);
    const errorMessage = "There was a problem trying to send Timed Comment.\n\nPlease try again."
    showError(errorMessage);
  }
}

async function captureScreenStream() {
  sendDebugEvent("CaptureScreenStream :: ini");
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: "motion"}, audio: {"echoCancellation": false}});
    permissionScreenBlock.style.display = "none";
    sendDebugEvent("CaptureScreenStream :: end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureScreenStream :: error");
    permissionScreenCheck.checked = false;
    const errorMessage = "There was a problem trying to get permissions to record your screen.\n\nPlease try again.\n\nMaybe the permissions are block in the browser settings."
    console.error("On captureScreenStream()", error);
    showError(errorMessage);
  }
}

async function captureMicStream() {
  sendDebugEvent("CaptureMicStream :: ini");
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: {"echoCancellation": true}, video: false });
    permissionMicBlock.style.display = "none";
    sendDebugEvent("CaptureMicStream :: end");
    checkScreenPermissionsAccepted();
    checkAllPermissionsAccepted();
  } catch (error) {
    sendDebugEvent("CaptureMicStream :: error");
    permissionMicCheck.checked = false;
    const errorMessage = "There was a problem trying to get permissions to record your mic.\n\nPlease try again.\n\nMaybe the permissions are block in the browser settings."
    console.error("On captureMicStream()", error);
    showError(errorMessage);
  }
}

function checkTermsPermissionsAccepted() {
  if(permissionScreenCheck.checked && permissionTermsCheck.checked) {
    showButtonRecord();
  }
}

function checkScreenPermissionsAccepted() {
  if(permissionScreenCheck.checked) {
    sendDebugEvent("ScreenPermissionsAccepted");
    if(permissionTermsCheck.checked) {
      showButtonRecord();
    }
  }
}

function checkAllPermissionsAccepted() {
  if(permissionScreenCheck.checked && permissionMicCheck.checked && permissionTermsCheck.checked) {
    sendDebugEvent("AllPermissionsAccepted");
    hidePermissionForm();
  }
}

function hidePermissionForm () {
  permissionForm.style.display = "none";
}

function showButtonRecord() {
  buttonRecord.style.display = "inline-block";
}

function clickOnPermissionTermsCheck() {
  if(permissionTermsCheck.checked) {
    sendDebugEvent("TermsPermissionsAccepted");
    permissionTermsBlock.style.display = "none";
    checkTermsPermissionsAccepted();
  }
}

function clickOnPermissionScreenCheck() {
  if(permissionScreenCheck.checked) {
    captureScreenStream();
  }
}

function clickOnPermissionMicCheck() {
  if(permissionMicCheck.checked) {
    captureMicStream();
  }
}

function refreshPage() {
  sendDebugEvent("RefreshPage");
  location.reload();
}

function sendDebugEvent(value) {
  console.log("sendDebugEvent()", value);

  let formData = new FormData();
  formData.append("tag", "client-action");
  formData.append("value", value);

  axios.request({
    method: "post",
    url: playGathering.playSessionApiURL + "/event",
    data: formData,
    headers: { "Authorization": "Playcocola " + api_token }
  }).catch(function (error) {
    console.error("On sendDebugEvent()", error);
  });
}

// From: https://stackoverflow.com/a/2117523/316700
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function captureWindowErrors() {
  window.addEventListener("error", function (error) {
    console.log("error", error);
    showError("We have detected an error:\n\n(" + error.lineno + ") " + error.message);
  });
}

function iniAPIUrlsAndToken() {
  play_gathering_api_url = getParam("play_gathering_api_url");
  api_token = getParam("api_token");
}

function iniPlayGatheringData(data) {
  playGathering.playSessionApiURL = data.play_session_api_url;
  playGathering.uuid = data.play_gathering.uuid;
  playGathering.title = data.play_gathering.title;
  playGathering.description = data.play_gathering.description;
  playGathering.coverUrl = data.play_gathering.cover_url;
  playGathering.playtestingSessionMinutes = data.play_gathering.playtesting_session_minutes;
  playGathering.fullGameplayMinutes = data.play_gathering.full_gameplay_minutes;
  playGathering.playtesterReward = data.play_gathering.playtester_reward;
  playGathering.requiredCheckboxes = data.play_gathering.required_checkboxes;
  playGathering.afterRequiredCheckboxesDescription = data.play_gathering.after_required_checkboxes_description;
  playGathering.afterSessionFinishedDescription = data.play_gathering.after_session_finished_description;
  playGathering.gameBuildUrl = data.play_gathering.game_build_url;
}


function renderTimer() {
  if(isPaused || App.stopped)
    return;

  const time = initTime + (new Date().getTime() - initTimeAt);
  const hours = Math.floor(time / 1000 / 60 / 60);
  const minutes = Math.floor((time / 1000 / 60) % 60);
  const seconds = Math.floor((time / 1000) % 60);
  var timeString =  minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");

  if(hours > 0)
    timeString = hours.toString().padStart(2, "0") + ":" + timeString;

  timerElement.innerHTML = timeString;

  setTimeout(renderTimer, 1000);
}

function openTimedCommentModal() {
  timedCommentForm.querySelector('[name="second_at_formatted"]').value = timerElement.innerHTML;
  timedCommentModal.show()
}

function addBlobToUploadQueue(blob) {
  uploadBlobsQueue.push(blob);
  updateUploadQueueCounter();
  uploadNextBlob();
}

function uploadNextBlob() {
  if(uploadBlobsQueueUploading || uploadBlobsQueue.length == 0)
    return;

  uploadBlobsQueueUploading = true;
  var blob = uploadBlobsQueue.shift();
  updateUploadQueueCounter();
  uploadVideoPart(blob);
}

function updateUploadQueueCounter() {
  if(uploadBlobsQueue.length == 0) {
    uploadQueueCounter.style.display = "none";
  } else {
    uploadQueueCounter.style.display = "flex";
    uploadQueueCounter.querySelector("span").innerHTML = uploadBlobsQueue.length;
  }
}

function clickOnDeveloperCheckboxCheck() {
  hideDeveloperCheckboxesFormIfFinishedOrEmpty();
}

function hideDeveloperCheckboxesFormIfFinishedOrEmpty() {
  if (Array(...developerCheckboxesForm.querySelectorAll("input[type=checkbox].dynamic")).every(e => e.checked)) {
    developerCheckboxesForm.style.display = "none";

    if (extraInformationPresent) {
      playGatheringExtraInformationBlock.style.display = "block";
    }

    if (downloadPresent) {
      DownloadGameBlock.style.display = "block";
    }
  }
}

function showDeveloperCheckboxes() {
  playGathering.requiredCheckboxes.forEach((e, index) => {
    let divCloned = developerCheckboxBlockTemplateDiv.cloneNode(true);
    document.querySelector(".developer-checkboxes").appendChild(divCloned);

    divCloned.classList.remove("hidden");
    divCloned.querySelector("input[type=checkbox]").id = "developer-check-" + index;
    divCloned.querySelector("input[type=checkbox]").classList.add("dynamic");
    divCloned.querySelector("label").innerHTML = marked(e).replace(/^<p>/, "").replace(/<\/p>\n$ /, "");
    divCloned.querySelector("label").setAttribute("for", "developer-check-" + index);
  });

  developerCheckboxesForm.style.display = "block";
  hideDeveloperCheckboxesFormIfFinishedOrEmpty
}

// Before close/reload event
const beforeUnloadListener = (event) => {
  if(!App.ongoing) return;

  event.preventDefault();
  return event.returnValue = "The video is still uploading. Do you really want to close the window?";
};
window.addEventListener("beforeunload", beforeUnloadListener, { capture: true });


// Start
setMimeType();
captureWindowErrors();
uploadProgressBarUpdate(0);
iniAPIUrlsAndToken();
getPlaySessionInfo();
captureThoughtsFormSubmit();
captureTimedCommentFormSubmit();
// sendDebugEvent("PageLoaded");
