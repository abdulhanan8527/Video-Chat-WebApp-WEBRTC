'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
const parts = [];


var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};


var room ;
var Uname ;
Uname = prompt('Enter your name:');
room = prompt('Enter room name:');


var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log(Uname,' Attempted to create or  join room', room);
}

socket.on('created', function(room) {
  console.log(Uname + 'Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log(Uname + 'joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});


function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});


var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
document.querySelector('#camBtn').addEventListener('click', toggleCam);
document.querySelector('#micBtn').addEventListener('click', toggleMic);
document.querySelector('#hangupBtn').addEventListener('click', handleRemoteHangup);
var toggleRecording = document.querySelector('#toggleRecordingBtn');
var toggleScreenRecording = document.querySelector('#toggleBtnScreen');
document.querySelector('#screenBtn').addEventListener('click',toggleScreenShare);
var data = [];

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true,
})
.then((stream) => {
  console.log('Adding local stream by ' + Uname);
  localStream = stream;
  localVideo.srcObject = stream;
  const mediaRecorder = new MediaRecorder(stream);
  sendMessage('got user media');
  if (isInitiator) {
    document.querySelector('#micBtn').enabled = true;
    document.querySelector('#camBtn').enabled = true;
    console.log('Enabled');
    maybeStart();
  }
  toggleRecording.onclick = () =>
  {
    if(mediaRecorder.state === 'recording')
    {
      console.log(mediaRecorder.state);
      //for stopping recorder
      console.log('Stop recording');
      mediaRecorder.stop();
      console.log(mediaRecorder.state);
      console.log('Stopped Successfully');
      const blob = new Blob(parts, {type: 'video/mp4'});
      const urls = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = urls;
      a.download = "video.mp4";
      a.click();
    }
    else if(mediaRecorder.state === 'inactive')
    {
      console.log(mediaRecorder.state);
      // for starting recorder
      console.log('Start recording');
      mediaRecorder.start(1000);
      console.log(mediaRecorder.state);
      mediaRecorder.ondataavailable = function (e)
      {
        parts.push(e.data);
      }
    }
    else
    {
      console.log(mediaRecorder.state);
    }
  }
})
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function toggleScreenShare(){
  console.log('toggleScreenShare');
    navigator.mediaDevices.getDisplayMedia({
    video: {
        mediaSource: 'screen',
    },
    audio: true,
  })
    .then(async (e) => {
        console.log('Inside screen recording');
        let audio = await navigator.mediaDevices.getUserMedia({ 
            audio: true, video: false })
  
        localVideo.srcObject = e;
  
        let combine = new MediaStream(
            [...e.getTracks(), ...audio.getTracks()])
  
        let recorder = new MediaRecorder(combine);

        toggleScreenRecording.onclick = () => 
        {
          if(recorder.state === 'recording')
          {
            console.log("In screen recording stopped");
            recorder.stop();
            console.log("screen recording stopped");
            recorder.ondataavailable = (e) => 
            {
              data.push(e.data);
            };
  
            recorder.onstop = () => 
            {
              console.log("In creating Blob Function");
              let blobData = new Blob(data, { type: 'video/mp4' });
              let url = window.URL.createObjectURL(blobData);
              console.log('URL : ', url);
              const a = document.createElement("a");
              document.body.appendChild(a);
              a.style = "display: none";
              a.href = url;
              a.download = "videoscreen.mp4";
              a.click();
            };
          }
          else if(recorder.state === 'inactive')
          {
            console.log("In screen recording started");
            recorder.start();
            console.log("screen recording started");
            data = []
          }
          else
          {
            console.log(recorder.state);
          }
        };
    });
}


function toggleCam(e) {
  console.log("Camera toggle pressed");
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
}

function toggleMic(e) {
  console.log("Mic toggle pressed");
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
}

var constraints = {
  video: true,
  audio: true,
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
  console.log('Disabled');
  document.querySelector('#hangupBtn').disabled = false;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  window.location.reload();
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  window.location.reload();
  handleRemoteStreamRemoved();
  isStarted = false;
  pc.close();
  pc = null;
}